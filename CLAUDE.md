# TacosManager API — CLAUDE.md

Plataforma SaaS multi-tenant para la administración operativa de taquerías. Backend en NestJS con autenticación JWT, multi-tenancy por `restaurantCode`, gestión de productos y un sistema de órdenes append-only con cola de cocina FIFO.

## Stack

- **NestJS 11** — framework principal, arquitectura modular
- **Prisma 7** — ORM, migraciones y schema
- **PostgreSQL** — base de datos
- **JWT (Passport)** — autenticación con Bearer tokens
- **bcrypt** — hash de contraseñas
- **class-validator / class-transformer** — validación y transformación de DTOs
- **pnpm** — gestor de paquetes
- **Docker** — PostgreSQL local (`docker-compose.yml`)

## Comandos esenciales

```bash
# Desarrollo
pnpm run start:dev       # servidor con watch mode

# Base de datos
pnpm prisma migrate dev  # aplicar migraciones en desarrollo
pnpm prisma studio       # GUI para explorar la BD

# Build
pnpm run build           # compilar a dist/
pnpm run start:prod      # ejecutar producción

# Calidad de código
pnpm run lint            # ESLint
pnpm run format          # Prettier

# Tests
pnpm run test            # unitarios
pnpm run test:e2e        # end-to-end
pnpm run test:cov        # coverage
```

## Variables de entorno

```
DATABASE_URL="postgresql://tacosmanager:tacosmanager@localhost:5432/tacosmanagerdb?schema=public"
JWT_SECRET="tacosmanager-dev-jwt-secret-change-in-production"
PORT=3000
```

## Arquitectura de módulos

```
src/
├── prisma/        # PrismaModule global (singleton)
├── auth/          # JWT, registro 2 fases, login, /auth/me
├── users/         # UsersService (acceso a datos, sin controller)
├── products/      # CRUD catálogo por taquería
├── orders/        # Órdenes append-only + cola de cocina
└── realtime/      # Socket.IO (pendiente, estructura vacía)
```

Cada módulo sigue la estructura `module / controller / service / dto/ / interfaces/`.

## Multi-tenancy

Cada taquería tiene un `restaurantCode` único (ej. `TM-4821`). El JWT contiene `{ userId, role, taqueriaId, restaurantCode }`. **El backend nunca acepta `taqueriaId` del cliente** — siempre se toma del token. Todas las queries filtran por `taqueriaId`.

## Roles y permisos

| Acción                                    | WAITER | COOK |
|-------------------------------------------|--------|------|
| Ver catálogo de productos                 | ✅     | ✅   |
| Crear / editar / eliminar productos       |        | ✅   |
| Crear órdenes                             | ✅     |      |
| Actualizar órdenes propias (append-only)  | ✅     |      |
| Ver todas las órdenes de la taquería      |        | ✅   |
| Cambiar estado de órdenes                 |        | ✅   |

## Sistema de órdenes

**Append-only**: las órdenes nunca se reescriben. Agregar items crea nuevos `Plate`s o `Item`s con `createdInRevision` del momento actual. Cada actualización incrementa `revision` y actualiza `priorityTimestamp`.

**Jerarquía**: `Order → Plate → Item`

**Prioridad de cocina** (orden de la cola FIFO):
1. `UPDATED` (máxima prioridad)
2. `PENDING`
3. `PREPARING`
4. `READY`
5. `DELIVERED`
6. `CANCELLED`

Dentro de cada grupo: orden ASC por `priorityTimestamp`.

**`isNew`** en `Item`: flag para highlight verde en cocina. Visible cuando la orden está en `UPDATED` o `PREPARING`; desaparece al pasar a `READY`.

## Flujo de registro (2 fases)

**Fase 1** — búsqueda sin efectos secundarios (solo `name`):
- 0 coincidencias → puede crear nueva taquería
- 1 coincidencia → puede unirse o crear nueva
- N coincidencias → lista para seleccionar

**Fase 2** — acción final:
- Unirse: `confirmJoinExistingTaqueria: true` + `selectedRestaurantCode`
- Crear: `createNewTaqueria: true` + `taqueriaData`

## Convenciones de código

- **DTOs**: `Create{Entity}Dto`, `Update{Entity}Dto`, `Update{Entity}StatusDto`
- **Guards**: siempre `JwtAuthGuard` + `RolesGuard` en endpoints protegidos
- **Respuestas**: nunca incluir `password`/hash; nunca datos de otra taquería
- **Validación**: `ValidationPipe` global con `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
- **Errores**: excepciones estándar de NestJS (`NotFoundException`, `ForbiddenException`, etc.)
- **TypeScript**: strict parcial — `noImplicitAny: false`, decorators experimentales habilitados

## Seguridad (4 capas)

1. **JWT** — autenticación en cada request
2. **Roles** — `@Roles(UserRole.COOK)` / `@Roles(UserRole.WAITER)`
3. **Ownership** — validación en service layer (WAITER solo ve sus órdenes)
4. **Tenant isolation** — todas las queries con filtro `taqueriaId`

## Estado del proyecto

| Etapa | Descripción                        | Estado |
|-------|------------------------------------|--------|
| 1     | Fundación (NestJS, Prisma, PG)     | ✅     |
| 2     | Auth & Multi-Tenant                | ✅     |
| 3     | Módulo Productos                   | ✅     |
| 4.1   | Órdenes CRUD                       | ✅     |
| 4.2   | Cola de cocina FIFO                | ✅     |
| 4.3   | Socket.IO Foundation               | ⬜     |
| 4.4   | Kitchen Realtime                   | ⬜     |
| 4.5–8 | Realtime avanzado + Performance    | ⬜     |
| 5     | Analytics & Reportes               | ⬜     |
| 6     | Infraestructura de producción      | ⬜     |

## Documentación

Más detalle en `/docs/`:
- `api-reference.md` — endpoints completos con ejemplos
- `architecture.md` — decisiones arquitectónicas
- `business-rules.md` — reglas de negocio
- `feature-list.md` — features implementadas y roadmap
- `readmap.md` — etapas futuras detalladas
