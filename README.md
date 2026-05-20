<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

## TacosManager Backend Notes

### Prisma + NestJS integration

- `src/prisma/prisma.service.ts`
  - Extends `PrismaClient`.
  - Implements `OnModuleInit`.
  - Connects with `this.$connect()` once using a static guard to avoid unnecessary multiple connections.
  - Uses Prisma v7 driver adapter (`@prisma/adapter-pg`) with `DATABASE_URL`.
- `src/prisma/prisma.module.ts`
  - Global module (`@Global()`).
  - Registers `PrismaService` in `providers`.
  - Exports `PrismaService` for injection in feature modules.
- `src/app.module.ts`
  - Imports `PrismaModule` once at root module level.
- `src/app.service.ts`
  - Injects `PrismaService`.
  - Executes real query `prisma.taqueria.findMany()`.
  - Returns:
    - `message: 'Prisma funcionando 🚀'`
    - `taquerias`
- `src/main.ts`
  - Loads `.env` at runtime with `import 'dotenv/config'`.

### Auth phase 2 (JWT + Prisma)

- `src/auth/auth.module.ts`
  - Registers JWT/Passport auth stack and binds auth providers.
- `src/auth/auth.controller.ts`
  - Exposes:
    - `POST /auth/register`
    - `POST /auth/login`
    - `GET /auth/me` (protected with JWT guard)
- `src/auth/auth.service.ts`
  - Handles register/login flows, password hashing (`bcrypt`), JWT generation, and safe response shaping.
- `src/auth/dto/register.dto.ts`
  - Validates register payload (`taqueriaName`, `name`, `email`, `password`, `role`).
- `src/auth/dto/login.dto.ts`
  - Validates login payload (`email`, `password`).
- `src/auth/strategies/jwt.strategy.ts`
  - Validates bearer tokens and resolves authenticated user context.
- `src/auth/guards/jwt-auth.guard.ts`
  - Protects private endpoints with Passport JWT strategy.
- `src/users/users.module.ts` and `src/users/users.service.ts`
  - Centralize user data access with Prisma and avoid auth/service duplication.

### Environment variables

- `DATABASE_URL`: PostgreSQL connection string.
- `JWT_SECRET`: signing secret for access tokens.

### Multi-taqueria integrity update

- `Taqueria.name` is **not unique**.
- `Taqueria.restaurantCode` is the real unique tenant identifier and is generated automatically.
- `POST /auth/register` works as a two-phase state machine (single endpoint).
- No separate join endpoint is required.
- `Taqueria` stores optional metadata for creation flow:
  - `phone`
  - `address`
  - `city`
  - `state`

#### Smart register states (single endpoint)

Phase 1 request:

```json
{
  "name": "User",
  "email": "user@demo.com",
  "password": "secret123",
  "role": "COOK",
  "taqueriaName": "Taqueria El Guero"
}
```

`0` matches response:

```json
{
  "taqueriaMatches": 0,
  "canCreateNewTaqueria": true,
  "requiresTaqueriaInfo": true,
  "message": "No encontramos una taquería con este nombre. Puedes crear una nueva."
}
```

`1` match response:

```json
{
  "taqueriaMatches": 1,
  "canJoinExistingTaqueria": true,
  "canCreateNewTaqueria": true,
  "taquerias": [
    {
      "id": "uuid",
      "name": "Taqueria El Guero",
      "restaurantCode": "TM-4821"
    }
  ],
  "message": "Encontramos una taquería con este nombre."
}
```

`N` matches response:

```json
{
  "taqueriaMatches": 3,
  "canJoinExistingTaqueria": true,
  "canCreateNewTaqueria": true,
  "taquerias": [
    { "id": "uuid-1", "name": "Taqueria El Guero", "restaurantCode": "TM-4821" },
    { "id": "uuid-2", "name": "Taqueria El Guero", "restaurantCode": "TM-9182" }
  ],
  "message": "Encontramos varias taquerías con este nombre."
}
```

Phase 2 join request:

```json
{
  "name": "User",
  "email": "user@demo.com",
  "password": "secret123",
  "role": "WAITER",
  "taqueriaName": "Taqueria El Guero",
  "confirmJoinExistingTaqueria": true,
  "selectedRestaurantCode": "TM-4821"
}
```

Phase 2 create request:

```json
{
  "name": "User",
  "email": "user@demo.com",
  "password": "secret123",
  "role": "COOK",
  "taqueriaName": "Taqueria El Guero",
  "createNewTaqueria": true,
  "taqueriaData": {
    "phone": "5551231234",
    "address": "Av. Centro 123",
    "city": "CDMX",
    "state": "CDMX"
  }
}
```

### Products phase 3 (Catalog + Multi-taqueria + Roles)

- `src/products/products.module.ts`
  - Registers products controller/service.
- `src/products/products.controller.ts`
  - CRUD endpoints with JWT protection and role-based access.
- `src/products/products.service.ts`
  - Encapsulates product business logic, ownership validation, and Prisma access.
- `src/products/dto/create-product.dto.ts`
  - Validates product creation payload (`name`, `price`, `imageUrl`, `complements`).
- `src/products/dto/update-product.dto.ts`
  - Validates partial updates with same business constraints.
- `src/products/interfaces/authenticated-user.interface.ts`
  - Typed auth user context extracted from `request.user`.

#### Products endpoints

- `POST /products` (COOK)
- `GET /products` (COOK, WAITER)
- `GET /products/:id` (COOK, WAITER)
- `PATCH /products/:id` (COOK)
- `DELETE /products/:id` (COOK)

#### Core rules

- Every product belongs to one taqueria.
- Backend derives taqueria ownership from JWT user context only.
- Cross-taqueria access is forbidden.
- Complements are limited to max 3 items.

### Orders phase 4.1 (Core CRUD + append-only edit)

- `src/orders/orders.module.ts`
- `src/orders/orders.controller.ts`
- `src/orders/orders.service.ts`
- `src/orders/dto/create-order.dto.ts`
- `src/orders/dto/update-order.dto.ts`
- `src/orders/dto/update-order-status.dto.ts`

Endpoints:
- `POST /orders` (WAITER)
- `GET /orders` (WAITER own orders, COOK all taqueria orders)
- `GET /orders/:id` (ownership and role checks)
- `PATCH /orders/:id` (WAITER, append-only editing)
- `PATCH /orders/:id/status` (COOK only)

Business rules:
- No physical order delete (historical continuity).
- Edited orders set `isUpdated = true`.
- New items added during edit set `isNew = true`.
- Existing plates/items are treated as immutable history; edits append new plates.
- `tableNumber` is a required visual reference string (not numeric-only), e.g.:
  - `Mesa 1`
  - `Barra 3`
  - `Pedido Uber`
- Item `notes` is optional and supports:
  - omitted
  - empty string `""`
  - regular string value
