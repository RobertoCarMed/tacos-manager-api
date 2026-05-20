import { Type } from 'class-transformer';
import { UserRole } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

class TaqueriaDataDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phone?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  address?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  city?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  state?: string;
}

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  taqueriaName: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsOptional()
  @IsBoolean()
  confirmJoinExistingTaqueria?: boolean;

  @IsOptional()
  @IsBoolean()
  createNewTaqueria?: boolean;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  selectedRestaurantCode?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TaqueriaDataDto)
  taqueriaData?: TaqueriaDataDto;
}
