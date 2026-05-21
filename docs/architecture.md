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
        ▼
 NestJS API
        │
 ├── Auth Module
 ├── Users Module
 ├── Products Module
 ├── Orders Module
 └── Future Socket.IO Module
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

Flujo:

```txt
Login
 ↓
JWT
 ↓
Auth Guard
 ↓
Request User Context
 ↓
Ownership Validation
```

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

# Future Architecture

Etapa 4.3

Socket.IO Foundation

Eventos previstos:

```txt
order-created
order-updated
order-status-changed
```

---

Etapa 4.4

Kitchen Realtime

---

Etapa 4.5

Frontend Socket Integration

---

Etapa 4.6

Realtime Reliability

---

End of Document