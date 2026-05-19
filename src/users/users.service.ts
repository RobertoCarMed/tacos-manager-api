import { Injectable } from '@nestjs/common';
import { Taqueria, User, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  findTaqueriaByName(name: string): Promise<Taqueria | null> {
    return this.prisma.taqueria.findUnique({
      where: { name },
    });
  }

  createTaqueria(data: { name: string; restaurantCode: string }): Promise<Taqueria> {
    return this.prisma.taqueria.create({
      data: {
        name: data.name,
        restaurantCode: data.restaurantCode,
      },
    });
  }

  createUserInTaqueria(data: {
    taqueriaId: string;
    name: string;
    email: string;
    password: string;
    role: UserRole;
  }) {
    return this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role,
        taqueriaId: data.taqueriaId,
      },
      include: {
        taqueria: true,
      },
    });
  }

  findAuthUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        taqueriaId: true,
        taqueria: true,
      },
    });
  }

  sanitizeUser<T extends { password?: string }>(user: T): Omit<T, 'password'> {
    const { password: _password, ...rest } = user;
    return rest;
  }
}
