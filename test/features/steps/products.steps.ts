// Products steps — cubre @REQ-0010 a @REQ-0015 (specs/products-management).
import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import type { TacosWorld } from '../world';
import { createProduct, createUser } from '../support/seed';
import { http } from '../support/http';

Given(
  'un COOK autenticado de {string} con {int} productos en su catálogo',
  async function (this: TacosWorld, code: string, count: number) {
    const cook = await createUser(this, {
      email: `cook-${code}@example.com`,
      password: 'secret123',
      role: 'COOK',
      restaurantCode: code,
      alias: 'cook',
    });
    this.currentUser = cook;
    this.currentToken = cook.token;
    for (let i = 0; i < count; i++) {
      await createProduct(this, {
        name: `Producto ${i + 1}`,
        price: 50 + i,
        restaurantCode: code,
      });
    }
  },
);

When('hace GET \\/products', async function (this: TacosWorld) {
  await http(this, 'get', '/products', { token: this.currentToken });
});

Then(
  'recibe {int} con {int} productos, todos con taqueriaId de {string}',
  function (this: TacosWorld, status: number, count: number, code: string) {
    assert.equal(this.lastResponse?.status, status);
    const body = this.lastResponse?.body as any[];
    assert.equal(body.length, count);
    const expectedTaqueriaId = this.taquerias.get(code)!.id;
    for (const p of body) assert.equal(p.taqueriaId, expectedTaqueriaId);
  },
);

Given(
  'un WAITER autenticado de {string}',
  async function (this: TacosWorld, code: string) {
    const waiter = await createUser(this, {
      email: `waiter-${code}@example.com`,
      password: 'secret123',
      role: 'WAITER',
      restaurantCode: code,
      alias: 'waiter',
    });
    this.currentUser = waiter;
    this.currentToken = waiter.token;
  },
);

Then(
  'recibe {int} con la lista completa del catálogo de {string}',
  function (this: TacosWorld, status: number, code: string) {
    assert.equal(this.lastResponse?.status, status);
    const body = this.lastResponse?.body as any[];
    const expectedTaqueriaId = this.taquerias.get(code)!.id;
    for (const p of body) assert.equal(p.taqueriaId, expectedTaqueriaId);
  },
);

Given('un WAITER autenticado', async function (this: TacosWorld) {
  const waiter = await createUser(this, {
    email: `waiter-default@example.com`,
    password: 'secret123',
    role: 'WAITER',
    restaurantCode: 'TM-0001',
    alias: 'waiter',
  });
  this.currentUser = waiter;
  this.currentToken = waiter.token;
});

When(
  'hace POST \\/products con datos válidos',
  async function (this: TacosWorld) {
    await http(this, 'post', '/products', {
      token: this.currentToken,
      body: { name: 'Quesadilla', price: 35 },
    });
  },
);

When(
  'un WAITER hace PATCH \\/products\\/<id>',
  async function (this: TacosWorld) {
    if (!this.currentUser || this.currentUser.role !== 'WAITER') {
      const waiter = await createUser(this, {
        email: `waiter-patch@example.com`,
        password: 'secret123',
        role: 'WAITER',
        restaurantCode: 'TM-0001',
      });
      this.currentUser = waiter;
      this.currentToken = waiter.token;
    }
    // Seed a product owned by another COOK in same tenant so PATCH is meaningful.
    const product = await createProduct(this, {
      name: 'Existente',
      price: 50,
      restaurantCode: this.currentUser.restaurantCode,
    });
    await http(this, 'patch', `/products/${product.id}`, {
      token: this.currentToken,
      body: { price: 99 },
    });
  },
);

When(
  'un WAITER hace DELETE \\/products\\/<id>',
  async function (this: TacosWorld) {
    if (!this.currentUser || this.currentUser.role !== 'WAITER') {
      const waiter = await createUser(this, {
        email: `waiter-delete@example.com`,
        password: 'secret123',
        role: 'WAITER',
        restaurantCode: 'TM-0001',
      });
      this.currentUser = waiter;
      this.currentToken = waiter.token;
    }
    const product = await createProduct(this, {
      name: 'AEliminar',
      price: 50,
      restaurantCode: this.currentUser.restaurantCode,
    });
    await http(this, 'delete', `/products/${product.id}`, {
      token: this.currentToken,
    });
  },
);

Given(
  'un producto P de taquería {string}',
  async function (this: TacosWorld, code: string) {
    const p = await createProduct(this, {
      name: 'Producto ajeno',
      price: 80,
      restaurantCode: code,
      alias: 'P',
    });
    (this as any).productP = p;
  },
);

Given(
  'un usuario autenticado de {string}',
  async function (this: TacosWorld, code: string) {
    const user = await createUser(this, {
      email: `iso-${code}@example.com`,
      password: 'secret123',
      role: 'WAITER',
      restaurantCode: code,
    });
    this.currentUser = user;
    this.currentToken = user.token;
  },
);

When('intenta GET \\/products\\/<id-de-P>', async function (this: TacosWorld) {
  const p = (this as any).productP;
  await http(this, 'get', `/products/${p.id}`, { token: this.currentToken });
});
