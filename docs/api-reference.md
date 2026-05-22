# TacosManager API Reference

Version: 1.0

Base URL

```txt
/api
```

---

# Authentication

---

## POST /auth/register

Registro inteligente.

Responsabilidades:

- detectar coincidencias de taquería
- crear nueva taquería
- unir usuario a taquería existente

---

## POST /auth/login

Login de usuario.

Body:

```json
{
  "email": "user@test.com",
  "password": "123456"
}
```

Response:

```json
{
  "accessToken": "jwt"
}
```

---

# Products

Todas las rutas requieren JWT.

---

## GET /products

Obtiene catálogo de la taquería actual.

Role:

- COOK
- WAITER

---

## POST /products

Crear producto.

Role:

- COOK

---

## GET /products/:id

Obtener producto.

Role:

- COOK
- WAITER

---

## PATCH /products/:id

Actualizar producto.

Role:

- COOK

---

## DELETE /products/:id

Eliminar producto.

Role:

- COOK

---

# Orders

Todas las rutas requieren JWT.

---

## POST /orders

Crear pedido.

Role:

- WAITER

Permite:

- múltiples plates
- múltiples items
- complementos
- notas opcionales

---

## GET /orders

COOK:

Obtiene todos los pedidos de la taquería.

WAITER:

Obtiene únicamente sus pedidos.

---

## GET /orders/:id

Obtiene detalle de pedido.

Ownership obligatorio.

---

## PATCH /orders/:id

Editar pedido.

Regla:

Append Only.

Permitido:

- agregar plates
- agregar items

Prohibido:

- modificar historial
- modificar items anteriores
- modificar plates anteriores

---

## PATCH /orders/:id/status

Actualizar estado.

Role:

- COOK

Estados válidos:

```txt
UPDATED
PENDING
PREPARING
READY
DELIVERED
CANCELLED
```

---

# Response Rules

Nunca retornar:

- passwords
- hashes
- datos sensibles
- información de otras taquerías

---

# Ownership Rules

Todas las consultas deben validar:

```txt
request.user.taqueriaId
```

---

# Multi-Tenant Rules

Usuarios únicamente pueden acceder a:

```txt
su propia taquería
```

---

# Kitchen Queue Rules

Orden global:

```txt
UPDATED
PENDING
PREPARING
READY
DELIVERED
CANCELLED
```

---

Dentro de cada grupo:

FIFO

```txt
createdAt ASC
```

---

# Highlight Rules

Item nuevo:

```txt
isNew = true
```

Visible en:

```txt
UPDATED
PREPARING
```

Desaparece en:

```txt
READY
```

---

# WebSocket — Socket.IO

Puerto: mismo que la API REST (3000 por defecto).

Protocolo: Socket.IO v4.

---

## Conexión

El cliente debe enviar el JWT en el handshake:

```js
// Opción A — recomendada (React Native)
const socket = io('http://localhost:3000', {
  auth: { token: '<jwt>' }
});

// Opción B — header Authorization
const socket = io('http://localhost:3000', {
  extraHeaders: { Authorization: 'Bearer <jwt>' }
});
```

JWT inválido o ausente → conexión rechazada automáticamente.

---

## Rooms

Al conectarse exitosamente, el usuario es unido automáticamente a:

```txt
taqueria:<taqueriaId>
```

Usuarios de diferentes taquerías nunca comparten room.

---

## Eventos del cliente → servidor

### `join-taqueria`

Confirma la room activa del usuario autenticado.

```js
socket.emit('join-taqueria');
// o con callback
socket.emit('join-taqueria', (response) => {
  console.log(response.data.room); // "taqueria:<id>"
});
```

Respuesta:

```json
{
  "event": "join-taqueria",
  "data": {
    "room": "taqueria:<taqueriaId>",
    "taqueriaId": "<taqueriaId>",
    "restaurantCode": "TM-4821"
  }
}
```

---

## Eventos del servidor → cliente

### `order-created`

Emitido a `taqueria:<taqueriaId>` cuando un WAITER crea un pedido nuevo (POST /orders).

```js
socket.on('order-created', ({ order }) => {
  // order contiene la orden completa
});
```

Payload:

```json
{
  "order": {
    "id": "uuid",
    "taqueriaId": "uuid",
    "waiterId": "uuid",
    "tableNumber": "Mesa 3",
    "status": "PENDING",
    "revision": 1,
    "priorityTimestamp": "2024-01-01T12:00:00.000Z",
    "createdAt": "2024-01-01T12:00:00.000Z",
    "updatedAt": "2024-01-01T12:00:00.000Z",
    "plates": [
      {
        "id": "uuid",
        "plateNumber": 1,
        "isClosed": false,
        "createdInRevision": 1,
        "createdAt": "2024-01-01T12:00:00.000Z",
        "items": [
          {
            "id": "uuid",
            "productId": "uuid",
            "quantity": 2,
            "selectedComplements": ["Salsa verde"],
            "notes": null,
            "isNew": false,
            "createdInRevision": 1,
            "createdAt": "2024-01-01T12:00:00.000Z"
          }
        ]
      }
    ]
  }
}
```

---

### `order-updated`

Emitido a `taqueria:<taqueriaId>` cuando un WAITER agrega plates/items (PATCH /orders/:id).

El status cambia automáticamente a `UPDATED`. La revisión se incrementa.
Los nuevos items tienen `isNew: true` para highlight verde en cocina.

```js
socket.on('order-updated', ({ order }) => {
  // order contiene la orden completa con todos los plates (históricos + nuevos)
});
```

Payload: misma estructura que `order-created`. Campos clave:

```json
{
  "order": {
    "status": "UPDATED",
    "revision": 2,
    "plates": [
      { "createdInRevision": 1, "items": [{ "isNew": false }] },
      { "createdInRevision": 2, "items": [{ "isNew": true }] }
    ]
  }
}
```

---

### `order-status-changed`

Emitido a `taqueria:<taqueriaId>` cuando un COOK cambia el estado (PATCH /orders/:id/status).

Al transicionar a `READY`, todos los items con `isNew: true` se limpian automáticamente.

```js
socket.on('order-status-changed', ({ order }) => {
  // order contiene la orden con el nuevo status y isNew actualizado
});
```

Payload: misma estructura que `order-created`. Campo clave:

```json
{
  "order": {
    "status": "PREPARING"
  }
}
```

---

End of Document