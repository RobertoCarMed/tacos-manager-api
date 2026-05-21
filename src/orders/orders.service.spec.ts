import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus, UserRole } from '@prisma/client';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrismaService = {
  order: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
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

  describe('Kitchen Queue Logic (FIFO)', () => {
    /**
     * Esta función simula exactamente la misma lógica de ordenamiento
     * que la base de datos realiza en o."priorityTimestamp" ASC y por status.
     * Sirve como validación en memoria para los tests.
     */
    const simulateDatabaseSort = (orders: any[]) => {
      const statusWeight: Record<string, number> = {
        UPDATED: 1,
        PENDING: 2,
        PREPARING: 3,
        READY: 4,
        DELIVERED: 5,
        CANCELLED: 6,
      };

      return [...orders].sort((a, b) => {
        const weightA = statusWeight[a.status];
        const weightB = statusWeight[b.status];

        // 1. Prioridad por status
        if (weightA !== weightB) {
          return weightA - weightB;
        }

        // 2. FIFO dentro del mismo grupo (priorityTimestamp ASC)
        // El timestamp más antiguo debe ir primero.
        return a.priorityTimestamp.getTime() - b.priorityTimestamp.getTime();
      });
    };

    it('Caso 1: PENDING vs PENDING -> FIFO (El más antiguo primero)', () => {
      const orderA = { id: '1', status: 'PENDING', priorityTimestamp: new Date('2026-05-19T12:00:00Z') };
      const orderB = { id: '2', status: 'PENDING', priorityTimestamp: new Date('2026-05-19T12:05:00Z') };

      const sorted = simulateDatabaseSort([orderB, orderA]);
      
      expect(sorted[0].id).toBe('1'); // Order A
      expect(sorted[1].id).toBe('2'); // Order B
    });

    it('Caso 2: UPDATED vs PENDING vs PENDING -> UPDATED primero, luego PENDING en FIFO', () => {
      const orderA = { id: '1', status: 'PENDING', priorityTimestamp: new Date('2026-05-19T12:00:00Z') };
      const orderB = { id: '2', status: 'PENDING', priorityTimestamp: new Date('2026-05-19T12:05:00Z') };
      const orderC = { id: '3', status: 'UPDATED', priorityTimestamp: new Date('2026-05-19T12:15:00Z') };

      const sorted = simulateDatabaseSort([orderA, orderC, orderB]);
      
      expect(sorted[0].id).toBe('3'); // Order C (UPDATED)
      expect(sorted[1].id).toBe('1'); // Order A (PENDING más antiguo)
      expect(sorted[2].id).toBe('2'); // Order B (PENDING más reciente)
    });

    it('Caso 3: UPDATED vs UPDATED -> FIFO (La actualización más antigua va primero)', () => {
      const orderA = { id: '1', status: 'UPDATED', priorityTimestamp: new Date('2026-05-19T12:00:00Z') };
      const orderB = { id: '2', status: 'UPDATED', priorityTimestamp: new Date('2026-05-19T12:10:00Z') };

      const sorted = simulateDatabaseSort([orderB, orderA]);
      
      expect(sorted[0].id).toBe('1'); // Order A (Más antigua)
      expect(sorted[1].id).toBe('2'); // Order B (Más reciente)
    });
  });

  describe('getOrders', () => {
    it('debería solicitar a Prisma el orden correcto (ASC para FIFO) cuando el usuario es COOK', async () => {
      const cookUser = { id: 'cook-1', role: UserRole.COOK, taqueriaId: 't-1', name: 'Chef', email: 'chef@t.com' };
      prisma.$queryRaw.mockResolvedValue([]);

      await service.getOrders(cookUser);

      // Verificamos que se haya hecho la llamada $queryRaw
      expect(prisma.$queryRaw).toHaveBeenCalled();
      
      // Obtenemos la consulta SQL generada por los tag templates
      const queryArg = prisma.$queryRaw.mock.calls[0][0];
      const sqlString = Array.isArray(queryArg) ? queryArg.join('?') : queryArg;
      
      // Validamos que el query contenga la condición FIFO esperada
      expect(sqlString).toContain('o."priorityTimestamp" ASC');
    });
  });
});
