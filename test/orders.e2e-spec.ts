import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

interface AuthBody {
  accessToken: string;
  user: { taqueriaId: string };
  taqueria: { restaurantCode: string };
}

interface ProductBody {
  id: string;
}

interface OrderItemBody {
  id: string;
  unitPrice: string | null;
}

interface OrderPlateBody {
  items: OrderItemBody[];
}

interface OrderBody {
  id: string;
  plates: OrderPlateBody[];
}

describe('Orders — unitPrice snapshot (ticket-printing)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let waiterToken: string;
  let cookToken: string;
  let taqueriaId: string;
  let productId: string;
  const PRODUCT_PRICE = 20;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = moduleRef.get(PrismaService);

    const suffix = Date.now();

    const cookRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        taqueriaName: `E2E Taqueria ${suffix}`,
        name: 'Cook E2E',
        email: `cook.${suffix}@e2e.test`,
        password: 'password123',
        role: UserRole.COOK,
        createNewTaqueria: true,
        taqueriaData: {},
      });
    const cookBody = cookRes.body as AuthBody;
    cookToken = cookBody.accessToken;
    taqueriaId = cookBody.user.taqueriaId;
    const restaurantCode = cookBody.taqueria.restaurantCode;

    const waiterRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        taqueriaName: `E2E Taqueria ${suffix}`,
        name: 'Waiter E2E',
        email: `waiter.${suffix}@e2e.test`,
        password: 'password123',
        role: UserRole.WAITER,
        confirmJoinExistingTaqueria: true,
        selectedRestaurantCode: restaurantCode,
      });
    waiterToken = (waiterRes.body as AuthBody).accessToken;

    const productRes = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${cookToken}`)
      .send({ name: 'Coca', price: PRODUCT_PRICE });
    productId = (productRes.body as ProductBody).id;
  });

  afterAll(async () => {
    await prisma.item.deleteMany({
      where: { plate: { order: { taqueriaId } } },
    });
    await prisma.plate.deleteMany({ where: { order: { taqueriaId } } });
    await prisma.order.deleteMany({ where: { taqueriaId } });
    await prisma.product.deleteMany({ where: { taqueriaId } });
    await prisma.user.deleteMany({ where: { taqueriaId } });
    await prisma.taqueria.delete({ where: { id: taqueriaId } });
    await app.close();
  });

  describe('REQ-0070: POST /orders congela unitPrice por item', () => {
    it('create_snapshots_unitprice — cada item creado recibe unitPrice del catálogo', async () => {
      // @REQ-0070
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({
          type: 'DINE_IN',
          reference: 'Mesa 1',
          plates: [{ plateNumber: 1, items: [{ productId, quantity: 3 }] }],
        })
        .expect(201);

      const item = (res.body as OrderBody).plates[0].items[0];
      expect(Number(item.unitPrice)).toBe(PRODUCT_PRICE);
    });

    it('create_unitprice_in_payload — unitPrice se devuelve en el payload de la orden', async () => {
      // @REQ-0070
      const createRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({
          type: 'DINE_IN',
          reference: 'Mesa 1b',
          plates: [{ plateNumber: 1, items: [{ productId, quantity: 1 }] }],
        })
        .expect(201);

      const orderId = (createRes.body as OrderBody).id;
      const getRes = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(200);

      const item = (getRes.body as OrderBody).plates[0].items[0];
      expect(Number(item.unitPrice)).toBe(PRODUCT_PRICE);
    });
  });

  describe('REQ-0071: PATCH /orders/:id (append) congela unitPrice en items nuevos', () => {
    it('append_snapshots_unitprice — items nuevos tienen unitPrice; los previos no cambian', async () => {
      // @REQ-0071
      const createRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({
          type: 'DINE_IN',
          reference: 'Mesa 2',
          plates: [{ plateNumber: 1, items: [{ productId, quantity: 1 }] }],
        })
        .expect(201);

      const createBody = createRes.body as OrderBody;
      const orderId = createBody.id;
      const originalUnitPrice = createBody.plates[0].items[0].unitPrice;

      const appendRes = await request(app.getHttpServer())
        .patch(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({
          plates: [{ plateNumber: 2, items: [{ productId, quantity: 2 }] }],
        })
        .expect(200);

      const appendBody = appendRes.body as OrderBody;
      expect(Number(appendBody.plates[1].items[0].unitPrice)).toBe(
        PRODUCT_PRICE,
      );
      expect(appendBody.plates[0].items[0].unitPrice).toBe(originalUnitPrice);
    });
  });

  describe('REQ-0072: unitPrice es inmutable ante cambios del catálogo', () => {
    it('unitprice_frozen — cambiar el precio del producto no altera el unitPrice de órdenes existentes', async () => {
      // @REQ-0072
      const createRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({
          type: 'DINE_IN',
          reference: 'Mesa 3',
          plates: [{ plateNumber: 1, items: [{ productId, quantity: 1 }] }],
        })
        .expect(201);

      const createBody = createRes.body as OrderBody;
      const orderId = createBody.id;
      const snapshotPrice = createBody.plates[0].items[0].unitPrice;

      const NEW_PRICE = 99;
      await request(app.getHttpServer())
        .patch(`/products/${productId}`)
        .set('Authorization', `Bearer ${cookToken}`)
        .send({ price: NEW_PRICE })
        .expect(200);

      const getRes = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${waiterToken}`)
        .expect(200);

      const item = (getRes.body as OrderBody).plates[0].items[0];
      expect(item.unitPrice).toBe(snapshotPrice);
      expect(Number(item.unitPrice)).not.toBe(NEW_PRICE);

      await request(app.getHttpServer())
        .patch(`/products/${productId}`)
        .set('Authorization', `Bearer ${cookToken}`)
        .send({ price: PRODUCT_PRICE });
    });
  });

  describe('REQ-0073: Migración — backfill best-effort de unitPrice', () => {
    it('backfill_unitprice — items legacy sin unitPrice reciben el precio actual del producto', async () => {
      // @REQ-0073
      const createRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({
          type: 'DINE_IN',
          reference: 'Mesa 4',
          plates: [{ plateNumber: 1, items: [{ productId, quantity: 1 }] }],
        })
        .expect(201);

      const itemId = (createRes.body as OrderBody).plates[0].items[0].id;

      await prisma.item.update({
        where: { id: itemId },
        data: { unitPrice: null },
      });

      const nullItem = await prisma.item.findUnique({ where: { id: itemId } });
      expect(nullItem!.unitPrice).toBeNull();

      await prisma.$executeRaw`
        UPDATE "Item"
        SET "unitPrice" = (SELECT p.price FROM "Product" p WHERE p.id = "Item"."productId")
        WHERE "unitPrice" IS NULL
      `;

      const backfilledItem = await prisma.item.findUnique({
        where: { id: itemId },
      });
      expect(Number(backfilledItem!.unitPrice)).toBe(PRODUCT_PRICE);
    });

    it('backfill_idempotent — el backfill no modifica items que ya tienen unitPrice', async () => {
      // @REQ-0073
      const createRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${waiterToken}`)
        .send({
          type: 'DINE_IN',
          reference: 'Mesa 5',
          plates: [{ plateNumber: 1, items: [{ productId, quantity: 1 }] }],
        })
        .expect(201);

      const itemId = (createRes.body as OrderBody).plates[0].items[0].id;
      const priceBefore = (await prisma.item.findUnique({
        where: { id: itemId },
      }))!.unitPrice!.toString();

      await prisma.$executeRaw`
        UPDATE "Item"
        SET "unitPrice" = (SELECT p.price FROM "Product" p WHERE p.id = "Item"."productId")
        WHERE "unitPrice" IS NULL
      `;

      const priceAfter = (await prisma.item.findUnique({
        where: { id: itemId },
      }))!.unitPrice!.toString();
      expect(priceAfter).toBe(priceBefore);
    });
  });
});
