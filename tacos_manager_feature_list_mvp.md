# 🌮 TacosManager — Feature List (MVP)

## 📌 Project Overview

TacosManager is a real-time restaurant management system focused on taquerías.

The app is designed to manage:
- waiter order creation
- kitchen order visualization
- realtime order synchronization
- product management
- restaurant staff organization

The project currently works as a:
- POS-like system
- Kitchen Display System (KDS)
- realtime operational workflow for restaurants

---

# 🧑‍💼 User Roles

The system currently supports two roles:

## 👨‍🍳 Cook (`cook`)
Responsible for:
- viewing all restaurant orders
- changing order statuses
- managing products
- monitoring realtime updates

---

## 🧑‍🍽️ Waiter (`waiter`)
Responsible for:
- creating orders
- editing existing orders
- adding products to existing orders
- viewing only their own orders

---

# 🔐 Authentication System

## ✅ Email & Password Login
Users authenticate using:
- email
- password

Authentication is currently handled with Firebase Auth.

---

# 🏪 Taquería System

## ✅ Taquería Relationship Rules

- A user belongs to ONE taquería
- A taquería can have MANY users

---

## ✅ Taquería Creation Flow

During registration:

- User writes taquería name
- If taquería already exists:
  - user is linked automatically
- If taquería does not exist:
  - app asks for taquería information
  - new taquería is created

---

## ✅ Taquería Fields

Each taquería contains:

- name
- address
- city
- state
- createdAt

---

# 🍽️ Product Management

## ✅ Product Creation

Cooks can create products.

Each product supports:

- product name
- price
- image
- complements

---

## ✅ Product Images

Products may contain:

- uploaded image
- fallback placeholder image

If no image is selected:
- image upload is skipped
- only product data is saved

---

## ✅ Product Ownership

Products are linked to the taquería.

Rules:
- A taquería can have many products
- Different taquerías can have products with same name
- Each taquería can define its own prices

---

# 🌮 Product Complements

## ✅ Complement System

Each product can contain:
- 0 to 3 complements

Examples:
- cilantro
- cebolla
- salsa

---

## ✅ Complement Selection

When waiter selects a product:

- complements are displayed dynamically
- waiter can enable/disable complements
- complements are saved with the order

UI uses:
- checkboxes

---

# 🧑‍🍽️ Waiter Features

---

# 📋 Waiter Orders Screen

## ✅ Order Visualization

Waiters can view:
- their created orders
- order status
- order details

---

# ➕ Create Order Flow

## ✅ Order Fields

Each order supports:

- table number and/or client name
- multiple plates
- multiple products per plate
- quantities
- complements

---

# 🍽️ Plate System

Orders are grouped by plates.

Example:

```txt
PLATE 1
- 3 tacos adobada
- 2 tacos asada

PLATE 2
- 4 tacos chorizo
```

---

# 🧾 Product Selection

## ✅ Product Selector

Products are loaded dynamically from Firestore.

Products shown:
- only products from current taquería

---

## ✅ Quantity Selector

Each selected product supports:
- increase quantity
- decrease quantity
- dynamic counter

---

## ✅ Product Image Preview

When product is selected:
- image is displayed if exists
- placeholder image otherwise

---

# 💰 Pricing System

## ✅ Price Features

Each order supports:

- unit price
- subtotal per item
- total order cost

Current format:

```txt
2x Taco Asada     $30 | $60
```

---

# ✏️ Edit Existing Orders

## ✅ Edit Order Flow

Waiter can:

1. Select an existing order
2. Press edit button
3. Navigate to edit screen
4. Add new products
5. Save changes

---

## ✅ Edit Restrictions

Waiter CANNOT:
- modify table/client
- remove existing closed items

Waiter CAN:
- add new products
- add new plates

---

# 👨‍🍳 Kitchen Display System (KDS)

---

# 📺 Kitchen Screen

Optimized for:
- horizontal layout
- 10-inch tablets
- long-distance readability

---

# 📋 Kitchen Order Cards

## ✅ Order States

Current states:

- PENDIENTE
- ACTUALIZADA
- PREPARANDO
- LISTO

---

# 🔥 Order Priority System

Current priority order:

1. ACTUALIZADA
2. PENDIENTE
3. PREPARANDO
4. LISTO

---

# ✨ Realtime Order Updates

When waiter edits an order:

## ✅ Kitchen Behavior

- order status changes to ACTUALIZADA
- order moves to top priority
- newly added products are highlighted
- new plates appear first

---

# 🟢 New Product Highlighting

New products inside edited orders:

- highlighted with soft green color
- visible immediately to cook

When order becomes PREPARANDO:
- green highlight disappears

---

# 🎨 KDS UI Features

## ✅ Large Readable UI

Includes:
- large cards
- readable typography
- optimized spacing
- operational workflow design

---

## ✅ Animations

Current animations:
- fade out
- automatic reorder
- smooth transitions

---

# ⚙️ Settings Screen

## ✅ Configuration Options

Current actions:

- logout
- add product
- edit product

---

# ☁️ Firebase Integration

Current Firebase services:

- Firebase Auth
- Firestore
- Firebase Storage

---

# 🔄 Realtime Features

## ✅ Realtime Synchronization

Realtime updates include:

- order creation
- order updates
- order status changes
- kitchen updates

---

# 📅 Historical Filters (Planned / In Progress)

Both cook and waiter screens support:

- today
- last 7 days
- last month
- last 3 months

---

# 🧠 Current Technical Stack

## Frontend

- React Native
- TypeScript

---

## Current Backend

- Firebase

---

## Current Architecture

- realtime listeners
- Firestore snapshots
- role-based rendering
- taquería-based multi-tenancy

---

# 🚀 Current MVP Status

The project currently includes:

- authentication
- realtime order system
- kitchen display system
- product catalog
- complements system
- pricing system
- order editing
- realtime kitchen prioritization
- multi-user taquería workflow
- role-based permissions
- tablet-optimized UI

---

# 📌 IMPORTANT DEVELOPMENT RULE

Whenever a new feature is implemented in this project:

1. The codebase MUST be updated
2. This markdown feature list MUST also be updated
3. New features should include:
   - feature description
   - affected roles
   - UI behavior
   - realtime behavior (if applicable)
   - technical notes if important

---

# Backend Migration Progress (NestJS + Prisma)

## Implemented: Prisma Enterprise Integration

### Technical scope

- Added global Prisma architecture for NestJS:
  - `src/prisma/prisma.service.ts`
  - `src/prisma/prisma.module.ts`
- Root module integration:
  - `src/app.module.ts` imports `PrismaModule`
- Application service integration:
  - `src/app.service.ts` injects Prisma service
  - Real database query enabled with `prisma.taqueria.findMany()`

### Behavior

- Root endpoint now validates live PostgreSQL access through Prisma.
- Response payload:
  - `message: Prisma funcionando 🚀`
  - `taquerias: [] | Taqueria[]`

### Architecture notes

- Prisma service uses `OnModuleInit` and `this.$connect()`.
- Connection guard prevents redundant connection initialization in module lifecycle.
- Structure is ready for modular growth and future realtime features (Socket.IO) without changing data access foundation.

---

# Backend Migration Progress (FASE 2 - Auth NestJS + Prisma + JWT)

## Implemented: Professional Authentication System

### New backend modules

- `src/auth`
  - `auth.module.ts`
  - `auth.controller.ts`
  - `auth.service.ts`
  - `dto/register.dto.ts`
  - `dto/login.dto.ts`
  - `guards/jwt-auth.guard.ts`
  - `guards/roles.guard.ts`
  - `roles.decorator.ts`
  - `strategies/jwt.strategy.ts`
- `src/users`
  - `users.module.ts`
  - `users.service.ts`

### New authentication endpoints

- `POST /auth/register`
  - Creates taquerÃ­a + initial user in a single flow
  - Supports roles: `WAITER`, `COOK`
  - Validates unique email
  - Hashes password with `bcrypt`
- `POST /auth/login`
  - Validates credentials (`email`, `password`)
  - Compares password with `bcrypt.compare`
  - Returns:
    - `accessToken`
    - `user`
    - `taqueria`
- `GET /auth/me` (protected)
  - Validates JWT with `JwtAuthGuard`
  - Applies role authorization with `RolesGuard`
  - Returns authenticated user context

### Security and validation

- JWT authentication configured with:
  - `@nestjs/jwt`
  - `@nestjs/passport`
  - `passport-jwt`
  - `JWT_SECRET` from `.env`
  - token expiration (`1d`)
- Global `ValidationPipe` enabled with:
  - `whitelist: true`
  - `forbidNonWhitelisted: true`
  - `transform: true`
- DTO validation with:
  - `class-validator`
  - `class-transformer`
- Controlled error handling:
  - `UnauthorizedException`
  - `ConflictException`
  - `BadRequestException`
- Passwords are never returned in API responses.

### Backend architecture notes

- Enterprise modular design kept (`AuthModule`, `UsersModule`, `PrismaModule`).
- `PrismaService` remains singleton-based with `OnModuleInit`.
- Auth domain separated from data access (`UsersService`) to avoid logic duplication.
- Base ready for future role-based guards and Socket.IO realtime integration under JWT context.

---

# Backend Migration Progress (FASE 3 - Products Module NestJS + Prisma)

## Implemented: Professional Products Catalog in PostgreSQL

### New backend module

- `src/products`
  - `products.module.ts`
  - `products.controller.ts`
  - `products.service.ts`
  - `dto/create-product.dto.ts`
  - `dto/update-product.dto.ts`
  - `interfaces/authenticated-user.interface.ts`

### New products endpoints

- `POST /products` (COOK only)
- `GET /products` (COOK + WAITER)
- `GET /products/:id` (COOK + WAITER)
- `PATCH /products/:id` (COOK only)
- `DELETE /products/:id` (COOK only)

All endpoints are protected with JWT (`JwtAuthGuard`) and role authorization (`RolesGuard` + `Roles` decorator).

### Multi-taquerÃ­a ownership model

- Product ownership is derived from authenticated `request.user.taqueriaId`.
- Backend never accepts `taqueriaId` from frontend for product ownership.
- Users can only read/modify/delete products belonging to their own taquerÃ­a.
- Cross-taquerÃ­a access is blocked with explicit authorization checks.

### Business validations implemented

- `name` required
- `price` required and positive (`> 0`)
- `complements` optional with max 3 values
- `imageUrl` optional and URL validated
- Product existence checks for read/update/delete
- Ownership checks for update/delete operations

### Security and error handling

- `ForbiddenException` for unauthorized role actions and cross-taquerÃ­a access
- `NotFoundException` for non-existing products
- `BadRequestException` for invalid complements/business validation failures
- `UnauthorizedException` handled through JWT guard flow
- Responses are intentionally minimal (no oversized relations)

### Architecture notes

- Clean controller/service separation maintained.
- Strong typing preserved (no `any`).
- Prisma access remains centralized via `PrismaService` singleton.
- Design is ready for future Socket.IO realtime events, image upload pipelines, analytics, soft delete, and audit trails.

---

# Backend Migration Progress (FASE 4 - Multi-Taqueria Integrity Fix)

## Implemented: Anti-duplication registration + join-taqueria flow

### Database architecture updates

- `Taqueria.name` is now unique.
- `Taqueria.restaurantCode` added as unique short code.
- `restaurantCode` is generated automatically during taqueria creation.

### Auth flow changes

- `POST /auth/register`
  - If taqueria does not exist:
    - creates taqueria
    - generates unique `restaurantCode`
    - creates user
    - returns `accessToken`, `user`, `taqueria`
  - If taqueria already exists:
    - does NOT create duplicate taqueria
    - does NOT create user
    - returns:
      - `message: "Taquería ya existente"`
      - `taqueriaExists: true`
      - `taqueriaName`
      - `canJoin: true`

- Transitional endpoint (`POST /auth/join-taqueria`) was introduced in this phase
  and later replaced in FASE 5 by the unified smart register state-machine.

### Multi-tenant business guarantees

- No duplicate taquerias by name.
- Users in the same taqueria share the same `taqueriaId`.
- Shared catalog consistency is preserved (products/orders/realtime scope by taqueria).
- Cross-tenant isolation remains enforced through `taqueriaId` ownership checks.

### Technical notes

- Prisma migration applied:
  - `20260518045112_multi_taqueria_uniqueness`
- Register/join logic split cleanly in `AuthService` and `UsersService`.
- Unique restaurant code generation includes collision retry logic.

---

# Backend Migration Progress (FASE 5 - Smart Register State Machine)

## Implemented: Single-endpoint intelligent register flow for React Native UX

### Endpoint contract

- `POST /auth/register` is now a 2-phase state-machine:

1. Phase 1 (initial validation)
   - Input: `name`, `email`, `password`, `role`, `taqueriaName`
   - No writes to DB
   - Response if taqueria exists:
     - `taqueriaExists: true`
     - `requiresConfirmation: true`
     - `message: "Esta taquería ya existe. ¿Deseas unirte?"`
   - Response if taqueria does not exist:
     - `taqueriaExists: false`
     - `requiresTaqueriaInfo: true`
     - `message: "La taquería no existe. Completa los datos para crearla."`

2. Phase 2 (final confirmation)
   - Join existing taqueria:
     - same payload + `confirmJoinExistingTaqueria: true`
     - creates user in existing taqueria
     - returns auth response with JWT
   - Create new taqueria:
     - same payload + `createNewTaqueria: true` + `taqueriaData`
     - creates taqueria with unique `restaurantCode`
     - creates user and returns auth response with JWT

### Multi-tenant architecture guarantees

- Single source of truth by taqueria name uniqueness (`Taqueria.name @unique`).
- No duplicated taquerias by accidental register retries.
- Users joining same taqueria share same `taqueriaId`, products, orders, and operational scope.

### Database and model updates

- `Taqueria` now includes:
  - `restaurantCode` (unique)
  - `phone` (optional)
  - `address` (optional)
  - `city` (optional)
  - `state` (optional)
- Prisma migration applied:
  - `20260519021818_register_state_machine_flow`

### Security and validation rules

- Email uniqueness always enforced before any creation.
- Confirmation flags are mutually exclusive.
- No JWT is generated in Phase 1.
- JWT is only generated after user creation.
- Backend prevents confirmation bypass and inconsistent actions.

### Frontend behavior alignment

- React Native can keep single-screen registration UX.
- Backend responses explicitly drive UI decisions (confirm join vs request taqueria data).
- No separate `join-taqueria` endpoint is required in client flow.

---

# Backend Migration Progress (FASE 6 - SaaS Multi-Tenant by RestaurantCode)

## Implemented: Same-name taquerias supported with unique tenant identity

### Final multi-tenant architecture

- `Taqueria.name` is no longer unique.
- `Taqueria.restaurantCode` is the canonical unique tenant identifier.
- Multiple taquerias can share the same display name safely.
- Tenant sharing is defined by:
  - same `taqueriaId`
  - same `restaurantCode`

Users under same tenant share:
- products
- orders
- realtime scope
- operational catalog and kitchen context

### Register state-machine (single endpoint, frontend-aligned)

Endpoint: `POST /auth/register`

#### Phase 1 (discovery, no writes)

Input:
- `name`
- `email`
- `password`
- `role`
- `taqueriaName`

State A: `0` matches

```json
{
  "taqueriaMatches": 0,
  "canCreateNewTaqueria": true,
  "requiresTaqueriaInfo": true,
  "message": "No encontramos una taquería con este nombre. Puedes crear una nueva."
}
```

State B: `1` match

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

State C: `N` matches

```json
{
  "taqueriaMatches": 3,
  "canJoinExistingTaqueria": true,
  "canCreateNewTaqueria": true,
  "taquerias": [
    { "id": "uuid-1", "name": "Taquería El Güero", "restaurantCode": "TM-4821" },
    { "id": "uuid-2", "name": "Taquería El Güero", "restaurantCode": "TM-9182" }
  ],
  "message": "Encontramos varias taquerías con este nombre."
}
```

#### Phase 2 (final action)

Case A: Join existing taqueria

Input:
- base fields +
- `confirmJoinExistingTaqueria: true`
- `selectedRestaurantCode: "TM-4821"`

Behavior:
- validates restaurant code
- reuses existing `taqueriaId`
- creates user
- generates JWT

Case B: Create new taqueria

Input:
- base fields +
- `createNewTaqueria: true`
- `taqueriaData` (phone/address/city/state optional details)

Behavior:
- creates new taqueria even if same name exists
- generates unique `restaurantCode`
- creates user
- generates JWT

### Frontend React Native integration contract

Single-screen flow remains:
1. User submits base form.
2. Backend returns match-state.
3. Frontend adapts UI:
   - show taqueria list (by `restaurantCode`) for join
   - or show extra taqueria form for creation
4. Frontend re-submits to same endpoint with final confirmation flags.
5. Backend returns auth response with JWT only after actual user creation.

### Validation and security rules

- Email uniqueness enforced.
- `restaurantCode` uniqueness enforced.
- `selectedRestaurantCode` required for join confirmation.
- Confirmation flags are mutually exclusive.
- Invalid join/create combinations are rejected.
- Ownership model remains taqueria-scoped in downstream modules (Products/Orders).

### Prisma updates

- `Taqueria.name` uniqueness removed.
- Migration applied:
  - `20260519022139_multi_taqueria_same_name_support`

---

# Backend Migration Progress (ETAPA 4.1 - Orders Core CRUD)

## Implemented: Orders module with immutable edit architecture

### New backend module

- `src/orders`
  - `orders.module.ts`
  - `orders.controller.ts`
  - `orders.service.ts`
  - `dto/create-order.dto.ts`
  - `dto/update-order.dto.ts`
  - `dto/update-order-status.dto.ts`
  - `interfaces/authenticated-user.interface.ts`

### SQL/domain models

- `Order`
  - `id`
  - `taqueriaId`
  - `waiterId`
  - `tableNumber` (visual reference string)
  - `status` (`PENDING`, `PREPARING`, `READY`, `DELIVERED`, `CANCELLED`)
  - `isUpdated`
  - `createdAt`
  - `updatedAt`
- `Plate`
  - `id`
  - `orderId`
  - `plateNumber`
  - `isClosed`
  - `createdAt`
- `Item`
  - `id`
  - `plateId`
  - `productId`
  - `quantity`
  - `selectedComplements`
  - `notes`
  - `isNew`
  - `createdAt`

### Relationships

- `Order` belongs to `Taqueria`
- `Order` belongs to `User` (`waiter`)
- `Order` has many `Plate`
- `Plate` belongs to `Order`
- `Plate` has many `Item`
- `Item` belongs to `Plate`
- `Item` belongs to `Product`

### Endpoints

- `POST /orders`
  - WAITER only
  - creates full order with nested plates/items
- `GET /orders`
  - WAITER: only own orders
  - COOK: all orders from same taqueria
- `GET /orders/:id`
  - ownership and role checks enforced
- `PATCH /orders/:id`
  - WAITER only
  - append-only edit (adds new plates/items, no historical mutation)
- `PATCH /orders/:id/status`
  - COOK only
  - updates order status

### Immutable edit rules (append-only)

- Existing plates/items are treated as immutable historical records.
- Edit flow never mutates old plates/items quantities/products.
- New items are appended inside newly created plates.
- Edited orders are marked `isUpdated = true`.
- Newly appended items are marked `isNew = true`.

### Role and ownership rules

- Multi-taqueria isolation via `taqueriaId` is mandatory in every query.
- WAITER cannot edit orders created by other waiters.
- WAITER cannot update order status.
- COOK can update status and view all orders in same taqueria.
- Cross-tenant access is blocked.

### Validations

- Product IDs must exist and belong to current taqueria.
- Quantities must be positive integers.
- `tableNumber` is required non-empty string (trim applied).
  - valid examples:
    - `Mesa 1`
    - `Mesa Juanita`
    - `Terraza`
    - `Barra 3`
    - `Pedido Uber`
    - `Mesa VIP`
- Status updates must use enum values only.
- Item `notes` is optional string.
  - valid values:
    - omitted
    - `""`
    - `"Sin salsa"`

### Historical consistency

- Orders are not physically deleted in this stage.
- Data model is prepared for future analytics/reports/realtime prioritization.

### Prisma updates

- Enum `OrderStatus` evolved to:
  - `PENDING`
  - `PREPARING`
  - `READY`
  - `DELIVERED`
  - `CANCELLED`
- Migration intent created for orders stage:
  - `orders_core_crud_append_only` (schema aligned in DB)

### Domain correction (Orders)

- `notes` is optional by design and can be empty.
- `tableNumber` represents mesa/pedido visual label, not numeric table index.
