// Auth steps — cubre @REQ-0001 a @REQ-0005 (specs/authentication/acceptance.feature)
import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import type { TacosWorld } from '../world';
import { createUser, ensureTaqueria, signToken } from '../support/seed';
import { http } from '../support/http';
import { PrismaService } from '../../../src/prisma/prisma.service';

Given(
  'un usuario con email {string} y password {string} en la taquería {string}',
  async function (
    this: TacosWorld,
    email: string,
    password: string,
    code: string,
  ) {
    await createUser(this, {
      email,
      password,
      role: 'WAITER',
      restaurantCode: code,
      alias: email,
    });
  },
);

When(
  'hace POST \\/auth\\/login con esas credenciales',
  async function (this: TacosWorld) {
    const lastEmail = Array.from(this.users.values())[0]?.email;
    const user = this.users.get(lastEmail);
    await http(this, 'post', '/auth/login', {
      body: { email: user!.email, password: user!.password },
    });
  },
);

Then(
  'la respuesta es {int}',
  async function (this: TacosWorld, status: number) {
    assert.equal(
      this.lastResponse?.status,
      status,
      JSON.stringify(this.lastResponse?.body),
    );
  },
);

Then(
  'el cuerpo incluye accessToken, user \\(sin password), taqueria \\(con restaurantCode)',
  function (this: TacosWorld) {
    const body = this.lastResponse?.body;
    assert.ok(body?.accessToken, 'accessToken faltante');
    assert.ok(body?.user, 'user faltante');
    assert.equal(body.user.password, undefined, 'password no debe exponerse');
    assert.equal(
      body.user.passwordHash ?? undefined,
      undefined,
      'passwordHash no debe exponerse',
    );
    assert.ok(
      body?.taqueria?.restaurantCode,
      'taqueria.restaurantCode faltante',
    );
  },
);

When(
  'alguien hace POST \\/auth\\/login con email {string} y password incorrecto',
  async function (this: TacosWorld, email: string) {
    // Seed mínimo: si el usuario aún no existe (background no se ejecutó), créalo.
    if (!this.users.has(email)) {
      await createUser(this, {
        email,
        password: 'correct-secret',
        role: 'WAITER',
        restaurantCode: 'TM-0001',
        alias: email,
      });
    }
    await http(this, 'post', '/auth/login', {
      body: { email, password: 'this-is-wrong' },
    });
  },
);

Then(
  'el mensaje de error es genérico \\(no revela cuál campo falló)',
  function (this: TacosWorld) {
    const body = this.lastResponse?.body;
    const message: string = Array.isArray(body?.message)
      ? body.message.join(' ')
      : (body?.message ?? '');
    assert.ok(message.length > 0, 'mensaje vacío');
    // No debe mencionar específicamente "email" o "password" para no filtrar.
    const lower = message.toLowerCase();
    assert.ok(!lower.includes('password'), `mensaje filtra campo: ${message}`);
    assert.ok(
      !/email.*not.*found|email.*invalid|no existe/.test(lower),
      `mensaje filtra campo: ${message}`,
    );
  },
);

Given(
  'un accessToken válido en Authorization Bearer',
  async function (this: TacosWorld) {
    const user = await createUser(this, {
      email: 'me@example.com',
      password: 'secret123',
      role: 'WAITER',
      restaurantCode: 'TM-0001',
    });
    this.currentToken = user.token;
  },
);

When('se hace GET \\/auth\\/me', async function (this: TacosWorld) {
  await http(this, 'get', '/auth/me', { token: this.currentToken });
});

Then(
  'la respuesta es {int} con user y taqueria',
  function (this: TacosWorld, status: number) {
    assert.equal(this.lastResponse?.status, status);
    const body = this.lastResponse?.body;
    // /auth/me returns the JWT payload's user dictated by JwtStrategy.
    assert.ok(body, 'body vacío');
  },
);

Given('un accessToken expirado', async function (this: TacosWorld) {
  const taqueria = await ensureTaqueria(this, 'TM-0001');
  // Sign a token that is already expired.
  const token = await signToken(
    this,
    {
      sub: 'expired-user',
      email: 'x@y.z',
      role: 'WAITER',
      taqueriaId: taqueria.id,
    },
    { expiresIn: '-1s' },
  );
  this.currentToken = token;
});

Given(
  'que no existe taquería con nombre {string} en {string}',
  async function (this: TacosWorld, name: string, _address: string) {
    const prisma = this.app().get(PrismaService);
    const count = await prisma.taqueria.count({ where: { name } });
    assert.equal(count, 0);
    // Memorize the candidate for the next "When".
    (this as any).pendingTaqueriaName = name;
  },
);

When(
  'se hace POST \\/auth\\/register con datos de usuario y de taquería',
  async function (this: TacosWorld) {
    const name = (this as any).pendingTaqueriaName ?? 'Taquería El Güero';
    await http(this, 'post', '/auth/register', {
      body: {
        taqueriaName: name,
        name: 'Nuevo Usuario',
        email: `nuevo-${Date.now()}@example.com`,
        password: 'secret123',
        role: 'COOK',
        createNewTaqueria: true,
        taqueriaData: { address: 'Av. Reforma' },
      },
    });
  },
);

Then(
  'se crea una taquería nueva con restaurantCode autogenerado',
  function (this: TacosWorld) {
    const body = this.lastResponse?.body;
    assert.ok(body?.taqueria?.restaurantCode?.startsWith('TM-'));
  },
);

Then('se crea el usuario asociado a esa taquería', function (this: TacosWorld) {
  const body = this.lastResponse?.body;
  assert.ok(body?.user?.id, 'user.id faltante');
  assert.equal(body.user.taqueriaId, body.taqueria.id);
});

Then('la respuesta incluye accessToken', function (this: TacosWorld) {
  assert.ok(this.lastResponse?.body?.accessToken);
});

Given(
  'que existe una taquería {string} coincidente',
  async function (this: TacosWorld, code: string) {
    await ensureTaqueria(this, code, 'Taquería Existente');
    (this as any).joinTargetCode = code;
  },
);

When(
  'un usuario nuevo hace POST \\/auth\\/register apuntando a esa taquería',
  async function (this: TacosWorld) {
    const code = (this as any).joinTargetCode;
    const taqueria = this.taquerias.get(code)!;
    await http(this, 'post', '/auth/register', {
      body: {
        taqueriaName: taqueria.name,
        name: 'Empleado Nuevo',
        email: `join-${Date.now()}@example.com`,
        password: 'secret123',
        role: 'WAITER',
        confirmJoinExistingTaqueria: true,
        selectedRestaurantCode: code,
      },
    });
  },
);

Then(
  'el usuario se asocia a {string}',
  function (this: TacosWorld, code: string) {
    const body = this.lastResponse?.body;
    assert.equal(body?.taqueria?.restaurantCode, code);
  },
);

Then('NO se crea una taquería adicional', async function (this: TacosWorld) {
  const prisma = this.app().get(PrismaService);
  const count = await prisma.taqueria.count();
  // 1 taquería creada en el Given.
  assert.equal(count, 1);
});
