import { io as ioClient, Socket } from 'socket.io-client';
import type { TacosWorld, TrackedSocket } from '../world';

const TRACKED_EVENTS = [
  'order-created',
  'order-updated',
  'order-status-changed',
];

export async function connectSocket(
  world: TacosWorld,
  alias: string,
  options: { token?: string | null } = {},
): Promise<TrackedSocket> {
  const url = world.baseUrl();
  const client: Socket = ioClient(url, {
    transports: ['websocket'],
    auth: options.token === undefined ? {} : { token: options.token },
    reconnection: false,
    timeout: 5000,
  });

  const tracked: TrackedSocket = {
    client,
    events: [],
    rejected: false,
    connectError: null,
  };

  for (const evt of TRACKED_EVENTS) {
    client.on(evt, (payload: any) => {
      tracked.events.push({ name: evt, payload });
    });
  }

  client.on('disconnect', () => {
    // mark as rejected if disconnected before any successful event/handshake
    if (!client.connected) tracked.rejected = true;
  });

  await new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    client.on('connect', () => {
      tracked.rejected = false;
      done();
    });
    client.on('connect_error', (err: Error) => {
      tracked.rejected = true;
      tracked.connectError = err?.message ?? 'connect_error';
      done();
    });
    client.on('disconnect', () => {
      tracked.rejected = true;
      done();
    });
    setTimeout(done, 4000);
  });

  world.sockets.set(alias, tracked);
  return tracked;
}

export function waitFor(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export async function waitForEvent(
  tracked: TrackedSocket,
  eventName: string,
  timeoutMs = 2000,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (tracked.events.some((e) => e.name === eventName)) return true;
    await waitFor(50);
  }
  return tracked.events.some((e) => e.name === eventName);
}
