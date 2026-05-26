import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, OrderType, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';

const TERMINAL_STATUSES = [
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
] as const;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async createOrder(user: AuthenticatedUser, createOrderDto: CreateOrderDto) {
    if (user.role !== UserRole.WAITER) {
      throw new ForbiddenException('Only WAITER can create orders');
    }

    this.validateClassification(
      createOrderDto.type,
      createOrderDto.reference,
      createOrderDto.deliveryAddress,
    );

    await this.validateProductsOwnership(
      user.taqueriaId,
      createOrderDto.plates,
    );

    const order = await this.prisma.order.create({
      data: {
        taqueriaId: user.taqueriaId,
        waiterId: user.id,
        type: createOrderDto.type,
        reference: createOrderDto.reference ?? null,
        deliveryAddress: createOrderDto.deliveryAddress ?? null,
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

    this.realtimeGateway.emitOrderCreated(order.taqueriaId, order);
    return order;
  }

  async getOrders(user: AuthenticatedUser) {
    if (user.role === UserRole.COOK) {
      // ETAPA 4.5.6.1 — nueva prioridad: PREPARING > PENDING > READY > DELIVERED > CANCELLED
      // UPDATED conserva peso 1 para compatibilidad con registros históricos (tratado como PREPARING)
      const orders = await this.prisma.$queryRaw`
        SELECT
          o.id,
          o."taqueriaId",
          o."waiterId",
          o."reference",
          o."type",
          o.status::text as status,
          o.revision,
          o."priorityTimestamp",
          o."createdAt",
          o."updatedAt"
        FROM "Order" o
        WHERE o."taqueriaId" = ${user.taqueriaId}
        ORDER BY
          CASE o.status::text
            WHEN 'PREPARING'  THEN 1
            WHEN 'UPDATED'    THEN 1
            WHEN 'PENDING'    THEN 2
            WHEN 'READY'      THEN 3
            WHEN 'DELIVERED'  THEN 4
            WHEN 'CANCELLED'  THEN 5
          END ASC,
          o."priorityTimestamp" ASC
      `;

      const orderIds = (orders as any[]).map((o) => o.id);

      if (orderIds.length === 0) return [];

      const fullOrders = await this.prisma.order.findMany({
        where: { id: { in: orderIds } },
        select: this.orderSelect(),
      });

      const orderMap = new Map(fullOrders.map((o) => [o.id, o]));
      return orderIds.map((id) => orderMap.get(id)).filter(Boolean);
    }

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

  async updateOrder(
    user: AuthenticatedUser,
    id: string,
    updateOrderDto: UpdateOrderDto,
  ) {
    if (user.role !== UserRole.WAITER) {
      throw new ForbiddenException('Only WAITER can edit orders');
    }

    const existingOrder = await this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        taqueriaId: true,
        waiterId: true,
        status: true,
        revision: true,
        type: true,
        reference: true,
        deliveryAddress: true,
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

    // Compute effective classification after potential type/reference/address change
    const effectiveType = updateOrderDto.type ?? existingOrder.type;
    const effectiveReference =
      updateOrderDto.reference !== undefined
        ? updateOrderDto.reference
        : existingOrder.reference;
    const effectiveDeliveryAddress =
      updateOrderDto.deliveryAddress !== undefined
        ? updateOrderDto.deliveryAddress
        : existingOrder.deliveryAddress;

    this.validateClassification(
      effectiveType,
      effectiveReference,
      effectiveDeliveryAddress,
    );

    // ETAPA 4.5.6.1 — Append-only status rules (CASO 1/2/3)
    // Only apply when new plates are being added (metadata-only changes keep current status)
    let newStatus = existingOrder.status;
    let updatePriorityTimestamp = false;

    if (updateOrderDto.plates) {
      if (
        (TERMINAL_STATUSES as readonly OrderStatus[]).includes(
          existingOrder.status,
        )
      ) {
        throw new BadRequestException(
          `Cannot add items to an order with status ${existingOrder.status}`,
        );
      }

      switch (existingOrder.status) {
        case OrderStatus.PENDING:
          // CASO 1: permanece PENDING, posición FIFO conservada
          newStatus = OrderStatus.PENDING;
          updatePriorityTimestamp = false;
          break;

        case OrderStatus.PREPARING:
        case OrderStatus.UPDATED: // legacy — tratado como PREPARING
          // CASO 2: permanece PREPARING
          newStatus = OrderStatus.PREPARING;
          updatePriorityTimestamp = true;
          break;

        case OrderStatus.READY:
          // CASO 3: revierte a PENDING para que cocina prepare los nuevos items
          newStatus = OrderStatus.PENDING;
          updatePriorityTimestamp = false;
          break;
      }

      const existingPlateNumbers = new Set(
        existingOrder.plates.map((plate) => plate.plateNumber),
      );
      const collidingPlate = updateOrderDto.plates.find((plate) =>
        existingPlateNumbers.has(plate.plateNumber),
      );
      if (collidingPlate) {
        throw new BadRequestException(
          `Plate ${collidingPlate.plateNumber} already exists and is immutable. Append a new plate.`,
        );
      }

      await this.validateProductsOwnership(
        user.taqueriaId,
        updateOrderDto.plates,
      );
    }

    const newRevision = existingOrder.revision + 1;

    await this.prisma.order.update({
      where: { id },
      data: {
        status: newStatus,
        revision: newRevision,
        ...(updatePriorityTimestamp && { priorityTimestamp: new Date() }),
        type: updateOrderDto.type ?? undefined,
        reference:
          updateOrderDto.reference !== undefined
            ? updateOrderDto.reference
            : undefined,
        deliveryAddress:
          updateOrderDto.deliveryAddress !== undefined
            ? updateOrderDto.deliveryAddress
            : undefined,
        ...(updateOrderDto.plates && {
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
        }),
      },
    });

    const updatedOrder = await this.getOrderById(user, id);
    this.realtimeGateway.emitOrderUpdated(
      updatedOrder.taqueriaId,
      updatedOrder,
    );
    return updatedOrder;
  }

  async updateOrderStatus(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateOrderStatusDto,
  ) {
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

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      // ETAPA 4.5.6.1 — limpiar isNew en cualquier transición a READY
      if (dto.status === OrderStatus.READY) {
        const plates = await tx.plate.findMany({
          where: { orderId: id },
          select: { id: true },
        });
        const plateIds = plates.map((p) => p.id);

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

    this.realtimeGateway.emitOrderStatusChanged(
      updatedOrder.taqueriaId,
      updatedOrder,
    );
    return updatedOrder;
  }

  private validateClassification(
    type: OrderType,
    reference: string | null | undefined,
    deliveryAddress: string | null | undefined,
  ): void {
    if (type === OrderType.DELIVERY) {
      if (!deliveryAddress || deliveryAddress.trim() === '') {
        throw new BadRequestException(
          'deliveryAddress is required for DELIVERY orders',
        );
      }
    } else {
      if (!reference || reference.trim() === '') {
        throw new BadRequestException(
          'reference is required for DINE_IN and TAKEAWAY orders',
        );
      }
    }
  }

  private async validateProductsOwnership(
    taqueriaId: string,
    plates: Array<{ items: Array<{ productId: string }> }>,
  ) {
    const productIds = [
      ...new Set(
        plates.flatMap((plate) => plate.items.map((item) => item.productId)),
      ),
    ];
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        taqueriaId,
      },
      select: { id: true },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException(
        'One or more products are invalid for this taqueria',
      );
    }
  }

  private orderSelect() {
    return {
      id: true,
      taqueriaId: true,
      waiterId: true,
      type: true,
      reference: true,
      deliveryAddress: true,
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
