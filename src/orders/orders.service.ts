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
        revision: 1,
        priorityTimestamp: new Date(),
        plates: {
          create: createOrderDto.plates.map((plate) => ({
            plateNumber: plate.plateNumber,
            isClosed: false,
            createdInRevision: 1,
            items: {
              create: plate.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                selectedComplements: item.selectedComplements ?? [],
                notes: item.notes ?? null,
                isNew: false,
                createdInRevision: 1,
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
    if (user.role === UserRole.COOK) {
      // Cook: Obtener todas las órdenes de la taquería ordenadas por prioridad de cocina
      const orders = await this.prisma.$queryRaw`
        SELECT 
          o.id,
          o."taqueriaId",
          o."waiterId",
          o."tableNumber",
          o.status::text as status,
          o.revision,
          o."priorityTimestamp",
          o."createdAt",
          o."updatedAt"
        FROM "Order" o
        WHERE o."taqueriaId" = ${user.taqueriaId}
        ORDER BY
          CASE o.status::text
            WHEN 'UPDATED'    THEN 1
            WHEN 'PENDING'    THEN 2
            WHEN 'PREPARING'  THEN 3
            WHEN 'READY'      THEN 4
            WHEN 'DELIVERED'  THEN 5
            WHEN 'CANCELLED'  THEN 6
          END ASC,
          o."priorityTimestamp" ASC
      `;

      // Como $queryRaw devuelve un tipo genérico, obtenemos los ids para hacer 
      // la consulta final con las relaciones e hidratar correctamente el DTO con Prisma
      const orderIds = (orders as any[]).map((o) => o.id);
      
      if (orderIds.length === 0) return [];

      const fullOrders = await this.prisma.order.findMany({
        where: { id: { in: orderIds } },
        select: this.orderSelect(),
      });

      // Ordenar localmente fullOrders basado en la secuencia original (orderIds)
      const orderMap = new Map(fullOrders.map(o => [o.id, o]));
      return orderIds.map(id => orderMap.get(id)).filter(Boolean);
    }

    // Waiter: Solo sus órdenes, ordenadas por fecha de creación (clásico)
    return this.prisma.order.findMany({
      where: { taqueriaId: user.taqueriaId, waiterId: user.id },
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
        revision: true,
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

    const newRevision = existingOrder.revision + 1;

    // Append-only editing: existing plates/items remain immutable.
    await this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.UPDATED,
        revision: newRevision,
        priorityTimestamp: new Date(),
        plates: {
          create: updateOrderDto.plates.map((plate) => ({
            plateNumber: plate.plateNumber,
            isClosed: false,
            createdInRevision: newRevision,
            items: {
              create: plate.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                selectedComplements: item.selectedComplements ?? [],
                notes: item.notes ?? null,
                isNew: true,
                createdInRevision: newRevision,
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
        status: true,
      },
    });

    if (!existingOrder || existingOrder.taqueriaId !== user.taqueriaId) {
      throw new NotFoundException('Order not found');
    }

    if (dto.status === OrderStatus.UPDATED) {
      throw new BadRequestException('Cannot set UPDATED status manually');
    }

    return this.prisma.$transaction(async (tx) => {
      // Limpiar isNew si transiciona a READY desde UPDATED o PREPARING
      if (
        dto.status === OrderStatus.READY &&
        (existingOrder.status === OrderStatus.UPDATED || existingOrder.status === OrderStatus.PREPARING)
      ) {
        const plates = await tx.plate.findMany({
          where: { orderId: id },
          select: { id: true },
        });
        const plateIds = plates.map(p => p.id);
        
        if (plateIds.length > 0) {
          await tx.item.updateMany({
            where: { plateId: { in: plateIds }, isNew: true },
            data: { isNew: false },
          });
        }
      }

      return tx.order.update({
        where: { id },
        data: { status: dto.status },
        select: this.orderSelect(),
      });
    });
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
      revision: true,
      priorityTimestamp: true,
      createdAt: true,
      updatedAt: true,
      plates: {
        orderBy: { plateNumber: 'asc' as const },
        select: {
          id: true,
          plateNumber: true,
          isClosed: true,
          createdInRevision: true,
          createdAt: true,
          items: {
            select: {
              id: true,
              productId: true,
              quantity: true,
              selectedComplements: true,
              notes: true,
              isNew: true,
              createdInRevision: true,
              createdAt: true,
            },
          },
        },
      },
    };
  }
}
