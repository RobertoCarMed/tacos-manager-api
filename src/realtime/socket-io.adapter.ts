import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';

export class ConfiguredSocketIoAdapter extends IoAdapter {
  private readonly socketOrigin: string;

  constructor(app: INestApplication) {
    super(app);
    const configService = app.get(ConfigService);
    this.socketOrigin = configService.get<string>('SOCKET_ORIGIN', '*');
  }

  createIOServer(port: number, options?: ServerOptions): unknown {
    return super.createIOServer(port, {
      ...options,
      cors: {
        origin: this.socketOrigin,
        credentials: true,
      },
    });
  }
}
