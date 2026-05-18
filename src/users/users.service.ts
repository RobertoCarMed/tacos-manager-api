import { Injectable } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  createUserWithTaqueria(data: {
    taqueriaName: string;
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
        taqueria: {
          create: {
            name: data.taqueriaName,
          },
        },
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
