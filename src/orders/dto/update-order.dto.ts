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

class UpdateOrderItemDto {
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

class UpdateOrderPlateDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  plateNumber: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateOrderItemDto)
  items: UpdateOrderItemDto[];
}

export class UpdateOrderDto {
  @IsOptional()
  @IsEnum(OrderType)
  type?: OrderType;

  // Required for DINE_IN and TAKEAWAY when type is being changed to those values
  @ValidateIf(
    (o) => o.type === OrderType.DINE_IN || o.type === OrderType.TAKEAWAY,
  )
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  reference?: string;

  // Required for DELIVERY when type is being changed to DELIVERY
  @ValidateIf((o) => o.type === OrderType.DELIVERY)
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  deliveryAddress?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateOrderPlateDto)
  plates?: UpdateOrderPlateDto[];
}
