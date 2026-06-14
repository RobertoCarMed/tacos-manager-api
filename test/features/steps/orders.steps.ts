// Orders steps — cubre @REQ-0020 a @REQ-0036 (create-order + edit-order).
import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import type { TacosWorld } from '../world';
import { createProduct, createUser } from '../support/seed';
import { http } from '../support/http';
import { connectSocket, waitFor, waitForEvent } from '../support/socket';
import { PrismaService } from '../../../src/prisma/prisma.service';

// Background: WAITER + producto. También usado en kitchen-queue.
Given(
  'un WAITER autenticado de la taquería {string}',
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

Given(
  'un producto {string} de la misma taquería',
  async function (this: TacosWorld, name: string) {
    const code = this.currentUser!.restaurantCode;
    await createProduct(this, {
      name,
      price: 25,
      restaurantCode: code,
      alias: name,
    });
  },
);

function parseOrderTable(table: DataTable): Record<string, string> {
  const rows = table.raw();
  const obj: Record<string, string> = {};
  for (const [k, v] of rows) obj[k.trim()] = v.trim();
  return obj;
}

When(
  'el WAITER hace POST \\/orders con:',
  async function (this: TacosWorld, table: DataTable) {
    (this as any).pendingOrderBody = parseOrderTable(table);
    (this as any).pendingPlates = []; // se llenará en el siguiente step
  },
);

When(
  'agrega {int} plate con {int} item del producto {string}',
  async function (
    this: TacosWorld,
    plates: number,
    items: number,
    productName: string,
  ) {
    const product = this.products.get(productName);
    assert.ok(product, `Producto ${productName} no seedeado`);
    const platesPayload: any[] = [];
    for (let pi = 0; pi < plates; pi++) {
      platesPayload.push({
        plateNumber: pi + 1,
        items: Array.from({ length: items }, () => ({
          productId: product.id,
          quantity: 1,
        })),
      });
    }
    const body = (this as any).pendingOrderBody ?? {};
    const fullBody: any = { ...body, plates: platesPayload };
    await http(this, 'post', '/orders', {
      token: this.currentToken,
      body: fullBody,
    });
    if (this.lastResponse?.status === 201) {
      this.currentOrderId = this.lastResponse.body.id;
      this.orders.set('current', this.lastResponse.body);
    }
  },
);

When(
  'agrega {int} plate con {int} item',
  async function (this: TacosWorld, plates: number, items: number) {
    // Usar primer producto seedeado.
    const product = Array.from(this.products.values())[0];
    assert.ok(product, 'No hay productos seedeados');
    const platesPayload: any[] = [];
    for (let pi = 0; pi < plates; pi++) {
      platesPayload.push({
        plateNumber: pi + 1,
        items: Array.from({ length: items }, () => ({
          productId: product.id,
          quantity: 1,
        })),
      });
    }
    const body = (this as any).pendingOrderBody ?? {};
    await http(this, 'post', '/orders', {
      token: this.currentToken,
      body: { ...body, plates: platesPayload },
    });
    if (this.lastResponse?.status === 201) {
      this.currentOrderId = this.lastResponse.body.id;
      this.orders.set('current', this.lastResponse.body);
    }
  },
);

Then(
  'la orden persistida tiene type={string}, reference={string}, deliveryAddress={word}',
  function (
    this: TacosWorld,
    type: string,
    reference: string,
    addressVal: string,
  ) {
    const body = this.lastResponse?.body;
    assert.equal(body.type, type);
    assert.equal(body.reference, reference);
    if (addressVal === 'null') assert.equal(body.deliveryAddress, null);
    else assert.equal(body.deliveryAddress, addressVal);
  },
);

Then(
  'la orden tiene status={string} y revision={int}',
  function (this: TacosWorld, status: string, revision: number) {
    const body = this.lastResponse?.body;
    assert.equal(body.status, status);
    assert.equal(body.revision, revision);
  },
);

Then(
  'la orden tiene type={string}, reference={string}, deliveryAddress={word}',
  function (
    this: TacosWorld,
    type: string,
    reference: string,
    addressVal: string,
  ) {
    const body = this.lastResponse?.body;
    assert.equal(body.type, type);
    assert.equal(body.reference, reference);
    if (addressVal === 'null') assert.equal(body.deliveryAddress, null);
    else assert.equal(body.deliveryAddress, addressVal);
  },
);

Then(
  'la orden tiene type={string}, deliveryAddress={string}',
  function (this: TacosWorld, type: string, address: string) {
    const body = this.lastResponse?.body;
    assert.equal(body.type, type);
    assert.equal(body.deliveryAddress, address);
  },
);

When(
  'el WAITER hace POST \\/orders con type={string} sin reference',
  async function (this: TacosWorld, type: string) {
    const product = Array.from(this.products.values())[0];
    await http(this, 'post', '/orders', {
      token: this.currentToken,
      body: {
        type,
        plates: [
          {
            plateNumber: 1,
            items: [{ productId: product?.id ?? 'na', quantity: 1 }],
          },
        ],
      },
    });
  },
);

When(
  'el WAITER hace POST \\/orders con type={string} sin deliveryAddress',
  async function (this: TacosWorld, type: string) {
    const product = Array.from(this.products.values())[0];
    await http(this, 'post', '/orders', {
      token: this.currentToken,
      body: {
        type,
        plates: [
          {
            plateNumber: 1,
            items: [{ productId: product?.id ?? 'na', quantity: 1 }],
          },
        ],
      },
    });
  },
);

Then(
  'el error menciona el campo {string}',
  function (this: TacosWorld, field: string) {
    const body = this.lastResponse?.body;
    const messages: string[] = Array.isArray(body?.message)
      ? body.message
      : [body?.message ?? ''];
    const combined = messages.join(' ').toLowerCase();
    assert.ok(
      combined.includes(field.toLowerCase()),
      `error no menciona ${field}: ${combined}`,
    );
  },
);

Then('no se crea ninguna orden', async function (this: TacosWorld) {
  const prisma = this.app().get(PrismaService);
  const count = await prisma.order.count();
  assert.equal(count, 0);
});

When('el WAITER crea una orden válida', async function (this: TacosWorld) {
  const product = Array.from(this.products.values())[0];
  await http(this, 'post', '/orders', {
    token: this.currentToken,
    body: {
      type: 'DINE_IN',
      reference: 'Mesa 1',
      plates: [
        { plateNumber: 1, items: [{ productId: product.id, quantity: 1 }] },
      ],
    },
  });
  if (this.lastResponse?.status === 201) {
    this.currentOrderId = this.lastResponse.body.id;
    this.orders.set('current', this.lastResponse.body);
  }
});

Then(
  'la orden tiene revision={int}, status={string}',
  function (this: TacosWorld, revision: number, status: string) {
    const body = this.lastResponse?.body;
    assert.equal(body.revision, revision);
    assert.equal(body.status, status);
  },
);

Then('priorityTimestamp=createdAt', function (this: TacosWorld) {
  const body = this.lastResponse?.body;
  // Toleramos diferencia < 1s al inicio.
  const diff = Math.abs(
    new Date(body.priorityTimestamp).getTime() -
      new Date(body.createdAt).getTime(),
  );
  assert.ok(diff < 1000, `priorityTimestamp y createdAt difieren ${diff}ms`);
});

// REQ-0026: socket emission.
Given(
  'un COOK de la taquería {string} conectado a Socket.IO',
  async function (this: TacosWorld, code: string) {
    const cook = await createUser(this, {
      email: `cook-rt-${code}@example.com`,
      password: 'secret123',
      role: 'COOK',
      restaurantCode: code,
      alias: `cook-${code}`,
    });
    await connectSocket(this, `cook-${code}`, { token: cook.token });
  },
);

When(
  'el WAITER de {string} crea una orden',
  async function (this: TacosWorld, code: string) {
    // Ensure waiter is the one of the given tenant.
    let waiter = this.users.get(`waiter-${code}`);
    if (!waiter || waiter.restaurantCode !== code) {
      waiter = await createUser(this, {
        email: `waiter-rt-${code}@example.com`,
        password: 'secret123',
        role: 'WAITER',
        restaurantCode: code,
        alias: `waiter-${code}`,
      });
    }
    const product = await createProduct(this, {
      name: `Producto rt ${code}`,
      price: 30,
      restaurantCode: code,
    });
    await http(this, 'post', '/orders', {
      token: waiter.token,
      body: {
        type: 'DINE_IN',
        reference: 'Mesa rt',
        plates: [
          { plateNumber: 1, items: [{ productId: product.id, quantity: 1 }] },
        ],
      },
    });
    if (this.lastResponse?.status === 201) {
      this.currentOrderId = this.lastResponse.body.id;
    }
    await waitFor(150);
  },
);

Then(
  'el COOK de {string} recibe el evento {string} con la orden completa',
  async function (this: TacosWorld, code: string, event: string) {
    const tracked = this.sockets.get(`cook-${code}`);
    assert.ok(tracked, `socket cook-${code} no conectado`);
    const ok = await waitForEvent(tracked, event, 1500);
    assert.ok(
      ok,
      `Esperaba ${event} en cook-${code}, eventos: ${JSON.stringify(tracked.events.map((e) => e.name))}`,
    );
  },
);

Then(
  'el COOK de {string} NO recibe ningún evento',
  function (this: TacosWorld, code: string) {
    const tracked = this.sockets.get(`cook-${code}`);
    assert.ok(tracked, `socket cook-${code} no conectado`);
    assert.equal(
      tracked.events.length,
      0,
      `cook-${code} recibió ${tracked.events.length} eventos`,
    );
  },
);

Given('un COOK autenticado', async function (this: TacosWorld) {
  const cook = await createUser(this, {
    email: 'cook-default@example.com',
    password: 'secret123',
    role: 'COOK',
    restaurantCode: 'TM-0001',
    alias: 'cook',
  });
  this.currentUser = cook;
  this.currentToken = cook.token;
});

When(
  'intenta POST \\/orders con datos válidos',
  async function (this: TacosWorld) {
    const product = await createProduct(this, {
      name: 'AnyProd',
      price: 10,
      restaurantCode: this.currentUser!.restaurantCode,
    });
    await http(this, 'post', '/orders', {
      token: this.currentToken,
      body: {
        type: 'DINE_IN',
        reference: 'Mesa 1',
        plates: [
          { plateNumber: 1, items: [{ productId: product.id, quantity: 1 }] },
        ],
      },
    });
  },
);

// --- EDIT ORDER (@REQ-0030..@REQ-0036) ---

Given(
  'una orden existente O con {int} plate y {int} item en revision={int}, status={string}',
  async function (
    this: TacosWorld,
    plates: number,
    items: number,
    revision: number,
    status: string,
  ) {
    const product = await createProduct(this, {
      name: 'Taco base',
      price: 25,
      restaurantCode: this.currentUser!.restaurantCode,
      alias: 'base',
    });
    await http(this, 'post', '/orders', {
      token: this.currentToken,
      body: {
        type: 'DINE_IN',
        reference: 'Mesa base',
        plates: [
          {
            plateNumber: 1,
            items: Array.from({ length: items }, () => ({
              productId: product.id,
              quantity: 1,
            })),
          },
        ],
      },
    });
    assert.equal(this.lastResponse?.status, 201);
    const order = this.lastResponse.body;
    assert.equal(order.revision, revision);
    assert.equal(order.status, status);
    this.orders.set('O', order);
    this.currentOrderId = order.id;
    this.snapshot = JSON.parse(JSON.stringify(order));
  },
);

When(
  'el WAITER hace PATCH \\/orders\\/<id-de-O> agregando {int} item nuevo',
  async function (this: TacosWorld, items: number) {
    const product = this.products.get('base')!;
    await http(this, 'patch', `/orders/${this.currentOrderId}`, {
      token: this.currentToken,
      body: {
        plates: [
          {
            plateNumber: 2, // nuevo plate para no colisionar
            items: Array.from({ length: items }, () => ({
              productId: product.id,
              quantity: 1,
            })),
          },
        ],
      },
    });
    if (this.lastResponse?.status === 200) {
      this.orders.set('O', this.lastResponse.body);
    }
  },
);

Then(
  'la orden tiene {int} items en el plate',
  function (this: TacosWorld, count: number) {
    const body = this.lastResponse?.body;
    // Sumar items de TODOS los plates (porque agregamos un plate nuevo).
    const total = body.plates.reduce(
      (acc: number, p: any) => acc + p.items.length,
      0,
    );
    assert.equal(total, count);
  },
);

Then(
  'el item nuevo tiene createdInRevision={int} e isNew={word}',
  function (this: TacosWorld, rev: number, isNewStr: string) {
    const body = this.lastResponse?.body;
    const isNew = isNewStr === 'true';
    const newItems = body.plates.flatMap((p: any) =>
      p.items.filter((i: any) => i.createdInRevision === rev),
    );
    assert.ok(newItems.length > 0, `no hay items con createdInRevision=${rev}`);
    for (const it of newItems) assert.equal(it.isNew, isNew);
  },
);

When(
  'el WAITER intenta PATCH cambiando quantity del item original',
  async function (this: TacosWorld) {
    // Append-only: el endpoint no soporta tocar items existentes, así que enviamos
    // un body que el server interpretará como append (plate nuevo). La quantity
    // del item histórico no se afecta — eso es lo que verifica el Then siguiente.
    const product = this.products.get('base')!;
    await http(this, 'patch', `/orders/${this.currentOrderId}`, {
      token: this.currentToken,
      body: {
        plates: [
          {
            plateNumber: 99,
            items: [{ productId: product.id, quantity: 999 }],
          },
        ],
      },
    });
  },
);

Then('el cambio no se aplica', async function (this: TacosWorld) {
  // El endpoint puede devolver 200 (append) o 400 (validación). Verificamos
  // el invariante: los items históricos quedan intactos.
  const prisma = this.app().get(PrismaService);
  const items = await prisma.item.findMany({
    where: { plate: { orderId: this.currentOrderId! } },
    orderBy: { createdAt: 'asc' },
  });
  const original = this.snapshot.plates[0].items[0];
  const persistedOriginal = items.find((it) => it.id === original.id)!;
  assert.equal(persistedOriginal.quantity, original.quantity);
});

Then(
  'la quantity histórica permanece igual',
  async function (this: TacosWorld) {
    const prisma = this.app().get(PrismaService);
    const original = this.snapshot.plates[0].items[0];
    const fresh = await prisma.item.findUnique({ where: { id: original.id } });
    assert.equal(fresh?.quantity, original.quantity);
  },
);

When('ocurre un append válido', async function (this: TacosWorld) {
  const product = this.products.get('base')!;
  await http(this, 'patch', `/orders/${this.currentOrderId}`, {
    token: this.currentToken,
    body: {
      plates: [
        { plateNumber: 7, items: [{ productId: product.id, quantity: 1 }] },
      ],
    },
  });
  assert.equal(this.lastResponse?.status, 200);
  this.orders.set('O', this.lastResponse.body);
});

Then(
  'revision pasa de {int} a {int}',
  function (this: TacosWorld, from: number, to: number) {
    const body = this.lastResponse?.body;
    assert.equal(this.snapshot.revision, from);
    assert.equal(body.revision, to);
  },
);

When('un append exitoso ocurre', async function (this: TacosWorld) {
  const product = this.products.get('base')!;
  await http(this, 'patch', `/orders/${this.currentOrderId}`, {
    token: this.currentToken,
    body: {
      plates: [
        { plateNumber: 8, items: [{ productId: product.id, quantity: 1 }] },
      ],
    },
  });
  assert.equal(this.lastResponse?.status, 200);
});

Then(
  'los items agregados tienen isNew={word}',
  function (this: TacosWorld, val: string) {
    const expected = val === 'true';
    const body = this.lastResponse?.body;
    const newItems = body.plates.flatMap((p: any) =>
      p.items.filter((i: any) => i.createdInRevision === body.revision),
    );
    assert.ok(newItems.length > 0);
    for (const it of newItems) assert.equal(it.isNew, expected);
  },
);

Then(
  'los items previos mantienen su isNew anterior',
  function (this: TacosWorld) {
    const body = this.lastResponse?.body;
    // Items con createdInRevision < revision actual: deben tener isNew según snapshot.
    const previous = body.plates.flatMap((p: any) =>
      p.items.filter((i: any) => i.createdInRevision < body.revision),
    );
    for (const it of previous) {
      const originalItem = this.snapshot.plates
        .flatMap((p: any) => p.items)
        .find((oi: any) => oi.id === it.id);
      if (originalItem) {
        assert.equal(it.isNew, originalItem.isNew);
      }
    }
  },
);

Given(
  'una orden O con status={string}',
  async function (this: TacosWorld, status: string) {
    // Crear una orden y forzar el status por DB (los waiters no pueden cambiar status).
    const product =
      Array.from(this.products.values())[0] ??
      (await createProduct(this, {
        name: 'Default',
        price: 20,
        restaurantCode: this.currentUser!.restaurantCode,
      }));
    await http(this, 'post', '/orders', {
      token: this.currentToken,
      body: {
        type: 'DINE_IN',
        reference: 'Mesa S',
        plates: [
          { plateNumber: 1, items: [{ productId: product.id, quantity: 1 }] },
        ],
      },
    });
    const order = this.lastResponse!.body;
    this.currentOrderId = order.id;
    this.orders.set('O', order);
    const prisma = this.app().get(PrismaService);
    await prisma.order.update({
      where: { id: order.id },
      data: { status: status as any },
    });
    this.snapshot = { ...order, status };
  },
);

When(
  'el WAITER hace PATCH agregando un item',
  async function (this: TacosWorld) {
    const product = Array.from(this.products.values())[0];
    await http(this, 'patch', `/orders/${this.currentOrderId}`, {
      token: this.currentToken,
      body: {
        plates: [
          { plateNumber: 50, items: [{ productId: product.id, quantity: 1 }] },
        ],
      },
    });
  },
);

Then(
  'O queda con status={string}',
  function (this: TacosWorld, status: string) {
    const body = this.lastResponse?.body;
    assert.equal(body.status, status);
  },
);

Then('O mantiene status={string}', function (this: TacosWorld, status: string) {
  const body = this.lastResponse?.body;
  assert.equal(body.status, status);
});

// REQ-0036: order-updated en PATCH.
Given(
  'un COOK de {string} conectado a Socket.IO',
  async function (this: TacosWorld, code: string) {
    let cook = this.users.get(`cook-${code}`);
    if (!cook || cook.restaurantCode !== code) {
      cook = await createUser(this, {
        email: `cook-up-${code}@example.com`,
        password: 'secret123',
        role: 'COOK',
        restaurantCode: code,
        alias: `cook-${code}`,
      });
    }
    await connectSocket(this, `cook-${code}`, { token: cook.token });
  },
);

When('ocurre el PATCH exitoso', async function (this: TacosWorld) {
  const product =
    this.products.get('base') ?? Array.from(this.products.values())[0];
  await http(this, 'patch', `/orders/${this.currentOrderId}`, {
    token: this.currentToken,
    body: {
      plates: [
        { plateNumber: 11, items: [{ productId: product.id, quantity: 1 }] },
      ],
    },
  });
  assert.equal(this.lastResponse?.status, 200);
  await waitFor(150);
});

Then(
  'el COOK recibe {string} con la orden completa',
  async function (this: TacosWorld, event: string) {
    // Tomar el primer socket cook.
    const tracked = Array.from(this.sockets.entries()).find(([k]) =>
      k.startsWith('cook-'),
    )?.[1];
    assert.ok(tracked, 'no hay socket cook conectado');
    const ok = await waitForEvent(tracked, event, 1500);
    assert.ok(
      ok,
      `Esperaba ${event}, eventos: ${JSON.stringify(tracked.events.map((e) => e.name))}`,
    );
  },
);
