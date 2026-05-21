import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { RealtimeAuthGuard } from './realtime-auth.guard';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('JWT_SECRET is required.');
        return { secret };
      },
    }),
  ],
  providers: [RealtimeGateway, RealtimeAuthGuard],
})
export class RealtimeModule {}
