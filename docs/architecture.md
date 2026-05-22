# TacosManager Backend Architecture

Version: 1.0

---

# Overview

TacosManager es una plataforma SaaS multi-tenant para la administración operativa de taquerías.

El backend está construido utilizando:

- NestJS
- Prisma ORM
- PostgreSQL
- JWT Authentication
- Docker
- pnpm

La arquitectura sigue principios de:

- Modular Architecture
- Multi-Tenant Isolation
- Domain Driven Design (lightweight)
- Ownership Based Security
- Backend as Source of Truth

---

# System Architecture

```txt
Client (React Native)
        │
        ├── HTTP (REST)          ├── WebSocket (Socket.IO)
        ▼                                ▼
 NestJS API                    NestJS WebSocket Gateway
        │                                │
 ├── Auth Module               ├── RealtimeGateway
 ├── Users Module              ├── RealtimeAuthGuard
 ├── Products Module           └── Rooms: taqueria:<taqueriaId>
 ├── Orders Module
 └── Realtime Module
        │
        ▼
 Prisma ORM
        │
        ▼
 PostgreSQL
```

---

# Multi-Tenant Architecture

Todas las entidades del sistema pertenecen a una taquería.

El aislamiento de datos se realiza mediante:

```txt
taqueriaId
```

Ningún usuario puede acceder a datos de otra taquería.

---

# Tenant Resolution

Identificador visual:

```txt
name
```

Identificador real:

```txt
restaurantCode
```

Ejemplo:

Taquería El Güero

```txt
restaurantCode = TQR-4821
```

---

# Roles

## COOK

Permisos:

- Consultar todos los pedidos de la taquería
- Cambiar estados de pedidos
- Administrar flujo de cocina
- Consultar historial

---

## WAITER

Permisos:

- Crear pedidos
- Consultar sus pedidos
- Editar pedidos propios
- Consultar catálogo

---

# Authentication Architecture

JWT Authentication.

Flujo REST:

```txt
Login
 ↓
JWT (generado por AuthModule → JwtService)
 ↓
Auth Guard
 ↓
Request User Context
 ↓
Ownership Validation
```

Flujo WebSocket:

```txt
socket.handshake.auth.token
 ↓
JwtService.verifyAsync (mismo servicio que REST — provisto por AuthModule)
 ↓
User context → socket.data.user
 ↓
Auto-join taqueria:<taqueriaId>
```

## Fuente de verdad JWT

`AuthModule` es la única fuente de verdad para la configuración JWT del sistema.

```txt
AuthModule
 ├── JwtModule.registerAsync(JWT_SECRET, expiresIn: 1d)
 ├── exports: [AuthService, JwtModule]
 └── Todos los módulos que necesiten JwtService importan AuthModule
```

`RealtimeModule` importa `AuthModule` — no registra su propio `JwtModule`.
Cualquier cambio futuro en `secret`, `expiresIn`, `issuer` o `algorithm` se aplica automáticamente a REST y Socket.IO.

JWT contiene:

```txt
userId
role
taqueriaId
restaurantCode
```

---

# Core Domain Models

## Taqueria

```txt
id
name
restaurantCode
createdAt
updatedAt
```

---

## User

```txt
id
name
email
passwordHash
role
taqueriaId
createdAt
updatedAt
```

---

## Product

```txt
id
name
price
complements
taqueriaId
createdAt
updatedAt
```

---

## Order

```txt
id
tableNumber
status
revision
priorityTimestamp
waiterId
taqueriaId
createdAt
updatedAt
```

---

## Plate

```txt
id
plateNumber
createdInRevision
isClosed
orderId
createdAt
updatedAt
```

---

## Item

```txt
id
quantity
selectedComplements
notes
isNew
createdInRevision
plateId
productId
createdAt
updatedAt
```

---

# Orders Architecture

Order
 ├── Plate
 │     ├── Item
 │     ├── Item
 │     └── Item
 │
 ├── Plate
 │     ├── Item
 │     └── Item
 │
 └── Plate

---

# Order Editing Strategy

Append Only Editing.

Regla:

Los pedidos NO se modifican.

Se agregan nuevos Plates.

Ejemplo:

Pedido original:

Plate 1
- Taco Pastor
- Taco Asada

Actualización:

Plate 2
- Horchata
- Quesadilla

Plate 1 permanece intacto.

---

# Kitchen Queue Architecture

Estados soportados:

```txt
UPDATED
PENDING
PREPARING
READY
DELIVERED
CANCELLED
```

---

# Kitchen Priority

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

# FIFO Policy

Dentro de cada grupo:

First In First Out.

Ejemplo:

Pedido A
12:00

Pedido B
12:05

Resultado:

Pedido A
Pedido B

---

# Revision System

Pedido nuevo:

```txt
revision = 1
```

Actualización:

```txt
revision++
```

Objetivo:

- Auditoría
- Realtime futuro
- Historial de cambios

---

# Highlight System

Los Items agregados posteriormente:

```txt
isNew = true
```

Frontend:

Mostrar en verde.

Persistencia:

UPDATED
PREPARING

Desaparición:

READY

---

# Security Layers

Layer 1

JWT Authentication

---

Layer 2

Role Validation

---

Layer 3

Ownership Validation

---

Layer 4

Tenant Isolation

---

# Realtime Architecture (Etapa 4.3)

## WebSocket Gateway

Implementado con `@nestjs/websockets` + `socket.io`.

Clase: `RealtimeGateway` en `src/realtime/realtime.gateway.ts`

```txt
Cliente conecta → handleConnection
                      │
              extractToken (handshake.auth.token / Authorization header)
                      │
              jwtService.verifyAsync(token)
                      │
              usersService.findAuthUserById(payload.sub)
                      │
              socket.data.user = { id, name, email, role, taqueriaId, restaurantCode }
                      │
              socket.join(`taqueria:${taqueriaId}`)
```

## Autenticación WebSocket

El JWT utilizado en WebSocket es el mismo que en la API REST.

Fuentes aceptadas para el token (en orden de prioridad):

```txt
1. socket.handshake.auth.token        ← recomendado para React Native
2. socket.handshake.headers.authorization (Bearer <token>)
```

JWT inválido o ausente → `client.disconnect()` inmediato.

## Rooms Multi-Tenant

Formato de room:

```txt
taqueria:<taqueriaId>
```

Ejemplo:

```txt
taqueria:b3e2c1d4-...
```

Todos los usuarios de la misma taquería comparten room.
El aislamiento entre taquerías es garantizado por el JWT — `taqueriaId` viene del token, nunca del cliente.

## RealtimeAuthGuard

Guard para handlers individuales de WebSocket.

```txt
Verifica que socket.data.user exista (seteado en handleConnection).
Lanza WsException('Unauthorized') si no existe.
```

## Eventos Disponibles (Etapa 4.3)

| Evento         | Dirección       | Descripción                                 |
|----------------|-----------------|---------------------------------------------|
| `connection`   | cliente → server| Handshake + validación JWT + join room      |
| `disconnect`   | cliente → server| Limpieza de conexión                        |
| `join-taqueria`| cliente → server| Confirma la room activa del usuario         |

## Eventos Planificados (Etapa 4.4)

```txt
order-created         server → room taquería
order-updated         server → room taquería
order-status-changed  server → room taquería
kitchen-sync          server → room taquería
```

El gateway está diseñado para emitir a rooms sin necesidad de reescribir la arquitectura.

---

# Future Architecture

Etapa 4.4

Kitchen Realtime — emitir eventos de negocio desde OrdersService usando el gateway.

---

Etapa 4.5

Frontend Socket Integration

---

Etapa 4.6

Realtime Reliability

---

End of Document