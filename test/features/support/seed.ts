import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { TacosWorld, UserContext } from '../world';

let codeCounter = 1;

export function nextRestaurantCode(): string {
  // Deterministic per-run codes, distinct from user-supplied ones like TM-0001.
  const value = 9000 + codeCounter++;
  return `TM-${value}`;
}

export async function ensureTaqueria(
  world: TacosWorld,
  restaurantCode: string,
  name = `Taquería ${restaurantCode}`,
) {
  if (world.taquerias.has(restaurantCode)) {
    return world.taquerias.get(restaurantCode)!;
  }
  const prisma = world.app().get(PrismaService);
  const existing = await prisma.taqueria.findUnique({
    where: { restaurantCode },
  });
  const taqueria =
    existing ??
    (await prisma.taqueria.create({
      data: { name, restaurantCode },
    }));
  const cached = { id: taqueria.id, restaurantCode, name: taqueria.name };
  world.taquerias.set(restaurantCode, cached);
  return cached;
}

export async function createUser(
  world: TacosWorld,
  args: {
    email: string;
    password: string;
    role: 'COOK' | 'WAITER';
    restaurantCode: string;
    name?: string;
    alias?: string;
  },
): Promise<UserContext> {
  const taqueria = await ensureTaqueria(world, args.restaurantCode);
  const prisma = world.app().get(PrismaService);
  const hashed = await bcrypt.hash(args.password, 10);
  const user = await prisma.user.create({
    data: {
      email: args.email,
      password: hashed,
      name: args.name ?? args.email.split('@')[0],
      role: args.role as any,
      taqueriaId: taqueria.id,
    },
  });

  const token = await signToken(world, {
    sub: user.id,
    email: user.email,
    role: user.role,
    taqueriaId: user.taqueriaId,
  });

  const ctx: UserContext = {
    id: user.id,
    email: user.email,
    password: args.password,
    name: user.name,
    role: args.role,
    taqueriaId: taqueria.id,
    restaurantCode: args.restaurantCode,
    token,
  };

  world.users.set(args.email, ctx);
  if (args.alias) world.users.set(args.alias, ctx);
  // Role-based alias for convenience (last-write wins).
  world.users.set(args.role.toLowerCase(), ctx);
  world.users.set(`${args.role.toLowerCase()}-${args.restaurantCode}`, ctx);
  return ctx;
}

export async function signToken(
  world: TacosWorld,
  payload: { sub: string; email: string; role: string; taqueriaId: string },
  options: { expiresIn?: string } = {},
): Promise<string> {
  const jwt = world.app().get(JwtService);
  const signOptions: any = options.expiresIn
    ? { expiresIn: options.expiresIn }
    : undefined;
  return jwt.signAsync(payload, signOptions);
}

export async function createProduct(
  world: TacosWorld,
  args: { name: string; price: number; restaurantCode: string; alias?: string },
) {
  const taqueria = await ensureTaqueria(world, args.restaurantCode);
  const prisma = world.app().get(PrismaService);
  const product = await prisma.product.create({
    data: {
      name: args.name,
      price: args.price,
      taqueriaId: taqueria.id,
    },
  });
  const cached = {
    id: product.id,
    name: product.name,
    price: product.price,
    taqueriaId: product.taqueriaId,
  };
  world.products.set(args.name, cached);
  if (args.alias) world.products.set(args.alias, cached);
  return cached;
}
