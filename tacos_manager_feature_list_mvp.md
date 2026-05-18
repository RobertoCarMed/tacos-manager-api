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
