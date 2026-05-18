import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getHello() {
    const taquerias = await this.prisma.taqueria.findMany();

    return {
      message: 'Prisma funcionando 🚀',
      taquerias,
    };
  }
}
