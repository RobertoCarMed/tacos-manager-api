// Realtime steps — cubre @REQ-0050 a @REQ-0054 (specs/realtime-sync).
import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import type { TacosWorld } from '../world';
import { createUser, createProduct } from '../support/seed';
import { connectSocket, waitFor, waitForEvent } from '../support/socket';
import { http } from '../support/http';

When(
  'un cliente intenta conectar a Socket.IO sin auth.token',
  async function (this: TacosWorld) {
    await connectSocket(this, 'no-token', { token: null });
  },
);

Then('la conexión es rechazada', async function (this: TacosWorld) {
  // Tomar el último socket abierto.
  const last = Array.from(this.sockets.values()).pop();
  assert.ok(last, 'no hay socket registrado');
  // Esperar hasta que el server cierre o se confirme rechazo.
  await waitFor(300);
  assert.ok(
    last.rejected || !last.client.connected,
    `conexión no fue rechazada (rejected=${last.rejected}, connected=${last.client.connected})`,
  );
});

When(
  'un cliente conecta con auth.token={string}',
  async function (this: TacosWorld, token: string) {
    await connectSocket(this, 'invalid-token', { token });
  },
);

Given(
  'un usuario con JWT válido de {string}',
  async function (this: TacosWorld, code: string) {
    const user = await createUser(this, {
      email: `rt-valid-${code}@example.com`,
      password: 'secret123',
      role: 'COOK',
      restaurantCode: code,
      alias: `rt-${code}`,
    });
    this.currentUser = user;
    this.currentToken = user.token;
  },
);

When('conecta exitosamente a Socket.IO', async function (this: TacosWorld) {
  await connectSocket(this, 'rt-self', { token: this.currentToken });
});

Then(
  'queda unido al room {string}',
  async function (this: TacosWorld, _roomTemplate: string) {
    const tracked = this.sockets.get('rt-self')!;
    assert.ok(tracked.client.connected, 'socket no conectado');
    // Verificamos auto-join enviando un order-created de otro waiter de la misma taquería
    // y comprobando recepción.
    const code = this.currentUser!.restaurantCode;
    const waiter = await createUser(this, {
      email: `waiter-room-${code}@example.com`,
      password: 'secret123',
      role: 'WAITER',
      restaurantCode: code,
    });
    const product = await createProduct(this, {
      name: 'RoomProd',
      price: 10,
      restaurantCode: code,
    });
    await http(this, 'post', '/orders', {
      token: waiter.token,
      body: {
        type: 'DINE_IN',
        reference: 'Mesa Room',
        plates: [
          { plateNumber: 1, items: [{ productId: product.id, quantity: 1 }] },
        ],
      },
    });
    await waitFor(150);
    const got = await waitForEvent(tracked, 'order-created', 1500);
    assert.ok(got, 'no recibió order-created — auto-join falló');
  },
);

// REQ-0052: aislamiento entre rooms.
Given(
  'un user A de {string} conectado',
  async function (this: TacosWorld, code: string) {
    const user = await createUser(this, {
      email: `userA-${code}@example.com`,
      password: 'secret123',
      role: 'COOK',
      restaurantCode: code,
      alias: `userA`,
    });
    await connectSocket(this, 'userA', { token: user.token });
  },
);

Given(
  'un user B de {string} conectado',
  async function (this: TacosWorld, code: string) {
    const user = await createUser(this, {
      email: `userB-${code}@example.com`,
      password: 'secret123',
      role: 'COOK',
      restaurantCode: code,
      alias: `userB`,
    });
    await connectSocket(this, 'userB', { token: user.token });
  },
);

When(
  'A dispara un evento que emite al room {string}',
  async function (this: TacosWorld, code: string) {
    // Un WAITER de la misma taquería que A crea una orden.
    const codeA = this.users.get('userA')!.restaurantCode;
    assert.equal(
      codeA,
      code,
      `taquería A (${codeA}) no coincide con "${code}"`,
    );
    const waiter = await createUser(this, {
      email: `waiter-iso-${codeA}@example.com`,
      password: 'secret123',
      role: 'WAITER',
      restaurantCode: codeA,
    });
    const product = await createProduct(this, {
      name: `IsoProd ${codeA}`,
      price: 10,
      restaurantCode: codeA,
    });
    await http(this, 'post', '/orders', {
      token: waiter.token,
      body: {
        type: 'DINE_IN',
        reference: 'Mesa Iso',
        plates: [
          { plateNumber: 1, items: [{ productId: product.id, quantity: 1 }] },
        ],
      },
    });
    await waitFor(250);
  },
);

Then('B NO recibe ese evento', function (this: TacosWorld) {
  const tracked = this.sockets.get('userB')!;
  assert.equal(
    tracked.events.length,
    0,
    `B recibió ${tracked.events.length} eventos: ${JSON.stringify(tracked.events.map((e) => e.name))}`,
  );
});

// REQ-0053: resync tras reconexión (backend-side: GET /orders sigue funcionando)
Given(
  'un COOK conectado que pierde Wi-Fi 30s',
  async function (this: TacosWorld) {
    const cook = await createUser(this, {
      email: 'cook-reconnect@example.com',
      password: 'secret123',
      role: 'COOK',
      restaurantCode: 'TM-0001',
      alias: 'cook',
    });
    this.currentUser = cook;
    this.currentToken = cook.token;
    await connectSocket(this, 'cook-reconnect', { token: cook.token });
    // Simular pérdida.
    this.sockets.get('cook-reconnect')!.client.disconnect();
    await waitFor(50);
  },
);

When('reconecta', async function (this: TacosWorld) {
  // Nueva conexión con mismo token.
  await connectSocket(this, 'cook-reconnect-2', { token: this.currentToken });
});

Then('solicita GET \\/orders al backend', async function (this: TacosWorld) {
  await http(this, 'get', '/orders', { token: this.currentToken });
  assert.equal(this.lastResponse?.status, 200);
});

Then(
  'la UI queda consistente con el estado del servidor',
  function (this: TacosWorld) {
    // Backend-side: respuesta es array bien formado.
    assert.ok(Array.isArray(this.lastResponse?.body));
  },
);

// REQ-0054: multi-device.
Given(
  'un COOK conectado en dispositivo A y dispositivo B simultáneamente',
  async function (this: TacosWorld) {
    const cook = await createUser(this, {
      email: 'cook-multi@example.com',
      password: 'secret123',
      role: 'COOK',
      restaurantCode: 'TM-0001',
      alias: 'cook',
    });
    this.currentUser = cook;
    this.currentToken = cook.token;
    await connectSocket(this, 'device-A', { token: cook.token });
    await connectSocket(this, 'device-B', { token: cook.token });
  },
);

When(
  'ocurre un order-created en su taquería',
  async function (this: TacosWorld) {
    const code = this.currentUser!.restaurantCode;
    const waiter = await createUser(this, {
      email: 'waiter-multi@example.com',
      password: 'secret123',
      role: 'WAITER',
      restaurantCode: code,
    });
    const product = await createProduct(this, {
      name: 'MultiProd',
      price: 10,
      restaurantCode: code,
    });
    await http(this, 'post', '/orders', {
      token: waiter.token,
      body: {
        type: 'DINE_IN',
        reference: 'Mesa Multi',
        plates: [
          { plateNumber: 1, items: [{ productId: product.id, quantity: 1 }] },
        ],
      },
    });
    await waitFor(200);
  },
);

Then('ambos dispositivos reciben el evento', async function (this: TacosWorld) {
  const a = this.sockets.get('device-A')!;
  const b = this.sockets.get('device-B')!;
  const gotA = await waitForEvent(a, 'order-created', 1500);
  const gotB = await waitForEvent(b, 'order-created', 1500);
  assert.ok(gotA, 'device-A no recibió order-created');
  assert.ok(gotB, 'device-B no recibió order-created');
});
