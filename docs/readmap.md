# TacosManager Development Roadmap

Version: 1.0

---

# Proyecto

TacosManager es una plataforma SaaS multi-tenant para taquerías.

Objetivo principal:

Permitir a taquerías administrar:

- Productos
- Pedidos
- Cocina
- Historial
- Operación diaria
- Realtime
- Analítica futura

Tecnologías principales:

- NestJS
- Prisma
- PostgreSQL
- Docker
- JWT
- Socket.IO
- React Native

---

# Estado General

## Completado

- Infraestructura Backend
- Autenticación
- Multi-Tenant
- Products Module
- Orders Core CRUD
- Kitchen Queue Logic
- Socket.IO Foundation
- Kitchen Realtime

## Pendiente

- Frontend Migration
- Realtime Reliability
- Analytics
- Production Deployment

---

# ETAPA 1
# Backend Foundation

Estado:

✅ COMPLETADA

---

## Objetivos

- Crear backend NestJS
- Configurar PostgreSQL
- Configurar Prisma
- Configurar Docker
- Definir arquitectura base

---

## Entregables

- NestJS inicializado
- PostgreSQL operativo
- Prisma configurado
- Docker funcionando
- Proyecto compilando

---

# ETAPA 2
# Authentication & Multi-Tenant

Estado:

✅ COMPLETADA

---

## Objetivos

Implementar:

- JWT
- Roles
- Ownership
- Multi-Tenant

---

## Entregables

### Usuarios

- COOK
- WAITER

---

### Seguridad

- JWT Authentication
- Role Guards
- Ownership Validation
- Tenant Isolation

---

### Taquerías

- restaurantCode
- Multi-tenant architecture
- Registro inteligente

---

# ETAPA 3
# Products Module

Estado:

✅ COMPLETADA

---

## Objetivos

Administrar catálogo.

---

## Funcionalidades

- Crear producto
- Editar producto
- Consultar producto
- Eliminar producto
- Ownership
- Multi-tenant

---

## Reglas

Máximo:

3 complementos por producto.

---

# ETAPA 4.1
# Orders Core CRUD

Estado:

✅ COMPLETADA

---

## Objetivos

Construir la base de órdenes.

---

## Entidades

### Order

- status
- revision
- priorityTimestamp

---

### Plate

- plateNumber
- createdInRevision
- isClosed

---

### Item

- quantity
- notes
- selectedComplements
- isNew

---

## Funcionalidades

### Crear pedido

POST /orders

---

### Consultar pedidos

GET /orders

---

### Consultar detalle

GET /orders/:id

---

### Editar pedido

PATCH /orders/:id

---

### Actualizar estado

PATCH /orders/:id/status

---

## Reglas

Append Only Editing.

Los pedidos no se modifican.

Se agregan nuevos Plates.

---

# ETAPA 4.2
# Kitchen Queue Logic

Estado:

🟡 EN VALIDACIÓN

---

## Objetivos

Mover toda la lógica de cocina al backend.

Backend como Source Of Truth.

---

## Estados

- UPDATED
- PENDING
- PREPARING
- READY
- DELIVERED
- CANCELLED

---

## Prioridad Global

1. UPDATED
2. PENDING
3. PREPARING
4. READY
5. DELIVERED
6. CANCELLED

---

## FIFO

Dentro de cada grupo:

First In First Out.

Ejemplo:

Pedido A 12:00

Pedido B 12:05

Resultado:

Pedido A

Pedido B

---

## Highlight Verde

Nuevos Items:

isNew = true

Visible durante:

- UPDATED
- PREPARING

Desaparece:

- READY

---

## Revision System

Pedido nuevo:

revision = 1

Actualización:

revision++

---

## createdInRevision

Permite identificar cuándo apareció:

- Plate
- Item

---

## priorityTimestamp

Actualizado cuando:

- Se crea pedido
- Se agregan plates
- Se agregan items

---

# ETAPA 4.3
# Socket.IO Foundation

Estado:

✅ COMPLETADA

---

## Implementado

- `@nestjs/websockets` + `@nestjs/platform-socket.io` + `socket.io` instalados
- `RealtimeGateway` con `OnGatewayConnection` / `OnGatewayDisconnect`
- JWT validado en handshake — conexiones inválidas rechazadas
- Contexto de usuario cargado en `socket.data.user`
- `RealtimeAuthGuard` para handlers individuales
- Room multi-tenant: `taqueria:<taqueriaId>`
- Evento `join-taqueria` implementado
- `IoAdapter` configurado en `main.ts`
- Documentación actualizada

## Archivos

```txt
src/realtime/
├── interfaces/
│   └── authenticated-socket.interface.ts
├── realtime-auth.guard.ts
├── realtime.gateway.ts
└── realtime.module.ts
```

## Rooms

```txt
taqueria:<taqueriaId>
```

---

# ETAPA 4.4
# Kitchen Realtime

Estado:

✅ COMPLETADA

---

## Objetivos

Reemplazar Firebase realtime.

---

## Implementado

### Nuevos archivos

- `src/realtime/interfaces/order-payload.interface.ts`

### Archivos modificados

- `src/realtime/realtime.gateway.ts` — métodos `emitOrderCreated`, `emitOrderUpdated`, `emitOrderStatusChanged`
- `src/realtime/realtime.module.ts` — exporta `RealtimeGateway`
- `src/orders/orders.module.ts` — importa `RealtimeModule`
- `src/orders/orders.service.ts` — emite tras cada operación de BD

### Eventos implementados

order-created → emitido tras POST /orders

order-updated → emitido tras PATCH /orders/:id

order-status-changed → emitido tras PATCH /orders/:id/status

### Regla de persistencia

BD primero → confirmar → emitir WebSocket.

### Resultado

Sin polling.

Sin refresh manual.

Sin Firebase.

Actualización instantánea cocina y meseros.

---

# ETAPA 4.5
# React Native Socket Migration

Estado:

⬜ PENDIENTE

---

## Objetivos

Conectar frontend a Socket.IO.

---

## Funcionalidades

- Conexión Socket
- Reconnection
- Event listeners
- Store synchronization

---

## Resultado esperado

Actualización instantánea entre:

- Cocina
- Meseros

---

# ETAPA 4.6
# Realtime Reliability

Estado:

⬜ PENDIENTE

---

## Objetivos

Preparar producción.

---

## Implementar

- Reconnection Strategy
- Heartbeats
- Connection Recovery
- Cleanup
- Memory Leak Prevention

---

## Resultado esperado

Realtime estable en producción.

---

# ETAPA 4.7
# History & Filters

Estado:

⬜ PENDIENTE

---

## Objetivos

Filtros históricos.

---

## Opciones

### Hoy

Default.

---

### Últimos 7 días

---

### Último mes

---

### Últimos 3 meses

---

## Roles

WAITER

Solo sus pedidos.

---

COOK

Todos los pedidos de la taquería.

---

# ETAPA 4.8
# Performance Optimization

Estado:

⬜ PENDIENTE

---

## Objetivos

Optimizar sistema completo.

---

## Implementar

- Prisma Indexes
- Query Optimization
- Pagination
- Efficient Includes
- Socket Optimization

---

## Resultado esperado

Capacidad para operar múltiples taquerías simultáneamente.

---

# ETAPA 5
# Analytics & Reports

Estado:

⬜ FUTURO

---

## Objetivos

Métricas de negocio.

---

## Ejemplos

- Ventas por día
- Productos más vendidos
- Ticket promedio
- Mesas más activas
- Rendimiento de cocina

---

# ETAPA 6
# Production Infrastructure

Estado:

⬜ FUTURO

---

## Objetivos

Preparar despliegue profesional.

---

## Implementar

- CI/CD
- GitHub Actions
- VPS
- Reverse Proxy
- SSL
- Monitoring
- Logging
- Backups

---

# Definition of Done

Una etapa se considera completada cuando:

- Todas las reglas de negocio funcionan
- Ownership validado
- Multi-tenant validado
- Tests manuales aprobados
- Documentación actualizada
- Feature list actualizado
- Sin errores críticos

---

# Documentos Relacionados

- docs/business-rules.md
- docs/architecture.md
- docs/api-reference.md
- docs/roadmap.md

---

# Próxima Etapa

ETAPA 4.5

React Native Socket Migration

Objetivo:

Crear la infraestructura realtime que sustituirá completamente Firebase.