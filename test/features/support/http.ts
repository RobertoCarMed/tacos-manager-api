import request from 'supertest';
import type { TacosWorld, LastResponse } from '../world';

type Method = 'get' | 'post' | 'patch' | 'delete' | 'put';

export async function http(
  world: TacosWorld,
  method: Method,
  path: string,
  options: { token?: string | null; body?: any } = {},
): Promise<LastResponse> {
  const server = world.app().getHttpServer();
  const req = (request(server) as any)[method](path);
  if (options.token) req.set('Authorization', `Bearer ${options.token}`);
  if (options.body !== undefined) req.send(options.body);
  const res = await req;
  const last: LastResponse = {
    status: res.status,
    body: res.body,
    text: res.text,
    headers: res.headers,
  };
  world.lastResponse = last;
  return last;
}
