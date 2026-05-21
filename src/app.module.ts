import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { RealtimeModule } from './realtime/realtime.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [PrismaModule, UsersModule, AuthModule, ProductsModule, OrdersModule, RealtimeModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
