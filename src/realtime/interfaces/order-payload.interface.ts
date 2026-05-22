import { OrderStatus } from '@prisma/client';

export interface OrderItemPayload {
  id: string;
  productId: string;
  quantity: number;
  selectedComplements: string[];
  notes: string | null;
  isNew: boolean;
  createdInRevision: number;
  createdAt: Date;
}

export interface OrderPlatePayload {
  id: string;
  plateNumber: number;
  isClosed: boolean;
  createdInRevision: number;
  createdAt: Date;
  items: OrderItemPayload[];
}

export interface OrderRealtimePayload {
  id: string;
  taqueriaId: string;
  waiterId: string;
  tableNumber: string;
  status: OrderStatus;
  revision: number;
  priorityTimestamp: Date;
  createdAt: Date;
  updatedAt: Date;
  plates: OrderPlatePayload[];
}
