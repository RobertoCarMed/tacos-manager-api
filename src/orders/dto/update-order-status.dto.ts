import { OrderStatus } from '@prisma/client';
import { IsEnum, NotEquals } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  @NotEquals(OrderStatus.UPDATED, {
    message: 'Cannot set UPDATED status manually',
  })
  status: OrderStatus;
}
