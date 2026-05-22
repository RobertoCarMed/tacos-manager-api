import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { RealtimeAuthGuard } from './realtime-auth.guard';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [AuthModule, UsersModule],
  providers: [RealtimeGateway, RealtimeAuthGuard],
})
export class RealtimeModule {}
