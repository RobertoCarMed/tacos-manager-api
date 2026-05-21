import { UserRole } from '@prisma/client';
import { Socket } from 'socket.io';

export interface AuthenticatedSocketUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  taqueriaId: string;
  restaurantCode: string;
}

export interface AuthenticatedSocket extends Socket {
  data: {
    user: AuthenticatedSocketUser;
  };
}
