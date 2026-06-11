import { setWorldConstructor, World, IWorldOptions } from '@cucumber/cucumber';
import type { INestApplication } from '@nestjs/common';
import type { Socket } from 'socket.io-client';
import type { Server } from 'http';

export interface UserContext {
  id: string;
  email: string;
  password: string;
  name: string;
  role: 'COOK' | 'WAITER';
  taqueriaId: string;
  restaurantCode: string;
  token: string;
}

export interface SocketEvent {
  name: string;
  payload: any;
}

export interface TrackedSocket {
  client: Socket;
  events: SocketEvent[];
  rejected: boolean;
  connectError: string | null;
}

export interface LastResponse {
  status: number;
  body: any;
  text?: string;
  headers?: Record<string, string>;
}

// Singletons shared across scenarios via globalThis.
// Booted once in BeforeAll (test/features/hooks.ts) and reused.
declare global {
  var __TM_APP: INestApplication | undefined;

  var __TM_PORT: number | undefined;

  var __TM_HTTP_SERVER: Server | undefined;
}

export class TacosWorld extends World {
  // Per-scenario state. Hooks reset it (Before).
  public taquerias: Map<
    string,
    { id: string; restaurantCode: string; name: string }
  > = new Map();
  public users: Map<string, UserContext> = new Map(); // key: email OR alias (waiter, cook, cook-TM-0001…)
  public products: Map<
    string,
    { id: string; name: string; price: number; taqueriaId: string }
  > = new Map();
  public orders: Map<string, any> = new Map(); // key: alias ("O", "current", "TM-0001:O")
  public sockets: Map<string, TrackedSocket> = new Map();

  public currentUser?: UserContext;
  public currentToken?: string;
  public currentOrderId?: string;
  public lastResponse?: LastResponse;

  // Snapshot of original state (used to verify "no se aplica" in append-only test)
  public snapshot?: any;

  constructor(options: IWorldOptions) {
    super(options);
  }

  app(): INestApplication {
    if (!globalThis.__TM_APP) {
      throw new Error('Nest app not initialised — BeforeAll hook missing?');
    }
    return globalThis.__TM_APP;
  }

  baseUrl(): string {
    if (!globalThis.__TM_PORT) {
      throw new Error('HTTP server port not initialised');
    }
    return `http://127.0.0.1:${globalThis.__TM_PORT}`;
  }

  port(): number {
    if (!globalThis.__TM_PORT) {
      throw new Error('HTTP server port not initialised');
    }
    return globalThis.__TM_PORT;
  }
}

setWorldConstructor(TacosWorld);
