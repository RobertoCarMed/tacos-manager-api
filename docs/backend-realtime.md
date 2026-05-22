# TacosManager — Backend Realtime Reference

> **Fuente de verdad:** este documento fue generado analizando el código fuente real del backend.
> Refleja el estado actual de la implementación. No documenta funcionalidades futuras ni planeadas.

---

## Índice

1. [Overview](#overview)
2. [Flujo de conexión](#flujo-de-conexión)
3. [Autenticación del socket](#autenticación-del-socket)
4. [Rooms multi-tenant](#rooms-multi-tenant)
5. [Eventos: cliente → servidor](#eventos-cliente--servidor)
6. [Eventos: servidor → cliente](#eventos-servidor--cliente)
7. [Contratos de payload](#contratos-de-payload)
8. [Garantías multi-tenant](#garantías-multi-tenant)
9. [Reconexión](#reconexión)
10. [Manejo de errores](#manejo-de-errores)
11. [Guía de integración React Native](#guía-de-integración-react-native)
12. [Buenas prácticas frontend](#buenas-prácticas-frontend)

---

## Overview

TacosManager usa **Socket.IO v4** para sincronización en tiempo real entre cocina y meseros.

El sistema realtime permite que cualquier cambio sobre órdenes (creación, edición, cambio de estado) sea propagado inmediatamente a todos los clientes conectados de la misma taquería, sin necesidad de polling.

**Características del sistema actual:**

| Característica             | Implementación                                                  |
|----------------------------|-----------------------------------------------------------------|
| Librería                   | Socket.IO v4 (`@nestjs/platform-socket.io`)                    |
| Puerto                     | Mismo que REST (default: `3000`)                               |
| Namespace                  | Default (`/`)                                                   |
| Path                       | Default (`/socket.io`)                                         |
| Autenticación              | JWT en handshake (misma clave y configuración que REST)        |
| Aislamiento                | Rooms por `taqueriaId` — un usuario no recibe eventos de otra taquería |
| CORS                       | `origin: '*'`, `credentials: true`                            |
| Fuente de verdad           | PostgreSQL siempre antes de emitir                             |

**Relación con otros módulos:**

```
OrdersService
 ├── createOrder()      → emitOrderCreated()
 ├── updateOrder()      → emitOrderUpdated()
 └── updateOrderStatus()→ emitOrderStatusChanged()
                               │
                         RealtimeGateway
                               │
                    server.to(`taqueria:<id>`).emit(event, payload)
                               │
                     Todos los clientes en la room
                     (COOK + WAITER de esa taquería)
```

---

## Flujo de conexión

Paso a paso de lo que ocurre cuando un cliente se conecta:

```
1. Cliente inicia conexión Socket.IO con JWT en el handshake

2. handleConnection() se ejecuta en el servidor

3. extractToken():
   ├── Busca en socket.handshake.auth.token       ← prioridad 1
   └── Busca en socket.handshake.headers.authorization (Bearer)  ← prioridad 2

4. Si no hay token → client.disconnect() inmediato

5. jwtService.verifyAsync(token):
   ├── Verifica firma con JWT_SECRET
   ├── Verifica que no esté expirado (expiresIn: 1d)
   └── Si falla → catch → client.disconnect()

6. usersService.findAuthUserById(payload.sub):
   ├── Consulta PostgreSQL con el userId del JWT
   ├── Retorna { id, name, email, role, taqueriaId, taqueria }
   └── Si no existe o no tiene taquería → client.disconnect()

7. socket.data.user = { id, name, email, role, taqueriaId, restaurantCode }
   (contexto del usuario queda disponible en todos los handlers)

8. socket.join(`taqueria:${taqueriaId}`)
   (el socket queda suscrito a los eventos de su taquería)

9. Logger: "Connected: <socketId> | user=<userId> | room=taqueria:<taqueriaId>"

10. El cliente puede empezar a recibir eventos de la room
```

---

## Autenticación del socket

### Cómo enviar el token

**Opción A — recomendada** (`handshake.auth.token`):

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: accessToken  // el JWT obtenido en /auth/login o /auth/register
  }
});
```

**Opción B — header Authorization** (`handshake.headers.authorization`):

```js
const socket = io('http://localhost:3000', {
  extraHeaders: {
    Authorization: `Bearer ${accessToken}`
  }
});
```

El servidor intenta la Opción A primero. Si no hay token ahí, intenta la Opción B. Si ninguna tiene token, desconecta.

---

### Extracción del token (código real del servidor)

```typescript
// src/realtime/realtime.gateway.ts — extractToken()

private extractToken(client: Socket): string | null {
  // Prioridad 1: socket.handshake.auth.token
  const tokenFromAuth = client.handshake.auth?.token as string | undefined;
  if (tokenFromAuth) return tokenFromAuth;

  // Prioridad 2: Authorization: Bearer <token>
  const authHeader = client.handshake.headers?.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
}
```

---

### Comportamiento según tipo de fallo

| Situación                                  | Resultado en servidor                         | Lo que ve el cliente            |
|--------------------------------------------|-----------------------------------------------|---------------------------------|
| Sin token                                  | `client.disconnect()` + log warn             | `disconnect` event              |
| Token con firma inválida                   | catch → `client.disconnect()` + log warn     | `disconnect` event              |
| Token expirado                             | `verifyAsync` lanza → catch → `disconnect`   | `disconnect` event              |
| Token válido pero userId no existe en BD   | `client.disconnect()` + log warn             | `disconnect` event              |
| Usuario existe pero no tiene taquería      | `client.disconnect()` + log warn             | `disconnect` event              |
| Token válido y usuario OK                  | socket autenticado, unido a room              | conexión activa                 |

**Importante:** el servidor no emite un evento de error antes de desconectar. El cliente simplemente recibe el evento `disconnect`. No hay un `connect_error` con descripción del motivo.

---

### Cuándo se valida el JWT

El JWT se valida **únicamente en el momento de la conexión** (`handleConnection`). Una vez conectado, el socket permanece activo aunque el JWT expire durante la sesión. La expiración solo toma efecto al intentar una nueva conexión o reconexión.

---

## Rooms multi-tenant

### Formato de room

```
taqueria:<taqueriaId>
```

Donde `<taqueriaId>` es el UUID de la taquería en PostgreSQL.

**Ejemplo:**
```
taqueria:b3e2c1d4-8f4a-4b2e-9c1d-5a7e8f0b2c3d
```

### Cuándo se asigna

Inmediatamente tras validar el JWT en `handleConnection`:

```typescript
const room = `taqueria:${user.taqueriaId}`;
await client.join(room);
```

El `taqueriaId` proviene **exclusivamente del JWT** — nunca del cliente.

### Quién entra a la room

Todos los usuarios de la misma taquería: tanto WAITER como COOK. No hay rooms separadas por rol.

### Cómo se usa para emitir

```typescript
// Dentro de RealtimeGateway
this.server.to(`taqueria:${taqueriaId}`).emit('order-created', { order });
```

Todos los sockets en esa room reciben el evento — sin importar el rol.

---

## Eventos: cliente → servidor

### `join-taqueria`

Permite confirmar que el socket está activo y obtener los datos de la room actual.

**Protegido por `RealtimeAuthGuard`** — verifica que `socket.data.user` existe (seteado en `handleConnection`).

**Cómo enviarlo:**

```js
// Opción A — con listener separado (NestJS emite de vuelta el evento)
socket.on('join-taqueria', (data) => {
  console.log(data);
  // { room: 'taqueria:<id>', taqueriaId: '<uuid>', restaurantCode: 'TM-4821' }
});
socket.emit('join-taqueria');

// Opción B — con acknowledgment callback
socket.emit('join-taqueria', (response) => {
  console.log(response);
  // { room: 'taqueria:<id>', taqueriaId: '<uuid>', restaurantCode: 'TM-4821' }
});
```

**Response payload:**

```json
{
  "room": "taqueria:b3e2c1d4-8f4a-4b2e-9c1d-5a7e8f0b2c3d",
  "taqueriaId": "b3e2c1d4-8f4a-4b2e-9c1d-5a7e8f0b2c3d",
  "restaurantCode": "TM-4821"
}
```

**Cuándo usarlo:** principalmente para debugging, para confirmar que la conexión y autenticación fueron exitosas, o como heartbeat manual.

---

## Eventos: servidor → cliente

Los tres eventos siguientes son emitidos **exclusivamente** a la room `taqueria:<taqueriaId>` de la orden afectada. Nunca se emiten globalmente ni a rooms de otras taquerías.

**Todos los eventos siguen el mismo patrón de escucha:**

```js
socket.on('<nombre-del-evento>', ({ order }) => {
  // order es la orden completa
});
```

---

### `order-created`

**Origen:** `OrdersService.createOrder()` → `RealtimeGateway.emitOrderCreated()`

**Disparado por:** `POST /orders` (solo WAITER puede llamarlo)

**Cuándo:** inmediatamente después de que la orden queda persistida en PostgreSQL.

**Escuchar:**

```js
socket.on('order-created', ({ order }) => {
  // Agregar la nueva orden al estado local
});
```

**Estado de la orden al emitir:**
- `status`: `PENDING`
- `revision`: `1`
- Todos los items tienen `isNew: false`
- `priorityTimestamp`: timestamp de creación

**Quién recibe:** todos los usuarios conectados de la taquería (COOK y WAITER).

---

### `order-updated`

**Origen:** `OrdersService.updateOrder()` → `RealtimeGateway.emitOrderUpdated()`

**Disparado por:** `PATCH /orders/:id` (solo WAITER puede llamarlo, solo sobre sus propias órdenes)

**Cuándo:** después de que el append-only update queda persistido. La orden emitida es leída fresca de BD con `getOrderById()`.

**Escuchar:**

```js
socket.on('order-updated', ({ order }) => {
  // Reemplazar la orden existente en el estado local por el objeto completo
});
```

**Estado de la orden al emitir:**
- `status`: `UPDATED` (automático — el servidor lo impone)
- `revision`: incrementado (era N, ahora N+1)
- `priorityTimestamp`: actualizado a `now()` (la orden sube en la cola de cocina)
- Los plates e items anteriores: presentes con `isNew: false`, `createdInRevision` del momento original
- Los plates e items nuevos: presentes con `isNew: true`, `createdInRevision` igual al nuevo `revision`

**Quién recibe:** todos los usuarios conectados de la taquería (COOK y WAITER).

---

### `order-status-changed`

**Origen:** `OrdersService.updateOrderStatus()` → `RealtimeGateway.emitOrderStatusChanged()`

**Disparado por:** `PATCH /orders/:id/status` (solo COOK puede llamarlo)

**Cuándo:** después de que la transacción de cambio de estado queda committed en PostgreSQL.

**Escuchar:**

```js
socket.on('order-status-changed', ({ order }) => {
  // Actualizar el status de la orden en el estado local
});
```

**Estado de la orden al emitir:**
- `status`: el nuevo status enviado por el COOK
- Si el nuevo status es `READY` (viniendo de `UPDATED` o `PREPARING`): **todos** los items tienen `isNew: false` — limpiados en la misma transacción de BD antes de emitir.
- Si el nuevo status es `PREPARING`, `DELIVERED`, o `CANCELLED`: `isNew` no se modifica.

**Estados posibles que puede recibir el cliente en `order.status`:**

| Status      | Quién lo asigna | Puede aparecer en este evento |
|-------------|-----------------|-------------------------------|
| `PENDING`   | Sistema         | ✅ (COOK regresa a PENDING)  |
| `PREPARING` | COOK            | ✅                            |
| `READY`     | COOK            | ✅ (limpia isNew)             |
| `DELIVERED` | COOK            | ✅                            |
| `CANCELLED` | COOK            | ✅                            |
| `UPDATED`   | Sistema         | ❌ (no puede asignarse manualmente) |

**Quién recibe:** todos los usuarios conectados de la taquería (COOK y WAITER).

---

## Contratos de payload

### Payload de orden (todos los eventos)

El wrapper de todos los eventos es:

```typescript
{ order: OrderRealtimePayload }
```

### `OrderRealtimePayload`

```typescript
// src/realtime/interfaces/order-payload.interface.ts

interface OrderRealtimePayload {
  id: string;                    // UUID
  taqueriaId: string;            // UUID — siempre filtra a la room correcta
  waiterId: string;              // UUID del mesero que creó la orden
  tableNumber: string;           // Label de mesa (string, no numérico)
  status: OrderStatus;           // "PENDING" | "UPDATED" | "PREPARING" | "READY" | "DELIVERED" | "CANCELLED"
  revision: number;              // Empieza en 1, incrementa con cada PATCH /orders/:id
  priorityTimestamp: Date;       // ISO 8601 string en JSON. Actualizado en cada append.
  createdAt: Date;               // ISO 8601 string en JSON
  updatedAt: Date;               // ISO 8601 string en JSON
  plates: OrderPlatePayload[];   // Ordenados por plateNumber ASC
}
```

### `OrderPlatePayload`

```typescript
interface OrderPlatePayload {
  id: string;               // UUID
  plateNumber: number;      // Entero >= 1. Inmutable una vez creado.
  isClosed: boolean;        // Siempre false en la implementación actual
  createdInRevision: number; // Revisión en la que fue creado este plate
  createdAt: Date;           // ISO 8601 string en JSON
  items: OrderItemPayload[]; // Sin orden garantizado
}
```

### `OrderItemPayload`

```typescript
interface OrderItemPayload {
  id: string;                       // UUID
  productId: string;                // UUID del producto en el catálogo
  quantity: number;                 // Entero >= 1
  selectedComplements: string[];    // Array de strings. Vacío si no hay complementos.
  notes: string | null;             // null si no hay notas
  isNew: boolean;                   // true = highlight verde en cocina
  createdInRevision: number;        // Revisión en la que fue creado este item
  createdAt: Date;                  // ISO 8601 string en JSON
}
```

### Ejemplo JSON completo

```json
{
  "order": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "taqueriaId": "b3e2c1d4-8f4a-4b2e-9c1d-5a7e8f0b2c3d",
    "waiterId": "c4d5e6f7-g8h9-0123-bcde-f01234567891",
    "tableNumber": "Mesa 5",
    "status": "UPDATED",
    "revision": 2,
    "priorityTimestamp": "2024-01-15T14:30:00.000Z",
    "createdAt": "2024-01-15T14:00:00.000Z",
    "updatedAt": "2024-01-15T14:30:00.000Z",
    "plates": [
      {
        "id": "d5e6f7g8-h9i0-1234-cdef-012345678912",
        "plateNumber": 1,
        "isClosed": false,
        "createdInRevision": 1,
        "createdAt": "2024-01-15T14:00:00.000Z",
        "items": [
          {
            "id": "e6f7g8h9-i0j1-2345-def0-123456789123",
            "productId": "f7g8h9i0-j1k2-3456-ef01-234567890234",
            "quantity": 2,
            "selectedComplements": ["Salsa verde", "Limón"],
            "notes": "Sin cebolla",
            "isNew": false,
            "createdInRevision": 1,
            "createdAt": "2024-01-15T14:00:00.000Z"
          }
        ]
      },
      {
        "id": "g8h9i0j1-k2l3-4567-f012-345678901345",
        "plateNumber": 2,
        "isClosed": false,
        "createdInRevision": 2,
        "createdAt": "2024-01-15T14:30:00.000Z",
        "items": [
          {
            "id": "h9i0j1k2-l3m4-5678-0123-456789012456",
            "productId": "i0j1k2l3-m4n5-6789-1234-567890123567",
            "quantity": 1,
            "selectedComplements": [],
            "notes": null,
            "isNew": true,
            "createdInRevision": 2,
            "createdAt": "2024-01-15T14:30:00.000Z"
          }
        ]
      }
    ]
  }
}
```

---

## Garantías multi-tenant

### Garantía 1 — Room derivada del JWT

El `taqueriaId` de la room proviene **exclusivamente** del JWT, que el servidor firma y valida. El cliente nunca puede indicar a qué room unirse.

```typescript
// handleConnection — el cliente no tiene control sobre esto
const room = `taqueria:${user.taqueriaId}`;  // user viene del JWT
await client.join(room);
```

### Garantía 2 — Emisión dirigida a room específica

Los emitters siempre usan el `taqueriaId` de la orden almacenada en BD:

```typescript
// emitOrderCreated — taqueriaId viene de la orden en PostgreSQL
this.server.to(`taqueria:${taqueriaId}`).emit('order-created', { order });
```

Nunca se emite a `this.server.emit(...)` globalmente.

### Garantía 3 — Validación DB en cada conexión

Aunque el JWT sea válido, el servidor verifica en BD que el usuario existe y tiene taquería asignada. Un usuario eliminado de BD no puede conectarse, aunque tenga un JWT válido no expirado.

### Garantía 4 — Aislamiento de rooms en Socket.IO

Socket.IO garantiza que `server.to(room).emit(...)` solo llega a sockets suscritos a esa room específica. Un socket en `taqueria:A` nunca recibe eventos emitidos a `taqueria:B`.

### Escenario de ataque / mal uso

Si un cliente malintencionado intentara:
- Conectar con JWT de taquería A y escuchar eventos de taquería B → imposible: el servidor asigna la room automáticamente desde el JWT y el cliente no puede cambiarla.
- Emitir `join-taqueria` con otro `taqueriaId` → el handler no acepta argumentos; usa `client.data.user.taqueriaId` que viene del JWT.

---

## Reconexión

### Comportamiento del cliente Socket.IO

Socket.IO tiene reconexión automática habilitada por defecto en el cliente. No se requiere implementar lógica custom en el frontend.

**Parámetros por defecto del cliente:**
```js
const socket = io('http://localhost:3000', {
  auth: { token: accessToken },
  // Los siguientes son defaults de socket.io-client:
  reconnection: true,           // reconexión automática habilitada
  reconnectionAttempts: Infinity, // intenta indefinidamente
  reconnectionDelay: 1000,      // primer intento: 1s
  reconnectionDelayMax: 5000,   // máximo entre intentos: 5s
  randomizationFactor: 0.5,     // jitter para evitar thundering herd
});
```

### Qué ocurre en el servidor al reconectar

Cada reconexión ejecuta `handleConnection` nuevamente:

```
Reconexión del cliente
      ↓
handleConnection() — JWT re-validado
      ↓
findAuthUserById() — hit a PostgreSQL
      ↓
socket.data.user seteado nuevamente
      ↓
socket.join(`taqueria:${taqueriaId}`) — re-suscrito a la room
      ↓
El cliente recibe eventos normalmente
```

### Caso crítico — JWT expirado al reconectar

Si el JWT expira mientras el cliente está desconectado y el cliente intenta reconectar, el servidor llamará `verifyAsync(token)` que lanzará por expiración → `catch` → `client.disconnect()`. La reconexión automática seguirá intentando pero fallará en cada intento.

**Solución recomendada para el frontend:** detectar el evento `connect_error` o `disconnect` con razón `io server disconnect` y redirigir al login.

### Eventos de ciclo de vida del socket

```js
socket.on('connect', () => {
  // Conexión exitosa (inicial o tras reconexión)
  // El socket ya está en la room — puede recibir eventos
});

socket.on('disconnect', (reason) => {
  // Causas comunes:
  // 'io server disconnect' → el servidor llamó client.disconnect() (token inválido)
  // 'transport close'      → pérdida de conexión de red
  // 'ping timeout'         → sin respuesta del servidor
});

socket.on('connect_error', (error) => {
  // Error al establecer la conexión
  console.error(error.message);
});
```

### Eventos perdidos durante desconexión

**El servidor no almacena ni reproduce eventos perdidos.** Si el cliente estuvo desconectado mientras se emitieron eventos, no los recibirá al reconectar.

**Solución recomendada:** al detectar el evento `connect` (que indica una reconexión), hacer una llamada REST `GET /orders` para obtener el estado actual completo y sincronizar el store.

```js
socket.on('connect', async () => {
  if (socket.recovered === false) {
    // Reconexión — refrescar estado desde REST
    const orders = await fetchOrders(); // GET /orders
    store.setOrders(orders);
  }
});
```

---

## Manejo de errores

### Errores de conexión (handleConnection)

El servidor no emite un evento de error descriptivo al cliente antes de desconectar. Solo se desconecta. Los detalles quedan en los logs del servidor.

| Error en servidor                       | Log del servidor                                    | Lo que ve el cliente      |
|-----------------------------------------|-----------------------------------------------------|---------------------------|
| Sin token                               | `Connection rejected — no token: <socketId>`        | evento `disconnect`       |
| JWT inválido/expirado                   | `Connection rejected — invalid token: <socketId>`   | evento `disconnect`       |
| Usuario no encontrado en BD             | `Connection rejected — invalid user: <socketId>`    | evento `disconnect`       |
| Usuario sin taquería                    | `Connection rejected — invalid user: <socketId>`    | evento `disconnect`       |

### Errores en emisión de eventos (emitOrder*)

Cada método de emisión tiene manejo de error propio:

```typescript
try {
  this.server.to(`taqueria:${taqueriaId}`).emit('order-created', { order });
} catch (error) {
  this.logger.error(`Failed to emit order-created order=${order.id}`, error);
  // No lanza excepción — la BD no se revierte
}
```

Si el emit falla:
- La transacción de BD **no se revierte**.
- La respuesta REST al cliente HTTP es exitosa.
- El error queda registrado en los logs del servidor.
- Los clientes WebSocket simplemente no reciben el evento.

### `WsException` en `join-taqueria`

`RealtimeAuthGuard` lanza `WsException('Unauthorized')` si `socket.data.user` no existe. En la práctica esto no debería ocurrir: si `handleConnection` falló, el socket fue desconectado antes de poder emitir cualquier evento.

---

## Guía de integración React Native

### Dependencias

```bash
npx expo install socket.io-client
# o con pnpm:
pnpm add socket.io-client
```

Verificar que la versión sea compatible con Socket.IO v4 del servidor (el backend usa `socket.io@^4.8.3`).

### Crear la conexión

```typescript
import { io, Socket } from 'socket.io-client';

const BACKEND_URL = 'http://192.168.1.100:3000'; // tu IP local o host de producción

let socket: Socket | null = null;

export function connectSocket(accessToken: string): Socket {
  if (socket?.connected) return socket;

  socket = io(BACKEND_URL, {
    auth: { token: accessToken },
    // No configurar transports — Socket.IO elige automáticamente
  });

  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}
```

### Escuchar eventos de órdenes

```typescript
function setupOrderListeners(socket: Socket, store: OrderStore): void {
  // Limpiar listeners previos para evitar duplicados
  socket.off('order-created');
  socket.off('order-updated');
  socket.off('order-status-changed');

  socket.on('order-created', ({ order }) => {
    store.addOrder(order);
  });

  socket.on('order-updated', ({ order }) => {
    store.replaceOrder(order.id, order);
  });

  socket.on('order-status-changed', ({ order }) => {
    store.replaceOrder(order.id, order);
  });
}
```

### Manejar ciclo de vida de la conexión

```typescript
function setupConnectionHandlers(
  socket: Socket,
  store: OrderStore,
  onDisconnect: () => void,
): void {
  socket.on('connect', async () => {
    console.log('Socket conectado:', socket.id);
    // Refrescar estado completo desde REST al reconectar
    const orders = await api.getOrders();
    store.setOrders(orders);
    // Re-registrar listeners de órdenes
    setupOrderListeners(socket, store);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket desconectado:', reason);
    if (reason === 'io server disconnect') {
      // El servidor rechazó la conexión (token inválido/expirado)
      onDisconnect(); // redirigir al login
    }
    // Para otros motivos, Socket.IO reconecta automáticamente
  });

  socket.on('connect_error', (error) => {
    console.error('Error de conexión:', error.message);
  });
}
```

### Logout

```typescript
function handleLogout(): void {
  // 1. Desconectar socket primero
  disconnectSocket();
  // 2. Limpiar token
  await SecureStore.deleteItemAsync('accessToken');
  // 3. Limpiar store
  store.clear();
  // 4. Navegar a login
  navigation.navigate('Login');
}
```

### Flujo completo de pantalla Kitchen (COOK)

```typescript
// En el componente KitchenScreen
useEffect(() => {
  let sock: Socket;

  async function init() {
    const token = await SecureStore.getItemAsync('accessToken');
    if (!token) return;

    // Cargar estado inicial desde REST
    const orders = await api.getOrders(); // GET /orders
    store.setOrders(orders);

    // Conectar socket
    sock = connectSocket(token);
    setupConnectionHandlers(sock, store, handleLogout);
    setupOrderListeners(sock, store);
  }

  init();

  return () => {
    // Limpiar listeners al desmontar el componente
    // No desconectar el socket — mantenerlo vivo globalmente
    sock?.off('order-created');
    sock?.off('order-updated');
    sock?.off('order-status-changed');
  };
}, []);
```

---

## Buenas prácticas frontend

### Una sola conexión global

Mantener una única instancia de socket para toda la app. No crear nuevas conexiones en cada pantalla o componente.

```typescript
// Incorrecto ❌
useEffect(() => {
  const sock = io(BACKEND_URL, { auth: { token } });
  // ...
  return () => sock.disconnect(); // se desconecta al desmontar la pantalla
}, []);

// Correcto ✅
// Inicializar en el root de la app, reutilizar en todas las pantallas
const socket = connectSocket(token); // singleton
```

### Limpiar listeners sin desconectar

Al salir de una pantalla, limpiar listeners del componente sin desconectar el socket:

```typescript
// Correcto — limpiar listeners específicos, no desconectar
return () => {
  socket.off('order-created', handleOrderCreated);
  socket.off('order-updated', handleOrderUpdated);
};

// Incorrecto — no desconectar al desmontar una pantalla
return () => {
  socket.disconnect(); // pierde la conexión global
};
```

### Actualización inmediata del store desde el payload

El payload ya contiene la orden completa. No hacer `GET /orders/:id` adicional:

```typescript
// Correcto ✅ — usar el payload directamente
socket.on('order-updated', ({ order }) => {
  store.replaceOrder(order.id, order); // datos completos, sin fetch adicional
});

// Incorrecto ❌ — llamada REST innecesaria
socket.on('order-updated', ({ order }) => {
  const freshOrder = await api.getOrderById(order.id); // redundante
  store.replaceOrder(order.id, freshOrder);
});
```

### Sincronizar al reconectar

Al detectar una reconexión, cargar el estado completo desde REST:

```typescript
socket.on('connect', async () => {
  // Se ejecuta tanto en conexión inicial como en reconexiones
  const orders = await api.getOrders();
  store.setOrders(orders); // reemplazar todo el estado
});
```

### Highlight `isNew` — cuándo mostrar en verde

El frontend decide cuándo mostrar el highlight verde basándose en el payload recibido:

```typescript
function shouldShowGreenHighlight(item: OrderItemPayload, orderStatus: string): boolean {
  return item.isNew && (orderStatus === 'UPDATED' || orderStatus === 'PREPARING');
}
```

Al recibir `order-status-changed` con `status: 'READY'`, el payload ya tiene `isNew: false` en todos los items — el servidor limpia el flag en la misma transacción. No hay que calcular nada.

### No filtrar eventos por rol en el cliente

El backend envía todos los eventos a todos los usuarios de la taquería. El frontend debe manejar esto:

```typescript
// Ejemplo: WAITER solo muestra sus propias órdenes
socket.on('order-created', ({ order }) => {
  if (userRole === 'WAITER' && order.waiterId !== currentUserId) {
    return; // ignorar órdenes de otros meseros
  }
  store.addOrder(order);
});

// COOK muestra todas las órdenes
socket.on('order-created', ({ order }) => {
  store.addOrder(order);
  store.sortByKitchenPriority(); // mantener orden de cocina local
});
```

### Verificar `join-taqueria` en debugging

Para verificar que la conexión y autenticación funcionaron:

```typescript
socket.on('connect', () => {
  socket.emit('join-taqueria', (response) => {
    console.log('Room confirmada:', response.room);
    // "taqueria:b3e2c1d4-..."
  });
});
```

---

*Generado analizando el código fuente del backend. Fuentes: `src/realtime/**`, `src/orders/orders.service.ts`, `src/realtime/interfaces/`, `src/auth/auth.module.ts`. Última actualización: ETAPA 4.4.*
