import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrder(user: AuthenticatedUser, createOrderDto: CreateOrderDto) {
    if (user.role !== UserRole.WAITER) {
      throw new ForbiddenException('Only WAITER can create orders');
    }

    await this.validateProductsOwnership(user.taqueriaId, createOrderDto.plates);

    const order = await this.prisma.order.create({
      data: {
        taqueriaId: user.taqueriaId,
        waiterId: user.id,
        tableNumber: createOrderDto.tableNumber.trim(),
        status: OrderStatus.PENDING,
        isUpdated: false,
        plates: {
          create: createOrderDto.plates.map((plate) => ({
            plateNumber: plate.plateNumber,
            isClosed: false,
            items: {
              create: plate.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                selectedComplements: item.selectedComplements ?? [],
                notes: item.notes ?? null,
                isNew: false,
              })),
            },
          })),
        },
      },
      select: this.orderSelect(),
    });

    return order;
  }

  async getOrders(user: AuthenticatedUser) {
    const where =
      user.role === UserRole.COOK
        ? { taqueriaId: user.taqueriaId }
        : { taqueriaId: user.taqueriaId, waiterId: user.id };

    return this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: this.orderSelect(),
    });
  }

  async getOrderById(user: AuthenticatedUser, id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: this.orderSelect(),
    });

    if (!order || order.taqueriaId !== user.taqueriaId) {
      throw new NotFoundException('Order not found');
    }

    if (user.role === UserRole.WAITER && order.waiterId !== user.id) {
      throw new ForbiddenException('You can only access your own orders');
    }

    return order;
  }

  async updateOrder(user: AuthenticatedUser, id: string, updateOrderDto: UpdateOrderDto) {
    if (user.role !== UserRole.WAITER) {
      throw new ForbiddenException('Only WAITER can edit orders');
    }

    const existingOrder = await this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        taqueriaId: true,
        waiterId: true,
        plates: {
          select: {
            plateNumber: true,
            isClosed: true,
          },
        },
      },
    });

    if (!existingOrder || existingOrder.taqueriaId !== user.taqueriaId) {
      throw new NotFoundException('Order not found');
    }

    if (existingOrder.waiterId !== user.id) {
      throw new ForbiddenException('You can only edit your own orders');
    }

    const existingPlateNumbers = new Set(existingOrder.plates.map((plate) => plate.plateNumber));
    const collidingPlate = updateOrderDto.plates.find((plate) =>
      existingPlateNumbers.has(plate.plateNumber),
    );
    if (collidingPlate) {
      throw new BadRequestException(
        `Plate ${collidingPlate.plateNumber} already exists and is immutable. Append a new plate.`,
      );
    }

    await this.validateProductsOwnership(user.taqueriaId, updateOrderDto.plates);

    // Append-only editing: existing plates/items remain immutable.
    await this.prisma.order.update({
      where: { id },
      data: {
        isUpdated: true,
        plates: {
          create: updateOrderDto.plates.map((plate) => ({
            plateNumber: plate.plateNumber,
            isClosed: false,
            items: {
              create: plate.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                selectedComplements: item.selectedComplements ?? [],
                notes: item.notes ?? null,
                isNew: true,
              })),
            },
          })),
        },
      },
    });

    return this.getOrderById(user, id);
  }

  async updateOrderStatus(user: AuthenticatedUser, id: string, dto: UpdateOrderStatusDto) {
    if (user.role !== UserRole.COOK) {
      throw new ForbiddenException('Only COOK can update order status');
    }

    const existingOrder = await this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        taqueriaId: true,
      },
    });

    if (!existingOrder || existingOrder.taqueriaId !== user.taqueriaId) {
      throw new NotFoundException('Order not found');
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: dto.status },
      select: this.orderSelect(),
    });

    return updated;
  }

  private async validateProductsOwnership(
    taqueriaId: string,
    plates: Array<{ items: Array<{ productId: string }> }>,
  ) {
    const productIds = [...new Set(plates.flatMap((plate) => plate.items.map((item) => item.productId)))];
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        taqueriaId,
      },
      select: { id: true },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products are invalid for this taqueria');
    }
  }

  private orderSelect() {
    return {
      id: true,
      taqueriaId: true,
      waiterId: true,
      tableNumber: true,
      status: true,
      isUpdated: true,
      createdAt: true,
      updatedAt: true,
      plates: {
        orderBy: { plateNumber: 'asc' as const },
        select: {
          id: true,
          plateNumber: true,
          isClosed: true,
          createdAt: true,
          items: {
            select: {
              id: true,
              productId: true,
              quantity: true,
              selectedComplements: true,
              notes: true,
              isNew: true,
              createdAt: true,
            },
          },
        },
      },
    };
  }
}
