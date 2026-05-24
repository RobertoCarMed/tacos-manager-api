import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { OrderType } from '@prisma/client';

class CreateOrderItemDto {
  @IsUUID()
  productId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedComplements?: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}

class CreateOrderPlateDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  plateNumber: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}

export class CreateOrderDto {
  @IsEnum(OrderType)
  type: OrderType;

  // Required for DINE_IN and TAKEAWAY
  @ValidateIf((o) => o.type === OrderType.DINE_IN || o.type === OrderType.TAKEAWAY)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  reference?: string;

  // Required for DELIVERY
  @ValidateIf((o) => o.type === OrderType.DELIVERY)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  deliveryAddress?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderPlateDto)
  plates: CreateOrderPlateDto[];
}
