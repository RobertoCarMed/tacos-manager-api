import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async createProduct(user: AuthenticatedUser, createProductDto: CreateProductDto) {
    this.ensureCookRole(user);
    this.validateComplements(createProductDto.complements);

    const product = await this.prisma.product.create({
      data: {
        name: createProductDto.name.trim(),
        price: createProductDto.price,
        imageUrl: createProductDto.imageUrl ?? null,
        complements: createProductDto.complements ?? [],
        taqueriaId: user.taqueriaId,
      },
      select: {
        id: true,
        name: true,
        price: true,
        imageUrl: true,
        complements: true,
        createdAt: true,
      },
    });

    return product;
  }

  async getProducts(user: AuthenticatedUser) {
    return this.prisma.product.findMany({
      where: { taqueriaId: user.taqueriaId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        price: true,
        imageUrl: true,
        complements: true,
        createdAt: true,
      },
    });
  }

  async getProductById(user: AuthenticatedUser, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, taqueriaId: user.taqueriaId },
      select: {
        id: true,
        name: true,
        price: true,
        imageUrl: true,
        complements: true,
        createdAt: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async updateProduct(user: AuthenticatedUser, id: string, updateProductDto: UpdateProductDto) {
    this.ensureCookRole(user);
    this.validateComplements(updateProductDto.complements);

    await this.ensureProductOwnership(id, user.taqueriaId);

    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data: {
        ...(updateProductDto.name !== undefined ? { name: updateProductDto.name.trim() } : {}),
        ...(updateProductDto.price !== undefined ? { price: updateProductDto.price } : {}),
        ...(updateProductDto.imageUrl !== undefined ? { imageUrl: updateProductDto.imageUrl } : {}),
        ...(updateProductDto.complements !== undefined
          ? { complements: updateProductDto.complements }
          : {}),
      },
      select: {
        id: true,
        name: true,
        price: true,
        imageUrl: true,
        complements: true,
        createdAt: true,
      },
    });

    return updatedProduct;
  }

  async deleteProduct(user: AuthenticatedUser, id: string) {
    this.ensureCookRole(user);
    await this.ensureProductOwnership(id, user.taqueriaId);

    await this.prisma.product.delete({
      where: { id },
    });

    return {
      message: 'Product deleted successfully',
    };
  }

  private ensureCookRole(user: AuthenticatedUser): void {
    if (user.role !== UserRole.COOK) {
      throw new ForbiddenException('Only COOK users can modify products');
    }
  }

  private validateComplements(complements?: string[]): void {
    if (complements && complements.length > 3) {
      throw new BadRequestException('A product can have a maximum of 3 complements');
    }
  }

  private async ensureProductOwnership(id: string, taqueriaId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        taqueriaId: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.taqueriaId !== taqueriaId) {
      throw new ForbiddenException('You cannot access products from another taqueria');
    }
  }
}
