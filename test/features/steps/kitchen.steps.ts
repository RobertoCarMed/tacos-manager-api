// Kitchen steps — cubre @REQ-0040 a @REQ-0046 (specs/kitchen-queue).
import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import type { TacosWorld } from '../world';
import { createProduct, createUser } from '../support/seed';
import { http } from '../support/http';
import { connectSocket, waitFor, waitForEvent } from '../support/socket';
import { PrismaService } from '../../../src/prisma/prisma.service';

Given(
  'un COOK autenticado de {string}',
  async function (this: TacosWorld, code: string) {
    const cook = await createUser(this, {
      email: `cook-k-${code}@example.com`,
      password: 'secret123',
      role: 'COOK',
      restaurantCode: code,
      alias: 'cook',
    });
    this.currentUser = cook;
    this.currentToken = cook.token;
  },
);

Given(
  'una orden O en {string}',
  async function (this: TacosWorld, status: string) {
    const cook = this.currentUser!;
    // Necesitamos un WAITER para crear la orden, luego forzamos el status.
    const waiter = await createUser(this, {
      email: `waiter-k-${cook.restaurantCode}-${Date.now()}@example.com`,
      password: 'secret123',
      role: 'WAITER',
      restaurantCode: cook.restaurantCode,
    });
    const product = await createProduct(this, {
      name: `Producto k ${Date.now()}`,
      price: 30,
      restaurantCode: cook.restaurantCode,
    });
    await http(this, 'post', '/orders', {
      token: waiter.token,
      body: {
        type: 'DINE_IN',
        reference: 'Mesa K',
        plates: [
          { plateNumber: 1, items: [{ productId: product.id, quantity: 1 }] },
        ],
      },
    });
    assert.equal(this.lastResponse?.status, 201);
    const order = this.lastResponse.body;
    this.currentOrderId = order.id;
    this.orders.set('O', order);

    if (status !== 'PENDING') {
      const prisma = this.app().get(PrismaService);
      await prisma.order.update({
        where: { id: order.id },
        data: { status: status as any },
      });
    }
  },
);

When(
  'hace PATCH \\/orders\\/<id-de-O>\\/status con status={string}',
  async function (this: TacosWorld, status: string) {
    await http(this, 'patch', `/orders/${this.currentOrderId}/status`, {
      token: this.currentToken,
      body: { status },
    });
  },
);

Then('la orden queda en {string}', function (this: TacosWorld, status: string) {
  assert.equal(this.lastResponse?.body?.status, status);
});

When(
  'un COOK hace PATCH \\/orders\\/<id>\\/status con status={string}',
  async function (this: TacosWorld, status: string) {
    if (!this.currentUser || this.currentUser.role !== 'COOK') {
      const cook = await createUser(this, {
        email: 'cook-updated@example.com',
        password: 'secret123',
        role: 'COOK',
        restaurantCode: 'TM-0001',
      });
      this.currentUser = cook;
      this.currentToken = cook.token;
    }
    if (!this.currentOrderId) {
      // Crear orden mínima si el escenario no tiene Given previo.
      const waiter = await createUser(this, {
        email: `waiter-u-${Date.now()}@example.com`,
        password: 'secret123',
        role: 'WAITER',
        restaurantCode: this.currentUser.restaurantCode,
      });
      const product = await createProduct(this, {
        name: `Prod u ${Date.now()}`,
        price: 10,
        restaurantCode: this.currentUser.restaurantCode,
      });
      await http(this, 'post', '/orders', {
        token: waiter.token,
        body: {
          type: 'DINE_IN',
          reference: 'Mesa U',
          plates: [
            { plateNumber: 1, items: [{ productId: product.id, quantity: 1 }] },
          ],
        },
      });
      this.currentOrderId = this.lastResponse!.body.id;
      this.snapshot = this.lastResponse!.body;
    }
    await http(this, 'patch', `/orders/${this.currentOrderId}/status`, {
      token: this.currentToken,
      body: { status },
    });
  },
);

Then('la orden mantiene su status previo', async function (this: TacosWorld) {
  const prisma = this.app().get(PrismaService);
  const fresh = await prisma.order.findUnique({
    where: { id: this.currentOrderId! },
  });
  const previous = this.snapshot?.status ?? 'PENDING';
  assert.equal(fresh?.status, previous);
});

Given(
  'una orden con {int} items, {int} de ellos con isNew={word}',
  async function (this: TacosWorld, total: number, news: number, _val: string) {
    const cook =
      this.currentUser?.role === 'COOK'
        ? this.currentUser
        : await createUser(this, {
            email: 'cook-isnew@example.com',
            password: 'secret123',
            role: 'COOK',
            restaurantCode: 'TM-0001',
            alias: 'cook',
          });
    if (this.currentUser?.role !== 'COOK') {
      this.currentUser = cook;
      this.currentToken = cook.token;
    }
    const waiter = await createUser(this, {
      email: `waiter-isnew-${Date.now()}@example.com`,
      password: 'secret123',
      role: 'WAITER',
      restaurantCode: cook.restaurantCode,
    });
    const product = await createProduct(this, {
      name: `IsNewProd ${Date.now()}`,
      price: 20,
      restaurantCode: cook.restaurantCode,
    });
    await http(this, 'post', '/orders', {
      token: waiter.token,
      body: {
        type: 'DINE_IN',
        reference: 'Mesa IN',
        plates: [
          {
            plateNumber: 1,
            items: Array.from({ length: total }, () => ({
              productId: product.id,
              quantity: 1,
            })),
          },
        ],
      },
    });
    assert.equal(this.lastResponse?.status, 201);
    const order = this.lastResponse.body;
    this.currentOrderId = order.id;

    // Forzar isNew=true en los primeros `news` items.
    const prisma = this.app().get(PrismaService);
    const items = await prisma.item.findMany({
      where: { plate: { orderId: order.id } },
      orderBy: { createdAt: 'asc' },
    });
    const toMark = items.slice(0, news).map((i) => i.id);
    await prisma.item.updateMany({
      where: { id: { in: toMark } },
      data: { isNew: true },
    });
  },
);

When(
  'un COOK cambia el status a {string}',
  async function (this: TacosWorld, status: string) {
    await http(this, 'patch', `/orders/${this.currentOrderId}/status`, {
      token: this.currentToken,
      body: { status },
    });
  },
);

Then(
  'los {int} items quedan con isNew={word}',
  async function (this: TacosWorld, count: number, val: string) {
    const expected = val === 'true';
    const prisma = this.app().get(PrismaService);
    const items = await prisma.item.findMany({
      where: { plate: { orderId: this.currentOrderId! } },
    });
    assert.equal(items.length, count);
    for (const it of items) assert.equal(it.isNew, expected);
  },
);

Given(
  'órdenes con status PREPARING, PENDING, READY, DELIVERED, CANCELLED',
  async function (this: TacosWorld) {
    const cook = await createUser(this, {
      email: 'cook-q@example.com',
      password: 'secret123',
      role: 'COOK',
      restaurantCode: 'TM-0001',
      alias: 'cook',
    });
    this.currentUser = cook;
    this.currentToken = cook.token;
    const waiter = await createUser(this, {
      email: 'waiter-q@example.com',
      password: 'secret123',
      role: 'WAITER',
      restaurantCode: 'TM-0001',
    });
    const product = await createProduct(this, {
      name: 'QueueProd',
      price: 10,
      restaurantCode: 'TM-0001',
    });
    const statuses = [
      'PREPARING',
      'PENDING',
      'READY',
      'DELIVERED',
      'CANCELLED',
    ];
    const prisma = this.app().get(PrismaService);
    for (const status of statuses) {
      await http(this, 'post', '/orders', {
        token: waiter.token,
        body: {
          type: 'DINE_IN',
          reference: `Mesa ${status}`,
          plates: [
            { plateNumber: 1, items: [{ productId: product.id, quantity: 1 }] },
          ],
        },
      });
      const order = this.lastResponse!.body;
      await prisma.order.update({
        where: { id: order.id },
        data: { status: status as any },
      });
    }
  },
);

When('un COOK hace GET \\/orders', async function (this: TacosWorld) {
  await http(this, 'get', '/orders', { token: this.currentToken });
});

Then(
  'el orden devuelto es: PREPARING > PENDING > READY > DELIVERED > CANCELLED',
  function (this: TacosWorld) {
    const body = this.lastResponse?.body as any[];
    const expected = [
      'PREPARING',
      'PENDING',
      'READY',
      'DELIVERED',
      'CANCELLED',
    ];
    assert.deepEqual(
      body.map((o) => o.status),
      expected,
    );
  },
);

Given(
  '{int} órdenes en PENDING creadas en 10:00, 10:05, 10:10',
  async function (this: TacosWorld, n: number) {
    const cook = await createUser(this, {
      email: 'cook-fifo@example.com',
      password: 'secret123',
      role: 'COOK',
      restaurantCode: 'TM-0001',
      alias: 'cook',
    });
    this.currentUser = cook;
    this.currentToken = cook.token;
    const waiter = await createUser(this, {
      email: 'waiter-fifo@example.com',
      password: 'secret123',
      role: 'WAITER',
      restaurantCode: 'TM-0001',
    });
    const product = await createProduct(this, {
      name: 'FifoProd',
      price: 10,
      restaurantCode: 'TM-0001',
    });
    const prisma = this.app().get(PrismaService);
    const offsets = [0, 5 * 60_000, 10 * 60_000].slice(0, n);
    const base = new Date('2030-01-01T10:00:00Z').getTime();
    for (const offset of offsets) {
      await http(this, 'post', '/orders', {
        token: waiter.token,
        body: {
          type: 'DINE_IN',
          reference: `Mesa ${offset}`,
          plates: [
            { plateNumber: 1, items: [{ productId: product.id, quantity: 1 }] },
          ],
        },
      });
      const order = this.lastResponse!.body;
      const when = new Date(base + offset);
      await prisma.order.update({
        where: { id: order.id },
        data: { priorityTimestamp: when, createdAt: when },
      });
    }
  },
);

When('se hace GET \\/orders', async function (this: TacosWorld) {
  await http(this, 'get', '/orders', { token: this.currentToken });
});

Then(
  'las PENDING aparecen en orden 10:00 → 10:05 → 10:10',
  function (this: TacosWorld) {
    const body = this.lastResponse?.body as any[];
    const pending = body.filter((o) => o.status === 'PENDING');
    const stamps = pending.map((o) => new Date(o.priorityTimestamp).getTime());
    for (let i = 1; i < stamps.length; i++) {
      assert.ok(stamps[i] >= stamps[i - 1], `orden FIFO rota en posición ${i}`);
    }
    assert.equal(pending.length, 3);
  },
);

// REQ-0045
Given('un COOK conectado a Socket.IO', async function (this: TacosWorld) {
  const cook =
    this.currentUser?.role === 'COOK'
      ? this.currentUser
      : await createUser(this, {
          email: 'cook-rt@example.com',
          password: 'secret123',
          role: 'COOK',
          restaurantCode: 'TM-0001',
          alias: 'cook',
        });
  this.currentUser = cook;
  this.currentToken = cook.token;
  await connectSocket(this, 'cook-rt', { token: cook.token });
});

When(
  'otro COOK cambia el status de una orden',
  async function (this: TacosWorld) {
    // Crear segundo COOK + orden + cambiar status.
    const cook = this.currentUser!;
    const cook2 = await createUser(this, {
      email: 'cook2-rt@example.com',
      password: 'secret123',
      role: 'COOK',
      restaurantCode: cook.restaurantCode,
    });
    const waiter = await createUser(this, {
      email: 'waiter-rt@example.com',
      password: 'secret123',
      role: 'WAITER',
      restaurantCode: cook.restaurantCode,
    });
    const product = await createProduct(this, {
      name: 'RtProd',
      price: 10,
      restaurantCode: cook.restaurantCode,
    });
    await http(this, 'post', '/orders', {
      token: waiter.token,
      body: {
        type: 'DINE_IN',
        reference: 'Mesa RT',
        plates: [
          { plateNumber: 1, items: [{ productId: product.id, quantity: 1 }] },
        ],
      },
    });
    const order = this.lastResponse!.body;
    this.currentOrderId = order.id;
    await waitFor(50);
    await http(this, 'patch', `/orders/${order.id}/status`, {
      token: cook2.token,
      body: { status: 'PREPARING' },
    });
    await waitFor(150);
  },
);

Then(
  'el primer COOK recibe {string} con la orden actualizada',
  async function (this: TacosWorld, event: string) {
    const tracked = this.sockets.get('cook-rt');
    assert.ok(tracked, 'cook-rt socket no conectado');
    const ok = await waitForEvent(tracked, event, 1500);
    assert.ok(
      ok,
      `Esperaba ${event}, eventos: ${JSON.stringify(tracked.events.map((e) => e.name))}`,
    );
  },
);

When(
  'un WAITER hace PATCH \\/orders\\/<id>\\/status',
  async function (this: TacosWorld) {
    const waiter = await createUser(this, {
      email: 'waiter-403@example.com',
      password: 'secret123',
      role: 'WAITER',
      restaurantCode: 'TM-0001',
    });
    // Crear orden con otro waiter.
    const waiter2 = await createUser(this, {
      email: 'waiter-403-owner@example.com',
      password: 'secret123',
      role: 'WAITER',
      restaurantCode: 'TM-0001',
    });
    const product = await createProduct(this, {
      name: 'Prod403',
      price: 10,
      restaurantCode: 'TM-0001',
    });
    await http(this, 'post', '/orders', {
      token: waiter2.token,
      body: {
        type: 'DINE_IN',
        reference: 'Mesa 403',
        plates: [
          { plateNumber: 1, items: [{ productId: product.id, quantity: 1 }] },
        ],
      },
    });
    const order = this.lastResponse!.body;
    this.currentOrderId = order.id;
    await http(this, 'patch', `/orders/${order.id}/status`, {
      token: waiter.token,
      body: { status: 'PREPARING' },
    });
  },
);
