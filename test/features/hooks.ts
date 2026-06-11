import { BeforeAll, AfterAll, Before, After } from '@cucumber/cucumber';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ConfiguredSocketIoAdapter } from '../../src/realtime/socket-io.adapter';
import { TacosWorld } from './world';

// Default env for local runs. CI passes its own DATABASE_URL/JWT_SECRET.
function ensureTestEnv() {
  process.env.NODE_ENV = 'test';
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'test-jwt-secret-do-not-use-in-prod';
  }
  if (!process.env.JWT_EXPIRES_IN) {
    process.env.JWT_EXPIRES_IN = '1h';
  }
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      'postgresql://postgres:postgres@localhost:5432/tacosmanager_test';
  }
  if (!process.env.SOCKET_ORIGIN) {
    process.env.SOCKET_ORIGIN = '*';
  }
}

BeforeAll({ timeout: 60_000 }, async () => {
  ensureTestEnv();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useWebSocketAdapter(new ConfiguredSocketIoAdapter(app));

  await app.init();
  // Listen on a random free port — needed for socket.io-client tests.
  const httpServer = app.getHttpServer();
  await new Promise<void>((resolve) => {
    httpServer.listen(0, '127.0.0.1', () => resolve());
  });
  const address = httpServer.address();
  const port =
    typeof address === 'object' && address ? address.port : Number(address);

  globalThis.__TM_APP = app;
  globalThis.__TM_PORT = port;
  globalThis.__TM_HTTP_SERVER = httpServer;
});

Before({ timeout: 30_000 }, async function (this: TacosWorld) {
  const prisma = this.app().get(PrismaService);
  // Truncate everything in tenancy-friendly order. CASCADE handles relations.
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Item", "Plate", "Order", "Product", "User", "Taqueria" RESTART IDENTITY CASCADE',
  );

  this.taquerias = new Map();
  this.users = new Map();
  this.products = new Map();
  this.orders = new Map();
  this.sockets = new Map();
  this.currentUser = undefined;
  this.currentToken = undefined;
  this.currentOrderId = undefined;
  this.lastResponse = undefined;
  this.snapshot = undefined;
});

After(async function (this: TacosWorld) {
  for (const tracked of this.sockets.values()) {
    try {
      tracked.client.removeAllListeners();
      tracked.client.disconnect();
    } catch {
      // ignore
    }
  }
  this.sockets.clear();
});

AfterAll({ timeout: 30_000 }, async () => {
  const app = globalThis.__TM_APP;
  if (app) {
    try {
      await app.close();
    } catch {
      // ignore
    }
  }
  globalThis.__TM_APP = undefined;
  globalThis.__TM_PORT = undefined;
  globalThis.__TM_HTTP_SERVER = undefined;
});
