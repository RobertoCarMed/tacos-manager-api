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

  findTaqueriasByName(name: string): Promise<Taqueria[]> {
    return this.prisma.taqueria.findMany({
      where: { name },
      orderBy: { createdAt: 'asc' },
    });
  }

  findTaqueriaByRestaurantCode(
    restaurantCode: string,
  ): Promise<Taqueria | null> {
    return this.prisma.taqueria.findUnique({
      where: { restaurantCode },
    });
  }

  createTaqueria(data: {
    name: string;
    restaurantCode: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
  }): Promise<Taqueria> {
    return this.prisma.taqueria.create({
      data: {
        name: data.name,
        restaurantCode: data.restaurantCode,
        phone: data.phone,
        address: data.address,
        city: data.city,
        state: data.state,
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
}
