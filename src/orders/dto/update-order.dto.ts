import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

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
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateOrderPlateDto)
  plates: UpdateOrderPlateDto[];
}
