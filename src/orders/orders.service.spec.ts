import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus, OrderType, UserRole } from '@prisma/client';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';

const mockPrismaService = {
  order: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  product: {
    findMany: jest.fn(),
  },
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
};

const mockRealtimeGateway = {
  emitOrderCreated: jest.fn(),
  emitOrderUpdated: jest.fn(),
  emitOrderStatusChanged: jest.fn(),
};

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: RealtimeGateway,
          useValue: mockRealtimeGateway,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── Kitchen Queue Logic ──────────────────────────────────────────────────

  describe('Kitchen Queue Logic (FIFO)', () => {
    const simulateDatabaseSort = (orders: any[]) => {
      const statusWeight: Record<string, number> = {
        PREPARING: 1,
        UPDATED: 1, // legacy — treated as PREPARING
        PENDING: 2,
        READY: 3,
        DELIVERED: 4,
        CANCELLED: 5,
      };

      return [...orders].sort((a, b) => {
        const weightA = statusWeight[a.status];
        const weightB = statusWeight[b.status];

        if (weightA !== weightB) {
          return weightA - weightB;
        }

        return a.priorityTimestamp.getTime() - b.priorityTimestamp.getTime();
      });
    };

    it('Caso 1: PENDING vs PENDING -> FIFO (El más antiguo primero)', () => {
      const orderA = {
        id: '1',
        status: 'PENDING',
        priorityTimestamp: new Date('2026-05-19T12:00:00Z'),
      };
      const orderB = {
        id: '2',
        status: 'PENDING',
        priorityTimestamp: new Date('2026-05-19T12:05:00Z'),
      };

      const sorted = simulateDatabaseSort([orderB, orderA]);

      expect(sorted[0].id).toBe('1');
      expect(sorted[1].id).toBe('2');
    });

    it('Caso 2: PREPARING vs PENDING -> PREPARING primero, luego PENDING en FIFO', () => {
      const orderA = {
        id: '1',
        status: 'PENDING',
        priorityTimestamp: new Date('2026-05-19T12:00:00Z'),
      };
      const orderB = {
        id: '2',
        status: 'PENDING',
        priorityTimestamp: new Date('2026-05-19T12:05:00Z'),
      };
      const orderC = {
        id: '3',
        status: 'PREPARING',
        priorityTimestamp: new Date('2026-05-19T12:15:00Z'),
      };

      const sorted = simulateDatabaseSort([orderA, orderC, orderB]);

      expect(sorted[0].id).toBe('3');
      expect(sorted[1].id).toBe('1');
      expect(sorted[2].id).toBe('2');
    });

    it('Caso 3: PREPARING vs PREPARING -> FIFO (La actualización más antigua va primero)', () => {
      const orderA = {
        id: '1',
        status: 'PREPARING',
        priorityTimestamp: new Date('2026-05-19T12:00:00Z'),
      };
      const orderB = {
        id: '2',
        status: 'PREPARING',
        priorityTimestamp: new Date('2026-05-19T12:10:00Z'),
      };

      const sorted = simulateDatabaseSort([orderB, orderA]);

      expect(sorted[0].id).toBe('1');
      expect(sorted[1].id).toBe('2');
    });
  });

  // ─── getOrders ────────────────────────────────────────────────────────────

  describe('getOrders', () => {
    it('debería solicitar a Prisma el orden correcto (ASC para FIFO) cuando el usuario es COOK', async () => {
      const cookUser = {
        id: 'cook-1',
        role: UserRole.COOK,
        taqueriaId: 't-1',
        name: 'Chef',
        email: 'chef@t.com',
      };
      prisma.$queryRaw.mockResolvedValue([]);

      await service.getOrders(cookUser);

      expect(prisma.$queryRaw).toHaveBeenCalled();

      const queryArg = prisma.$queryRaw.mock.calls[0][0];
      const sqlString = Array.isArray(queryArg) ? queryArg.join('?') : queryArg;

      expect(sqlString).toContain('o."priorityTimestamp" ASC');
    });
  });

  // ─── Queue Rules (ETAPA 4.5.6.1) ─────────────────────────────────────────

  describe('Queue Rules (ETAPA 4.5.6.1)', () => {
    const waiterUser = {
      id: 'waiter-1',
      role: UserRole.WAITER,
      taqueriaId: 't-1',
      name: 'Mesero',
      email: 'mesero@t.com',
    };

    const addPlatesDto = {
      plates: [
        {
          plateNumber: 1,
          items: [
            {
              productId: 'prod-1',
              quantity: 1,
              selectedComplements: [],
              notes: null,
            },
          ],
        },
      ],
    };

    const baseExistingOrder = {
      id: 'order-1',
      taqueriaId: 't-1',
      waiterId: 'waiter-1',
      revision: 1,
      type: OrderType.DINE_IN,
      reference: 'Mesa 5',
      deliveryAddress: null,
      plates: [],
    };

    const fullUpdatedOrder = {
      id: 'order-1',
      taqueriaId: 't-1',
      waiterId: 'waiter-1',
      type: OrderType.DINE_IN,
      reference: 'Mesa 5',
      deliveryAddress: null,
      status: OrderStatus.PENDING,
      revision: 2,
      priorityTimestamp: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      plates: [],
    };

    const setupUpdateOrderMocks = (existingStatus: OrderStatus) => {
      prisma.order.findUnique
        .mockResolvedValueOnce({ ...baseExistingOrder, status: existingStatus })
        .mockResolvedValueOnce(fullUpdatedOrder);
      prisma.product.findMany.mockResolvedValue([{ id: 'prod-1' }]);
      prisma.order.update.mockResolvedValue({});
    };

    it('Caso 1: pedido PENDING editado debe permanecer en PENDING sin actualizar priorityTimestamp', async () => {
      setupUpdateOrderMocks(OrderStatus.PENDING);

      await service.updateOrder(waiterUser, 'order-1', addPlatesDto as any);

      const updateCall = prisma.order.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe(OrderStatus.PENDING);
      expect(updateCall.data).not.toHaveProperty('priorityTimestamp');
    });

    it('Caso 2: pedido PREPARING editado debe permanecer en PREPARING con priorityTimestamp actualizado', async () => {
      setupUpdateOrderMocks(OrderStatus.PREPARING);

      await service.updateOrder(waiterUser, 'order-1', addPlatesDto as any);

      const updateCall = prisma.order.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe(OrderStatus.PREPARING);
      expect(updateCall.data.priorityTimestamp).toBeInstanceOf(Date);
    });

    it('Caso 3: pedido READY editado debe volver a PENDING sin actualizar priorityTimestamp', async () => {
      setupUpdateOrderMocks(OrderStatus.READY);

      await service.updateOrder(waiterUser, 'order-1', addPlatesDto as any);

      const updateCall = prisma.order.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe(OrderStatus.PENDING);
      expect(updateCall.data).not.toHaveProperty('priorityTimestamp');
    });

    it('Caso 4: items agregados en un plate nuevo deben tener isNew: true', async () => {
      setupUpdateOrderMocks(OrderStatus.PENDING);

      await service.updateOrder(waiterUser, 'order-1', addPlatesDto as any);

      const updateCall = prisma.order.update.mock.calls[0][0];
      const createdItems = updateCall.data.plates.create[0].items.create;
      expect(createdItems[0]).toMatchObject({ isNew: true });
    });

    it('Caso 5: emite emitOrderUpdated con los datos correctos después de actualizar', async () => {
      setupUpdateOrderMocks(OrderStatus.PENDING);

      await service.updateOrder(waiterUser, 'order-1', addPlatesDto as any);

      expect(mockRealtimeGateway.emitOrderUpdated).toHaveBeenCalledWith(
        fullUpdatedOrder.taqueriaId,
        fullUpdatedOrder,
      );
    });

    it('Caso 6: pedido UPDATED (legacy) editado debe pasar a PREPARING con priorityTimestamp actualizado', async () => {
      setupUpdateOrderMocks(OrderStatus.UPDATED);

      await service.updateOrder(waiterUser, 'order-1', addPlatesDto as any);

      const updateCall = prisma.order.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe(OrderStatus.PREPARING);
      expect(updateCall.data.priorityTimestamp).toBeInstanceOf(Date);
    });
  });

  // ─── Order Classification (ETAPA 4.6.1) ──────────────────────────────────

  describe('validateClassification (via createOrder)', () => {
    const waiterUser = {
      id: 'waiter-1',
      role: UserRole.WAITER,
      taqueriaId: 't-1',
      name: 'Mesero',
      email: 'mesero@t.com',
    };

    const mockCreatedOrder = {
      id: 'order-1',
      taqueriaId: 't-1',
      waiterId: 'waiter-1',
      type: OrderType.DINE_IN,
      reference: 'Mesa 5',
      deliveryAddress: null,
      status: OrderStatus.PENDING,
      revision: 1,
      priorityTimestamp: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      plates: [],
    };

    it('Caso 4: DINE_IN con reference → crea la orden correctamente', async () => {
      prisma.product.findMany.mockResolvedValue([{ id: 'prod-1' }]);
      prisma.order.create.mockResolvedValue(mockCreatedOrder);

      const dto = {
        type: OrderType.DINE_IN,
        reference: 'Mesa 5',
        plates: [
          {
            plateNumber: 1,
            items: [
              {
                productId: 'prod-1',
                quantity: 2,
                selectedComplements: [],
                notes: null,
              },
            ],
          },
        ],
      };

      const result = await service.createOrder(waiterUser, dto as any);

      expect(result.type).toBe(OrderType.DINE_IN);
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: OrderType.DINE_IN,
            reference: 'Mesa 5',
            deliveryAddress: null,
          }),
        }),
      );
    });

    it('Caso 5: TAKEAWAY con reference → crea la orden correctamente', async () => {
      const takeawayOrder = {
        ...mockCreatedOrder,
        type: OrderType.TAKEAWAY,
        reference: 'Juan',
      };
      prisma.product.findMany.mockResolvedValue([{ id: 'prod-1' }]);
      prisma.order.create.mockResolvedValue(takeawayOrder);

      const dto = {
        type: OrderType.TAKEAWAY,
        reference: 'Juan',
        plates: [
          {
            plateNumber: 1,
            items: [
              {
                productId: 'prod-1',
                quantity: 1,
                selectedComplements: [],
                notes: null,
              },
            ],
          },
        ],
      };

      const result = await service.createOrder(waiterUser, dto as any);

      expect(result.type).toBe(OrderType.TAKEAWAY);
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: OrderType.TAKEAWAY,
            reference: 'Juan',
          }),
        }),
      );
    });

    it('Caso 6: DELIVERY con deliveryAddress → crea la orden correctamente', async () => {
      const deliveryOrder = {
        ...mockCreatedOrder,
        type: OrderType.DELIVERY,
        reference: null,
        deliveryAddress: 'Calle Falsa 123',
      };
      prisma.product.findMany.mockResolvedValue([{ id: 'prod-1' }]);
      prisma.order.create.mockResolvedValue(deliveryOrder);

      const dto = {
        type: OrderType.DELIVERY,
        deliveryAddress: 'Calle Falsa 123',
        plates: [
          {
            plateNumber: 1,
            items: [
              {
                productId: 'prod-1',
                quantity: 1,
                selectedComplements: [],
                notes: null,
              },
            ],
          },
        ],
      };

      const result = await service.createOrder(waiterUser, dto as any);

      expect(result.type).toBe(OrderType.DELIVERY);
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: OrderType.DELIVERY,
            deliveryAddress: 'Calle Falsa 123',
          }),
        }),
      );
    });

    it('Caso 7: DINE_IN sin reference → lanza BadRequestException', async () => {
      const dto = {
        type: OrderType.DINE_IN,
        plates: [
          {
            plateNumber: 1,
            items: [
              {
                productId: 'prod-1',
                quantity: 1,
                selectedComplements: [],
                notes: null,
              },
            ],
          },
        ],
      };

      await expect(service.createOrder(waiterUser, dto as any)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('Caso 8: DELIVERY sin deliveryAddress → lanza BadRequestException', async () => {
      const dto = {
        type: OrderType.DELIVERY,
        plates: [
          {
            plateNumber: 1,
            items: [
              {
                productId: 'prod-1',
                quantity: 1,
                selectedComplements: [],
                notes: null,
              },
            ],
          },
        ],
      };

      await expect(service.createOrder(waiterUser, dto as any)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('Caso 9: TAKEAWAY con deliveryAddress en lugar de reference → lanza BadRequestException', async () => {
      const dto = {
        type: OrderType.TAKEAWAY,
        deliveryAddress: 'Calle Falsa 123',
        plates: [
          {
            plateNumber: 1,
            items: [
              {
                productId: 'prod-1',
                quantity: 1,
                selectedComplements: [],
                notes: null,
              },
            ],
          },
        ],
      };

      await expect(service.createOrder(waiterUser, dto as any)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('Caso 10: DELIVERY con reference en lugar de deliveryAddress → lanza BadRequestException', async () => {
      const dto = {
        type: OrderType.DELIVERY,
        reference: 'Calle Falsa 123',
        plates: [
          {
            plateNumber: 1,
            items: [
              {
                productId: 'prod-1',
                quantity: 1,
                selectedComplements: [],
                notes: null,
              },
            ],
          },
        ],
      };

      await expect(service.createOrder(waiterUser, dto as any)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.order.create).not.toHaveBeenCalled();
    });
  });
});
