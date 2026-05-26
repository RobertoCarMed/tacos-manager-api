import { Logger, UseGuards } from '@nestjs/common';
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { UsersService } from '../users/users.service';
import type { AuthenticatedSocket } from './interfaces/authenticated-socket.interface';
import type { OrderRealtimePayload } from './interfaces/order-payload.interface';
import { RealtimeAuthGuard } from './realtime-auth.guard';

@WebSocketGateway()
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  readonly server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = this.extractToken(client);

      if (!token) {
        this.logger.warn(`Connection rejected — no token: ${client.id}`);
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync<{ sub: string }>(token);
      const user = await this.usersService.findAuthUserById(payload.sub);

      if (!user || !user.taqueria) {
        this.logger.warn(`Connection rejected — invalid user: ${client.id}`);
        client.disconnect();
        return;
      }

      client.data.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        taqueriaId: user.taqueriaId,
        restaurantCode: user.taqueria.restaurantCode,
      };

      const room = `taqueria:${user.taqueriaId}`;
      await client.join(room);

      this.logger.log(
        `Connected: ${client.id} | user=${user.id} | room=${room}`,
      );
    } catch {
      this.logger.warn(`Connection rejected — invalid token: ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.data?.user?.id ?? 'unknown';
    this.logger.log(`Disconnected: ${client.id} | user=${userId}`);
  }

  @UseGuards(RealtimeAuthGuard)
  @SubscribeMessage('join-taqueria')
  handleJoinTaqueria(@ConnectedSocket() client: AuthenticatedSocket) {
    const { taqueriaId, restaurantCode } = client.data.user;
    const room = `taqueria:${taqueriaId}`;

    return {
      event: 'join-taqueria',
      data: { room, taqueriaId, restaurantCode },
    };
  }

  emitOrderCreated(taqueriaId: string, order: OrderRealtimePayload): void {
    if (!this.server) {
      this.logger.warn('WebSocket server not ready — skipping order-created emission');
      return;
    }
    try {
      this.server.to(`taqueria:${taqueriaId}`).emit('order-created', { order });
      this.logger.log(`order-created → taqueria:${taqueriaId} order=${order.id}`);
    } catch (error) {
      this.logger.error(`Failed to emit order-created order=${order.id}`, error);
    }
  }

  emitOrderUpdated(taqueriaId: string, order: OrderRealtimePayload): void {
    if (!this.server) {
      this.logger.warn('WebSocket server not ready — skipping order-updated emission');
      return;
    }
    try {
      this.server.to(`taqueria:${taqueriaId}`).emit('order-updated', { order });
      this.logger.log(`order-updated → taqueria:${taqueriaId} order=${order.id} rev=${order.revision}`);
    } catch (error) {
      this.logger.error(`Failed to emit order-updated order=${order.id}`, error);
    }
  }

  emitOrderStatusChanged(taqueriaId: string, order: OrderRealtimePayload): void {
    if (!this.server) {
      this.logger.warn('WebSocket server not ready — skipping order-status-changed emission');
      return;
    }
    try {
      this.server.to(`taqueria:${taqueriaId}`).emit('order-status-changed', { order });
      this.logger.log(`order-status-changed → taqueria:${taqueriaId} order=${order.id} status=${order.status}`);
    } catch (error) {
      this.logger.error(`Failed to emit order-status-changed order=${order.id}`, error);
    }
  }

  private extractToken(client: Socket): string | null {
    const tokenFromAuth = client.handshake.auth?.token as string | undefined;
    if (tokenFromAuth) return tokenFromAuth;

    const authHeader = client.handshake.headers?.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    return null;
  }
}
