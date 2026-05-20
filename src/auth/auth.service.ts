import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    this.validateRegisterFlags(registerDto);

    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const taqueriaMatches = await this.usersService.findTaqueriasByName(registerDto.taqueriaName);

    // Phase 1: discovery, no side effects.
    if (!registerDto.confirmJoinExistingTaqueria && !registerDto.createNewTaqueria) {
      if (taqueriaMatches.length === 0) {
        return {
          taqueriaMatches: 0,
          canCreateNewTaqueria: true,
          requiresTaqueriaInfo: true,
          message: 'No encontramos una taquería con este nombre. Puedes crear una nueva.',
        };
      }

      if (taqueriaMatches.length === 1) {
        return {
          taqueriaMatches: 1,
          canJoinExistingTaqueria: true,
          canCreateNewTaqueria: true,
          taquerias: taqueriaMatches.map((taqueria) => ({
            id: taqueria.id,
            name: taqueria.name,
            restaurantCode: taqueria.restaurantCode,
          })),
          message: 'Encontramos una taquería con este nombre.',
        };
      }

      return {
        taqueriaMatches: taqueriaMatches.length,
        canJoinExistingTaqueria: true,
        canCreateNewTaqueria: true,
        taquerias: taqueriaMatches.map((taqueria) => ({
          id: taqueria.id,
          name: taqueria.name,
          restaurantCode: taqueria.restaurantCode,
        })),
        message: 'Encontramos varias taquerías con este nombre.',
      };
    }

    // Phase 2A: join existing taqueria.
    if (registerDto.confirmJoinExistingTaqueria) {
      if (!registerDto.selectedRestaurantCode) {
        throw new BadRequestException(
          'selectedRestaurantCode is required when confirmJoinExistingTaqueria is true.',
        );
      }
      const taqueria = await this.usersService.findTaqueriaByRestaurantCode(
        registerDto.selectedRestaurantCode,
      );
      if (!taqueria) {
        throw new BadRequestException('Invalid selectedRestaurantCode.');
      }

      const hashedPassword = await bcrypt.hash(registerDto.password, 10);
      const createdUser = await this.usersService.createUserInTaqueria({
        taqueriaId: taqueria.id,
        name: registerDto.name,
        email: registerDto.email,
        password: hashedPassword,
        role: registerDto.role,
      });

      return this.buildAuthResponse(createdUser.id);
    }

    // Phase 2B: create new taqueria.
    if (!registerDto.taqueriaData) {
      throw new BadRequestException(
        'taqueriaData is required when createNewTaqueria is true.',
      );
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const taqueria = await this.createTaqueriaWithUniqueCode({
      name: registerDto.taqueriaName,
      taqueriaData: registerDto.taqueriaData,
    });
    const createdUser = await this.usersService.createUserInTaqueria({
      taqueriaId: taqueria.id,
      name: registerDto.name,
      email: registerDto.email,
      password: hashedPassword,
      role: registerDto.role,
    });

    return this.buildAuthResponse(createdUser.id);
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.taqueriaId) {
      throw new BadRequestException('User has no taqueria assigned');
    }

    return this.buildAuthResponse(user.id);
  }

  private validateRegisterFlags(registerDto: RegisterDto): void {
    if (registerDto.confirmJoinExistingTaqueria && registerDto.createNewTaqueria) {
      throw new BadRequestException(
        'confirmJoinExistingTaqueria and createNewTaqueria cannot both be true.',
      );
    }

    if (registerDto.confirmJoinExistingTaqueria && registerDto.taqueriaData) {
      throw new BadRequestException(
        'taqueriaData is not allowed when confirmJoinExistingTaqueria is true.',
      );
    }

    if (registerDto.createNewTaqueria && registerDto.selectedRestaurantCode) {
      throw new BadRequestException(
        'selectedRestaurantCode is not allowed when createNewTaqueria is true.',
      );
    }

    if (registerDto.confirmJoinExistingTaqueria && !registerDto.selectedRestaurantCode) {
      throw new BadRequestException(
        'selectedRestaurantCode is required when confirmJoinExistingTaqueria is true.',
      );
    }
  }

  private async createTaqueriaWithUniqueCode(data: {
    name: string;
    taqueriaData: {
      phone?: string;
      address?: string;
      city?: string;
      state?: string;
    };
  }) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const restaurantCode = this.generateRestaurantCode();
      try {
        return await this.usersService.createTaqueria({
          name: data.name,
          restaurantCode,
          phone: data.taqueriaData.phone,
          address: data.taqueriaData.address,
          city: data.taqueriaData.city,
          state: data.taqueriaData.state,
        });
      } catch (error: unknown) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException('Unable to generate unique restaurant code');
  }

  private generateRestaurantCode(): string {
    const value = Math.floor(1000 + Math.random() * 9000);
    return `TM-${value}`;
  }

  private async buildAuthResponse(userId: string) {
    const authUser = await this.usersService.findAuthUserById(userId);
    if (!authUser) {
      throw new UnauthorizedException('Unable to resolve authenticated user');
    }

    const payload = {
      sub: authUser.id,
      email: authUser.email,
      role: authUser.role,
      taqueriaId: authUser.taqueriaId,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: authUser.id,
        name: authUser.name,
        email: authUser.email,
        role: authUser.role,
        taqueriaId: authUser.taqueriaId,
      },
      taqueria: authUser.taqueria,
    };
  }
}
