import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { AuthenticatedSocket } from './interfaces/authenticated-socket.interface';

/**
 * Guard para handlers individuales de WebSocket.
 * Verifica que el socket ya tenga contexto de usuario cargado por handleConnection.
 */
@Injectable()
export class RealtimeAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<AuthenticatedSocket>();

    if (!client.data?.user) {
      throw new WsException('Unauthorized');
    }

    return true;
  }
}
