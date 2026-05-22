# TacosManager — Backend API Reference

> **Fuente de verdad:** este documento fue generado analizando el código fuente del backend.
> Refleja el estado real de la implementación, no documentación teórica.

---

## Índice

1. [Overview](#overview)
2. [Autenticación](#autenticación)
3. [Roles y permisos](#roles-y-permisos)
4. [Headers comunes](#headers-comunes)
5. [Multi-tenancy](#multi-tenancy)
6. [Endpoints — Auth](#endpoints--auth)
7. [Endpoints — Products](#endpoints--products)
8. [Endpoints — Orders](#endpoints--orders)
9. [Realtime — Socket.IO](#realtime--socketio)
10. [Errores comunes](#errores-comunes)
11. [Guía de integración React Native](#guía-de-integración-react-native)

---

## Overview

**Backend:** NestJS 11 con arquitectura modular.
**ORM:** Prisma 7 sobre PostgreSQL.
**Autenticación:** JWT (Bearer token), expiración 1 día.
**Realtime:** Socket.IO v4 en el mismo puerto que REST.
**Validación:** `ValidationPipe` global con `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`. Enviar campos desconocidos devuelve `400`.

**Base URL:**
```
http://<host>:3000
```

No hay prefijo global (`/api`). Los endpoints son directamente `/auth/...`, `/products/...`, `/orders/...`.

---

## Autenticación

Todos los endpoints protegidos requieren el header:

```
Authorization: Bearer <accessToken>
```

El JWT contiene:
```json
{
  "sub": "<userId>",
  "email": "user@example.com",
  "role": "WAITER | COOK",
  "taqueriaId": "<uuid>"
}
```

En cada request el backend hace una consulta a BD para validar que el usuario sigue existiendo. Si el usuario fue eliminado, el token queda inválido aunque no haya expirado.

---

## Roles y permisos

| Acción                                | WAITER | COOK |
|---------------------------------------|--------|------|
| `POST /auth/register`                 | —      | —    |
| `POST /auth/login`                    | —      | —    |
| `GET /auth/me`                        | ✅     | ✅   |
| `GET /products`                       | ✅     | ✅   |
| `GET /products/:id`                   | ✅     | ✅   |
| `POST /products`                      |        | ✅   |
| `PATCH /products/:id`                 |        | ✅   |
| `DELETE /products/:id`                |        | ✅   |
| `POST /orders`                        | ✅     |      |
| `GET /orders` (solo los propios)      | ✅     |      |
| `GET /orders` (todos los de la taquería) |     | ✅   |
| `GET /orders/:id`                     | ✅ (propios) | ✅ |
| `PATCH /orders/:id` (append only)     | ✅     |      |
| `PATCH /orders/:id/status`            |        | ✅   |

---

## Headers comunes

| Header          | Valor                     | Cuándo requerido          |
|-----------------|---------------------------|---------------------------|
| `Authorization` | `Bearer <accessToken>`    | Todos los endpoints protegidos |
| `Content-Type`  | `application/json`        | Requests con body (POST, PATCH) |

---

## Multi-tenancy

- Cada usuario pertenece a exactamente una taquería (`taqueriaId` en la BD y en el JWT).
- El backend **nunca acepta** `taqueriaId` del cliente — siempre lo toma del JWT.
- Todas las queries filtran automáticamente por `taqueriaId`.
- Un usuario no puede leer ni modificar datos de otra taquería.

---

## Endpoints — Auth

### `POST /auth/register`

Registro en 2 fases. La fase 1 es exploratoria (sin efectos secundarios). La fase 2 crea el usuario.

**No requiere JWT.**

---

#### Fase 1 — Búsqueda (sin crear usuario)

Enviar únicamente: `taqueriaName`, `name`, `email`, `password`, `role`.

**Request:**
```json
{
  "taqueriaName": "Taquería El Güero",
  "name": "Roberto Carrasco",
  "email": "roberto@example.com",
  "password": "mipassword123",
  "role": "WAITER"
}
```

**Response — 0 coincidencias (puede crear nueva taquería):**
```json
{
  "taqueriaMatches": 0,
  "canCreateNewTaqueria": true,
  "requiresTaqueriaInfo": true,
  "message": "No encontramos una taquería con este nombre. Puedes crear una nueva."
}
```

**Response — 1 coincidencia:**
```json
{
  "taqueriaMatches": 1,
  "canJoinExistingTaqueria": true,
  "canCreateNewTaqueria": true,
  "taquerias": [
    {
      "id": "uuid",
      "name": "Taquería El Güero",
      "restaurantCode": "TM-4821"
    }
  ],
  "message": "Encontramos una taquería con este nombre."
}
```

**Response — N coincidencias:**
```json
{
  "taqueriaMatches": 3,
  "canJoinExistingTaqueria": true,
  "canCreateNewTaqueria": true,
  "taquerias": [
    { "id": "uuid", "name": "Taquería El Güero", "restaurantCode": "TM-4821" },
    { "id": "uuid", "name": "Taquería El Güero", "restaurantCode": "TM-2310" }
  ],
  "message": "Encontramos varias taquerías con este nombre."
}
```

---

#### Fase 2A — Unirse a taquería existente

Agregar `confirmJoinExistingTaqueria: true` y `selectedRestaurantCode`.

**Request:**
```json
{
  "taqueriaName": "Taquería El Güero",
  "name": "Roberto Carrasco",
  "email": "roberto@example.com",
  "password": "mipassword123",
  "role": "WAITER",
  "confirmJoinExistingTaqueria": true,
  "selectedRestaurantCode": "TM-4821"
}
```

**Response `201`:**
```json
{
  "accessToken": "<jwt>",
  "user": {
    "id": "uuid",
    "name": "Roberto Carrasco",
    "email": "roberto@example.com",
    "role": "WAITER",
    "taqueriaId": "uuid"
  },
  "taqueria": {
    "id": "uuid",
    "name": "Taquería El Güero",
    "restaurantCode": "TM-4821",
    "phone": null,
    "address": null,
    "city": null,
    "state": null,
    "createdAt": "2024-01-01T12:00:00.000Z"
  }
}
```

---

#### Fase 2B — Crear nueva taquería

Agregar `createNewTaqueria: true` y opcionalmente `taqueriaData`.

**Request:**
```json
{
  "taqueriaName": "Taquería El Güero",
  "name": "Roberto Carrasco",
  "email": "roberto@example.com",
  "password": "mipassword123",
  "role": "COOK",
  "createNewTaqueria": true,
  "taqueriaData": {
    "phone": "+52 55 1234 5678",
    "address": "Av. Insurgentes 100",
    "city": "CDMX",
    "state": "Ciudad de México"
  }
}
```

`taqueriaData` es opcional. Sus campos son todos opcionales.

**Response `201`:** misma estructura que Fase 2A.

---

#### Errores de registro

| Código | Causa |
|--------|-------|
| `400`  | `confirmJoinExistingTaqueria` y `createNewTaqueria` son `true` simultáneamente |
| `400`  | `confirmJoinExistingTaqueria: true` sin `selectedRestaurantCode` |
| `400`  | `createNewTaqueria: true` sin `taqueriaData` |
| `400`  | `selectedRestaurantCode` inválido o no encontrado |
| `400`  | `taqueriaData` presente con `confirmJoinExistingTaqueria: true` |
| `400`  | `selectedRestaurantCode` presente con `createNewTaqueria: true` |
| `409`  | El email ya está registrado |

---

#### Validaciones de campos (register)

| Campo                        | Tipo      | Obligatorio | Restricciones                    |
|------------------------------|-----------|-------------|----------------------------------|
| `taqueriaName`               | `string`  | ✅          | `@IsNotEmpty`                    |
| `name`                       | `string`  | ✅          | `@IsNotEmpty`                    |
| `email`                      | `string`  | ✅          | formato email válido             |
| `password`                   | `string`  | ✅          | mínimo 6 caracteres              |
| `role`                       | `enum`    | ✅          | `"WAITER"` o `"COOK"`           |
| `confirmJoinExistingTaqueria`| `boolean` | ❌          | —                                |
| `createNewTaqueria`          | `boolean` | ❌          | —                                |
| `selectedRestaurantCode`     | `string`  | ❌          | requerido si `confirmJoin: true` |
| `taqueriaData`               | `object`  | ❌          | requerido si `createNew: true`   |
| `taqueriaData.phone`         | `string`  | ❌          | —                                |
| `taqueriaData.address`       | `string`  | ❌          | —                                |
| `taqueriaData.city`          | `string`  | ❌          | —                                |
| `taqueriaData.state`         | `string`  | ❌          | —                                |

---

### `POST /auth/login`

**No requiere JWT.**

**Request:**
```json
{
  "email": "roberto@example.com",
  "password": "mipassword123"
}
```

**Response `200`:**
```json
{
  "accessToken": "<jwt>",
  "user": {
    "id": "uuid",
    "name": "Roberto Carrasco",
    "email": "roberto@example.com",
    "role": "WAITER",
    "taqueriaId": "uuid"
  },
  "taqueria": {
    "id": "uuid",
    "name": "Taquería El Güero",
    "restaurantCode": "TM-4821",
    "phone": null,
    "address": null,
    "city": null,
    "state": null,
    "createdAt": "2024-01-01T12:00:00.000Z"
  }
}
```

**Errores:**

| Código | Causa |
|--------|-------|
| `400`  | Validación de campos (email inválido, password < 6 chars) |
| `401`  | Credenciales incorrectas (email no existe o password inválido) |
| `400`  | Usuario sin taquería asignada (estado corrupto) |

---

### `GET /auth/me`

Retorna el perfil completo del usuario autenticado.

**Requiere JWT.** Roles: `WAITER`, `COOK`.

**Response `200`:**
```json
{
  "id": "uuid",
  "name": "Roberto Carrasco",
  "email": "roberto@example.com",
  "role": "WAITER",
  "taqueriaId": "uuid",
  "taqueria": {
    "id": "uuid",
    "name": "Taquería El Güero",
    "restaurantCode": "TM-4821",
    "phone": null,
    "address": null,
    "city": null,
    "state": null,
    "createdAt": "2024-01-01T12:00:00.000Z"
  }
}
```

La respuesta no incluye `password`.

**Errores:**

| Código | Causa |
|--------|-------|
| `401`  | Token ausente, inválido o expirado |
| `403`  | Rol insuficiente |

---

## Endpoints — Products

Todos los endpoints de productos requieren JWT. El filtrado por `taqueriaId` es automático.

---

### `GET /products`

Retorna el catálogo completo de la taquería, ordenado por `createdAt DESC`.

**Requiere JWT.** Roles: `WAITER`, `COOK`.

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "name": "Taco al Pastor",
    "price": 25.00,
    "imageUrl": "https://example.com/taco.jpg",
    "complements": ["Salsa verde", "Limón"],
    "createdAt": "2024-01-01T12:00:00.000Z"
  }
]
```

`imageUrl` puede ser `null`. `complements` es un array de strings (puede estar vacío `[]`).

---

### `GET /products/:id`

**Requiere JWT.** Roles: `WAITER`, `COOK`.

**Path params:** `id` (uuid del producto).

**Response `200`:** mismo shape que un elemento de `GET /products`.

**Errores:**

| Código | Causa |
|--------|-------|
| `404`  | Producto no encontrado o pertenece a otra taquería |

---

### `POST /products`

**Requiere JWT.** Rol: `COOK` exclusivamente.

**Request:**
```json
{
  "name": "Taco al Pastor",
  "price": 25.00,
  "imageUrl": "https://example.com/taco.jpg",
  "complements": ["Salsa verde", "Limón", "Cilantro"]
}
```

**Validaciones:**

| Campo         | Tipo      | Obligatorio | Restricciones                              |
|---------------|-----------|-------------|---------------------------------------------|
| `name`        | `string`  | ✅          | `@IsNotEmpty`. Se aplica `.trim()`.         |
| `price`       | `number`  | ✅          | Mínimo `0.01`, máximo 2 decimales           |
| `imageUrl`    | `string`  | ❌          | Debe ser URL válida si se envía             |
| `complements` | `string[]`| ❌          | Máximo 3 elementos                          |

**Response `201`:**
```json
{
  "id": "uuid",
  "name": "Taco al Pastor",
  "price": 25.00,
  "imageUrl": "https://example.com/taco.jpg",
  "complements": ["Salsa verde", "Limón", "Cilantro"],
  "createdAt": "2024-01-01T12:00:00.000Z"
}
```

**Errores:**

| Código | Causa |
|--------|-------|
| `400`  | Validación de campos fallida |
| `400`  | Más de 3 complementos |
| `401`  | Token inválido |
| `403`  | El usuario no es COOK |

---

### `PATCH /products/:id`

Actualización parcial. Solo los campos enviados se modifican.

**Requiere JWT.** Rol: `COOK`.

**Request:** todos los campos son opcionales.
```json
{
  "name": "Taco al Pastor Especial",
  "price": 28.50,
  "imageUrl": "https://example.com/nuevo.jpg",
  "complements": ["Salsa verde"]
}
```

**Validaciones:** mismas restricciones que `POST /products` pero todos opcionales.

**Response `200`:** mismo shape que `POST /products` response.

**Errores:**

| Código | Causa |
|--------|-------|
| `400`  | Validación de campos |
| `403`  | No es COOK o el producto pertenece a otra taquería |
| `404`  | Producto no encontrado |

---

### `DELETE /products/:id`

**Requiere JWT.** Rol: `COOK`.

**Response `200`:**
```json
{
  "message": "Product deleted successfully"
}
```

**Errores:**

| Código | Causa |
|--------|-------|
| `403`  | No es COOK o producto de otra taquería |
| `404`  | Producto no encontrado |

---

## Endpoints — Orders

Todos los endpoints de órdenes requieren JWT. El control de roles se hace en la capa de servicio (no en el decorador del controller): un COOK que llame a `POST /orders` recibirá `403`.

---

### Estructura completa de una orden

Todas las respuestas de órdenes siguen esta forma:

```json
{
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
          "notes": "Sin cebolla",
          "isNew": false,
          "createdInRevision": 1,
          "createdAt": "2024-01-01T12:00:00.000Z"
        }
      ]
    }
  ]
}
```

Los plates se ordenan por `plateNumber ASC`.

---

### Estados de orden (`OrderStatus`)

| Estado      | Quién lo asigna               | Descripción                                        |
|-------------|-------------------------------|----------------------------------------------------|
| `PENDING`   | Sistema (al crear)            | Orden nueva, sin atender                           |
| `UPDATED`   | Sistema (al hacer append)     | El mesero agregó items. **No se puede asignar manualmente.** |
| `PREPARING` | COOK vía `PATCH /orders/:id/status` | En preparación                              |
| `READY`     | COOK vía `PATCH /orders/:id/status` | Lista para entregar. Limpia `isNew` automáticamente. |
| `DELIVERED` | COOK vía `PATCH /orders/:id/status` | Entregada                                   |
| `CANCELLED` | COOK vía `PATCH /orders/:id/status` | Cancelada                                   |

**`UPDATED` nunca puede enviarse en `PATCH /orders/:id/status`** — el servidor lo rechaza con `400` a nivel de DTO y de servicio.

---

### `isNew` — highlight verde

| Situación                          | `isNew`  |
|------------------------------------|----------|
| Item creado en `POST /orders`      | `false`  |
| Item creado en `PATCH /orders/:id` | `true`   |
| Orden cambia a `READY`             | `false` (todos los items de la orden, en la misma transacción) |

El frontend debe mostrar highlight verde cuando `isNew === true` y el status es `UPDATED` o `PREPARING`.

---

### `revision` y `createdInRevision`

- `revision` empieza en `1` al crear la orden, se incrementa en cada `PATCH /orders/:id`.
- `createdInRevision` en un plate/item indica en qué revisión fue creado.
- El frontend puede usar `createdInRevision` para saber qué plates/items son "nuevos" de una actualización específica.

---

### `POST /orders`

**Requiere JWT.** Rol: `WAITER` exclusivamente.

**Request:**
```json
{
  "tableNumber": "Mesa 3",
  "plates": [
    {
      "plateNumber": 1,
      "items": [
        {
          "productId": "uuid",
          "quantity": 2,
          "selectedComplements": ["Salsa verde"],
          "notes": "Sin cebolla"
        }
      ]
    }
  ]
}
```

**Validaciones:**

| Campo                              | Tipo       | Obligatorio | Restricciones                              |
|------------------------------------|------------|-------------|--------------------------------------------|
| `tableNumber`                      | `string`   | ✅          | `@IsNotEmpty`. Se aplica `.trim()`.        |
| `plates`                           | `array`    | ✅          | Mínimo 1 elemento                          |
| `plates[].plateNumber`             | `integer`  | ✅          | Mínimo `1`                                 |
| `plates[].items`                   | `array`    | ✅          | Mínimo 1 elemento                          |
| `plates[].items[].productId`       | `string`   | ✅          | UUID válido, debe pertenecer a la taquería |
| `plates[].items[].quantity`        | `integer`  | ✅          | Mínimo `1`                                 |
| `plates[].items[].selectedComplements` | `string[]` | ❌    | —                                          |
| `plates[].items[].notes`           | `string`   | ❌          | —                                          |

**Response `201`:** estructura completa de la orden.

La orden se crea con `status: PENDING`, `revision: 1`, todos los items con `isNew: false`.

**Errores:**

| Código | Causa |
|--------|-------|
| `400`  | Validación de campos |
| `400`  | Algún `productId` no existe o no pertenece a la taquería |
| `403`  | El usuario es COOK |

---

### `GET /orders`

**Requiere JWT.** Roles: `WAITER`, `COOK`. Comportamiento distinto por rol.

**COOK — todas las órdenes de la taquería, ordenadas por prioridad de cocina:**

Orden de prioridad:
1. `UPDATED`
2. `PENDING`
3. `PREPARING`
4. `READY`
5. `DELIVERED`
6. `CANCELLED`

Dentro de cada grupo: FIFO por `priorityTimestamp ASC`. La orden que lleva más tiempo esperando en su estado aparece primero.

**WAITER — solo sus propias órdenes, ordenadas por `createdAt DESC`.**

**Response `200`:** array de órdenes con estructura completa.

```json
[
  { /* orden completa */ },
  { /* orden completa */ }
]
```

---

### `GET /orders/:id`

**Requiere JWT.** Roles: `WAITER` (solo propias), `COOK` (cualquiera de la taquería).

**Path params:** `id` (uuid).

**Response `200`:** estructura completa de la orden.

**Errores:**

| Código | Causa |
|--------|-------|
| `403`  | WAITER intentando ver la orden de otro mesero |
| `404`  | Orden no encontrada o pertenece a otra taquería |

---

### `PATCH /orders/:id`

**Append-only editing.** Solo se pueden agregar **nuevos** plates con **nuevos** plateNumbers. Los plates e items existentes son inmutables.

**Requiere JWT.** Rol: `WAITER` exclusivamente. Solo el mesero que creó la orden.

**Request:**
```json
{
  "plates": [
    {
      "plateNumber": 2,
      "items": [
        {
          "productId": "uuid",
          "quantity": 1,
          "selectedComplements": [],
          "notes": null
        }
      ]
    }
  ]
}
```

El campo `plateNumber` debe ser un número que **no exista** en la orden actual. Intentar usar un `plateNumber` ya existente devuelve `400`.

**Validaciones:** mismas que `POST /orders` para plates e items, salvo que no hay `tableNumber`.

**Response `200`:** estructura completa de la orden actualizada.

El status cambia automáticamente a `UPDATED`. La revisión se incrementa. Los nuevos items tienen `isNew: true`. `priorityTimestamp` se actualiza a `now()`.

**Errores:**

| Código | Causa |
|--------|-------|
| `400`  | `plateNumber` ya existente en la orden |
| `400`  | `productId` inválido para la taquería |
| `403`  | El usuario es COOK |
| `403`  | El WAITER no es el dueño de la orden |
| `404`  | Orden no encontrada |

---

### `PATCH /orders/:id/status`

**Requiere JWT.** Rol: `COOK` exclusivamente.

**Request:**
```json
{
  "status": "PREPARING"
}
```

Valores válidos: `PENDING`, `PREPARING`, `READY`, `DELIVERED`, `CANCELLED`.
`UPDATED` es rechazado con `400`.

**Comportamiento especial al cambiar a `READY`:**
Si el status actual es `UPDATED` o `PREPARING`, todos los items de la orden con `isNew: true` se limpian a `false` en la misma transacción antes de retornar.

**Response `200`:** estructura completa de la orden con el nuevo status.

**Errores:**

| Código | Causa |
|--------|-------|
| `400`  | `status: "UPDATED"` enviado manualmente |
| `400`  | Validación de enum (valor inválido) |
| `403`  | El usuario es WAITER |
| `404`  | Orden no encontrada o de otra taquería |

---

## Realtime — Socket.IO

**Versión:** Socket.IO v4.
**Puerto:** mismo que REST (3000 por defecto).
**Protocolo:** WebSocket con long-polling como fallback.

---

### Conexión

El cliente debe enviar el JWT en el handshake. Dos formas:

```js
// Opción A — recomendada
const socket = io('http://host:3000', {
  auth: { token: '<accessToken>' }
});

// Opción B — header Authorization
const socket = io('http://host:3000', {
  extraHeaders: { Authorization: 'Bearer <accessToken>' }
});
```

El servidor valida el JWT en `handleConnection`. Si el token es inválido o ausente, el servidor llama a `socket.disconnect()` inmediatamente.

---

### Rooms multi-tenant

Al conectarse exitosamente, el usuario es unido automáticamente a:

```
taqueria:<taqueriaId>
```

El `taqueriaId` proviene del JWT, nunca del cliente. Usuarios de distintas taquerías nunca comparten room.

---

### Contexto del socket autenticado

Una vez conectado, el socket tiene disponible en `socket.data.user`:
```ts
{
  id: string;
  name: string;
  email: string;
  role: "WAITER" | "COOK";
  taqueriaId: string;
  restaurantCode: string;
}
```

---

### Eventos — Cliente → Servidor

#### `join-taqueria`

Confirma la room activa del usuario. Útil para verificar que la conexión está viva.

```js
socket.emit('join-taqueria', (response) => {
  console.log(response);
});
```

**Response:**
```json
{
  "event": "join-taqueria",
  "data": {
    "room": "taqueria:<taqueriaId>",
    "taqueriaId": "<uuid>",
    "restaurantCode": "TM-4821"
  }
}
```

---

### Eventos — Servidor → Cliente

Todos los eventos se emiten **únicamente** a la room `taqueria:<taqueriaId>`. Nunca globalmente.

Todos los eventos emiten la **orden completa** — el frontend puede actualizar su estado local sin hacer llamadas REST adicionales.

---

#### `order-created`

Emitido cuando un WAITER crea una nueva orden (`POST /orders`).

```js
socket.on('order-created', ({ order }) => {
  // Agregar al estado local de órdenes
});
```

**Payload:**
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

#### `order-updated`

Emitido cuando un WAITER agrega plates/items (`PATCH /orders/:id`).

```js
socket.on('order-updated', ({ order }) => {
  // Reemplazar la orden existente en el estado local por el objeto completo recibido
});
```

**Payload:** misma estructura que `order-created`.

Claves a observar:
- `status` será `"UPDATED"`
- La `revision` se habrá incrementado
- Los nuevos items tienen `isNew: true`
- Los plates/items anteriores mantienen `isNew: false`
- Todos los plates (históricos + nuevos) están incluidos en `plates`

---

#### `order-status-changed`

Emitido cuando un COOK cambia el estado (`PATCH /orders/:id/status`).

```js
socket.on('order-status-changed', ({ order }) => {
  // Actualizar el status de la orden en el estado local
});
```

**Payload:** misma estructura que `order-created`.

Cuando el nuevo status es `READY`, todos los items tendrán `isNew: false` (limpiado en la misma transacción de BD antes de emitir).

---

### Garantías de emisión

- Los eventos se emiten **siempre después** de confirmar la escritura en PostgreSQL.
- Si Socket.IO falla al emitir, la BD **no se revierte**. El error se registra en el Logger del servidor.
- La respuesta REST al cliente es exitosa independientemente de si el WebSocket falló.

---

## Errores comunes

### Estructura de error estándar (NestJS)

```json
{
  "statusCode": 400,
  "message": "descripción del error",
  "error": "Bad Request"
}
```

Para errores de validación:
```json
{
  "statusCode": 400,
  "message": [
    "email must be an email",
    "password must be longer than or equal to 6 characters"
  ],
  "error": "Bad Request"
}
```

### Tabla de errores

| Código | Nombre              | Cuándo ocurre en este backend                                    |
|--------|---------------------|-------------------------------------------------------------------|
| `400`  | Bad Request         | Validación de DTO fallida, flags de registro inválidos, status UPDATED manual, plateNumber duplicado |
| `401`  | Unauthorized        | Token ausente/inválido/expirado, credenciales incorrectas         |
| `403`  | Forbidden           | Rol insuficiente, intentar acceder a datos de otra taquería      |
| `404`  | Not Found           | Recurso no existe o pertenece a otra taquería                    |
| `409`  | Conflict            | Email ya registrado, fallo al generar restaurantCode único       |

---

## Guía de integración React Native

### Cuándo usar cada endpoint

| Situación en la app                        | Acción                                          |
|--------------------------------------------|-------------------------------------------------|
| App inicia por primera vez                 | `POST /auth/register` (flujo 2 fases)          |
| Usuario tiene cuenta                       | `POST /auth/login`, guardar `accessToken`       |
| Verificar sesión activa                    | `GET /auth/me`                                  |
| Cargar menú                               | `GET /products`                                 |
| Mesero crea pedido                        | `POST /orders` → escuchar `order-created`      |
| Mesero agrega items a pedido              | `PATCH /orders/:id` → escuchar `order-updated` |
| Cocina cambia estado                      | `PATCH /orders/:id/status` → escuchar `order-status-changed` |
| Ver pedidos actuales (COOK)               | `GET /orders` (vienen pre-ordenados por prioridad) |
| Ver mis pedidos (WAITER)                  | `GET /orders` (solo propios, por fecha desc)   |

---

### Manejo del token JWT

- Guardar `accessToken` en almacenamiento seguro (AsyncStorage, SecureStore).
- Incluir en cada request: `Authorization: Bearer <token>`.
- El token expira en **1 día**. Si recibes `401`, redirigir al login.
- Reutilizar el mismo token para WebSocket en `socket.handshake.auth.token`.

---

### Estrategia de estado con Realtime

Recomendación para sincronizar el estado local de órdenes:

```js
// Al conectar y cargar pantalla inicial
const orders = await fetch('/orders'); // cargar estado base

// Escuchar eventos para actualizaciones incrementales
socket.on('order-created', ({ order }) => {
  // COOK: insertar en el store (respetar orden de prioridad localmente)
  // WAITER: insertar solo si order.waiterId === myUserId
  addOrder(order);
});

socket.on('order-updated', ({ order }) => {
  // Reemplazar completamente la orden por el objeto recibido
  replaceOrder(order);
});

socket.on('order-status-changed', ({ order }) => {
  // Actualizar status y isNew en la orden existente
  replaceOrder(order);
});
```

**Nota importante:** el payload siempre contiene la orden completa — no es necesario hacer un `GET /orders/:id` adicional al recibir un evento.

---

### Stores que probablemente afecta cada endpoint

| Endpoint / Evento       | Store afectado                              |
|-------------------------|---------------------------------------------|
| `POST /auth/login`      | `auth.user`, `auth.token`, `auth.taqueria`  |
| `GET /auth/me`          | `auth.user`, `auth.taqueria`                |
| `GET /products`         | `products.list`                             |
| `POST /products`        | `products.list` (insertar)                  |
| `PATCH /products/:id`   | `products.list` (actualizar elemento)       |
| `DELETE /products/:id`  | `products.list` (remover elemento)          |
| `POST /orders`          | `orders.list` (insertar)                    |
| `GET /orders`           | `orders.list` (reemplazar)                  |
| `PATCH /orders/:id`     | `orders.list` (actualizar elemento)         |
| `PATCH /orders/:id/status` | `orders.list` (actualizar elemento)      |
| `order-created`         | `orders.list` (insertar)                    |
| `order-updated`         | `orders.list` (reemplazar elemento)         |
| `order-status-changed`  | `orders.list` (reemplazar elemento)         |

---

### Notas de UX por endpoint

**`POST /auth/register`**
- Implementar como stepper de 2 pasos: primero buscar la taquería, luego confirmar acción.
- Si `taqueriaMatches === 0`, mostrar formulario para crear nueva.
- Si `taqueriaMatches >= 1`, mostrar lista para seleccionar y unirse, con opción de crear nueva de todas formas.

**`GET /orders` para COOK**
- Los pedidos vienen pre-ordenados por prioridad de cocina. No reordenar en frontend.
- Actualizar con eventos realtime para evitar polling.

**`PATCH /orders/:id` (append)**
- El `plateNumber` debe ser mayor que el último plate existente (o cualquier número no usado).
- Recomendación: generar `plateNumber` como `max(existingPlateNumbers) + 1` en el frontend.

**`isNew` y highlight verde**
- Mostrar highlight verde en items donde `isNew === true` cuando el status es `UPDATED` o `PREPARING`.
- Al recibir `order-status-changed` con status `READY`, los `isNew` ya vienen limpios desde el servidor.

---

*Generado analizando el código fuente del backend. Última actualización: ETAPA 4.4.*
