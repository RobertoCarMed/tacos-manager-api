# TacosManager API — CLAUDE.md

Plataforma SaaS multi-tenant para la administración operativa de taquerías. Backend en NestJS con autenticación JWT, multi-tenancy por `restaurantCode`, gestión de productos y un sistema de órdenes append-only con cola de cocina FIFO.

## Stack

- **NestJS 11** — framework principal, arquitectura modular
- **Prisma 7** — ORM, migraciones y schema
- **PostgreSQL** — base de datos
- **JWT (Passport)** — autenticación con Bearer tokens
- **Socket.IO 4** (`@nestjs/websockets`, `@nestjs/platform-socket.io`) — WebSockets realtime
- **`@nestjs/config`** — ConfigModule global, carga `.env.${NODE_ENV}` + `.env`, validación al arranque
- **bcrypt** — hash de contraseñas
- **class-validator / class-transformer** — validación y transformación de DTOs
- **cross-env** — scripts cross-platform con NODE_ENV
- **pnpm** — gestor de paquetes (invocar con `npx pnpm`)
- **Docker** — PostgreSQL local (`docker-compose.yml`)

## Comandos esenciales

```bash
# Desarrollo
pnpm run start:dev       # NODE_ENV=development, watch mode
pnpm run start:qa        # NODE_ENV=qa (requiere build previo)
pnpm run start:prod      # NODE_ENV=production (requiere build previo)

# Base de datos
pnpm prisma migrate dev  # aplicar migraciones en desarrollo
pnpm prisma studio       # GUI para explorar la BD

# Build
pnpm run build           # compilar a dist/

# Calidad de código
pnpm run lint            # ESLint
pnpm run format          # Prettier

# Tests
pnpm run test            # unitarios
pnpm run test:e2e        # end-to-end
pnpm run test:cov        # coverage
```

## Variables de entorno

El archivo activo depende de `NODE_ENV` — ver `.env.example` para la plantilla completa.

| Variable | Requerida | Default | Descripción |
|----------|-----------|---------|-------------|
| `DATABASE_URL` | ✅ | — | Cadena de conexión PostgreSQL |
| `JWT_SECRET` | ✅ | — | Clave secreta JWT |
| `NODE_ENV` | No | `development` | Ambiente activo |
| `JWT_EXPIRES_IN` | No | `1d` | Expiración del token |
| `PORT` | No | `3000` | Puerto HTTP |
| `CORS_ORIGIN` | No | `*` | Origen HTTP permitido |
| `SOCKET_ORIGIN` | No | `*` | Origen Socket.IO permitido |

Archivo de desarrollo local: `.env.development` (gitignoreado — copiar de `.env.example`)

## Arquitectura de módulos

```
src/
├── config/        # env.validation.ts — validación de vars al arranque
├── prisma/        # PrismaModule global (singleton)
├── auth/          # JWT, registro 2 fases, login, /auth/me
├── users/         # UsersService (acceso a datos, sin controller)
├── products/      # CRUD catálogo por taquería
├── orders/        # Órdenes append-only + cola de cocina
└── realtime/      # Socket.IO Gateway — autenticación JWT + rooms multi-tenant
    ├── interfaces/authenticated-socket.interface.ts
    ├── realtime-auth.guard.ts      # guard para @SubscribeMessage handlers
    ├── realtime.gateway.ts         # OnGatewayConnection + eventos
    ├── realtime.module.ts
    └── socket-io.adapter.ts        # CORS configurable vía SOCKET_ORIGIN
```

Cada módulo sigue la estructura `module / controller / service / dto/ / interfaces/`.

## Fuente de verdad JWT

`AuthModule` es la única fuente de verdad para la configuración JWT. Exporta `[AuthService, JwtModule]`. Cualquier módulo que necesite `JwtService` debe importar `AuthModule`, no registrar su propio `JwtModule`.

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

**Clasificación por tipo** (`OrderType`):
- `DINE_IN` — requiere `reference` (número de mesa). Default.
- `TAKEAWAY` — requiere `reference` (nombre del cliente).
- `DELIVERY` — requiere `deliveryAddress`. `reference` queda en null.

El campo `tableNumber` fue renombrado a `reference (String?)` en la migración 4.6.1.

**Prioridad de cocina** (orden de la cola FIFO — implementado en ETAPA 4.5.6.1):
1. `PREPARING` (máxima prioridad — trabajo activo del cocinero)
2. `PENDING`
3. `READY`
4. `DELIVERED`
5. `CANCELLED`

`UPDATED` deprecado operacionalmente — no se asigna en nuevas transiciones. El enum se conserva en DB para registros históricos (peso 1 junto a PREPARING en la query SQL).

Dentro de cada grupo: orden ASC por `priorityTimestamp`.

**`isNew`** en `Item`: flag para highlight verde en cocina. `true` cuando el item fue agregado por `PATCH /orders/:id` (append). Se limpia a `false` en la transacción que mueve la orden a `READY`.

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
| 4.3   | Socket.IO Foundation               | ✅     |
| 4.4   | Kitchen Realtime                   | ✅     |
| 4.5   | React Native Socket Migration      | ✅     |
| 4.5.6.1 | Backend Queue Rules              | ✅     |
| 4.6.1 | Order Classification — Backend     | ✅     |
| 4.7   | Realtime Reliability               | ✅     |
| 5.0.1 | Environment Strategy — Backend    | ✅     |
| 5.0.2 | Backend Deployment                 | 🟡     |

## Documentación

Más detalle en `/docs/` (submódulo Git → repo `tacosmanager-docs`):
- `api-reference.md` — endpoints completos con ejemplos
- `architecture.md` — decisiones arquitectónicas
- `business-rules.md` — reglas de negocio
- `feature-list.md` — features implementadas y roadmap
- `roadmap.md` — etapas futuras detalladas

## Spec-Driven Development (SDD)

Este repo consume **`tacosmanager-docs`** como Git Submodule en `docs/`. La fuente de verdad de specs, ADRs y contratos vive ahí — nunca dupliques nada en este repo.

### Inicializar y actualizar el submódulo

```bash
# Primera vez en el clon:
git submodule update --init --recursive

# Sincronizar con el último commit de docs:main:
git -C docs fetch origin
git -C docs checkout main
git -C docs pull origin main

# Registrar el bump del puntero en este repo:
git add docs
git commit -m "chore(docs): bump submodule to latest main"
```

### Archivos clave en `docs/`

| Archivo | Para qué |
|---|---|
| `docs/constitution.md` | 10 artículos no negociables (Multi-tenant, Append-only, Ownership, etc.) |
| `docs/glossary.md` | Vocabulario canónico — úsalo en código, commits y conversación |
| `docs/traceability.md` | Matriz `REQ-NNNN ↔ TEST ↔ código`. **No inventes REQ-IDs**. |
| `docs/docs/adr/` | Decisiones arquitectónicas (`ADR-0001`..`ADR-0009`) |
| `docs/specs/<feature>/` | `spec.md` + `plan.md` + `tasks.md` + `acceptance.feature` |
| `docs/contracts/openapi.yaml` | Contrato REST vinculante |
| `docs/contracts/asyncapi.yaml` | Contrato Socket.IO vinculante |

### Branching

`feature/* → dev → qa → main`. PRs nunca van directo a `main`. Conventional Commits. El cuerpo del commit DEBE incluir `Closes REQ-NNNN` cuando aplique.

### Suite BDD (Cucumber sobre `acceptance.feature`)

Los `*.feature` del submódulo se ejecutan como tests reales contra una BD efímera.

```bash
# Local (requiere Postgres corriendo, ver docker-compose.yml):
NODE_ENV=test \
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tacosmanager_test \
JWT_SECRET=test-secret \
pnpm run test:bdd
```

- Config: `cucumber.cjs` — apunta a `docs/specs/**/acceptance.feature`.
- Infra: `test/features/{world,hooks}.ts` boota la app NestJS en proceso (puerto efímero) + truncate `BeforeAll`/`Before`.
- Step defs por dominio: `test/features/steps/{auth,products,orders,kitchen,realtime}.steps.ts`.
- CI: `.github/workflows/bdd.yml` corre la suite contra Postgres 16 efímero.
- Reportes: `reports/cucumber.json` y `reports/cucumber.html` (publicados como artifact en CI).

### Convención de nombres de tests (detectable por `traceability.md`)

```ts
// Backend (Jest)
describe('REQ-0020: crear orden DINE_IN con reference', () => { ... });

// O comentario inline arriba del it()
it('returns 201 with full order payload', () => {
  // @REQ-0020 @REQ-0026
  ...
});
```

```gherkin
# Gherkin: tag justo encima del Escenario
@REQ-0020
Escenario: WAITER crea orden DINE_IN con reference
```

Un test PUEDE cubrir múltiples REQ — listarlos todos.

### Reglas duras heredadas de `constitution.md`

- **Artículo I — Multi-tenancy**: toda query filtra por `taqueriaId`. El backend nunca acepta `taqueriaId` del cliente.
- **Artículo III — Ownership**: toda ruta lleva `JwtAuthGuard` salvo `/`, `/health`, `/auth/login`, `/auth/register`.
- **Artículo IV — Realtime**: toda mutación de orden emite el evento Socket.IO correspondiente.
- **Artículo V — Append-only**: items históricos son inmutables. Nunca tocar `quantity`/`productId` de un item ya persistido.
- **Artículo IX — No leakage**: respuestas API nunca incluyen `password`, `passwordHash`, ni datos de otra taquería.

Cualquier cambio que tope estas reglas requiere ADR previo en `docs/docs/adr/`.
