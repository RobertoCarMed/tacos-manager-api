import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { JoinTaqueriaDto } from './dto/join-taqueria.dto';
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
    const existingUser = await this.usersService.findByEmail(registerDto.email);

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const existingTaqueria = await this.usersService.findTaqueriaByName(registerDto.taqueriaName);
    if (existingTaqueria) {
      return {
        message: 'Taquería ya existente',
        taqueriaExists: true,
        taqueriaName: existingTaqueria.name,
        canJoin: true,
      };
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const taqueria = await this.createTaqueriaWithUniqueCode(registerDto.taqueriaName);
    const createdUser = await this.usersService.createUserInTaqueria({
      taqueriaId: taqueria.id,
      name: registerDto.name,
      email: registerDto.email,
      password: hashedPassword,
      role: registerDto.role,
    });

    return this.buildAuthResponse(createdUser.id);
  }

  async joinTaqueria(joinTaqueriaDto: JoinTaqueriaDto) {
    const existingUser = await this.usersService.findByEmail(joinTaqueriaDto.email);
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const taqueria = await this.usersService.findTaqueriaByName(joinTaqueriaDto.taqueriaName);
    if (!taqueria) {
      throw new NotFoundException('Taquería not found. Please register it first.');
    }

    const hashedPassword = await bcrypt.hash(joinTaqueriaDto.password, 10);
    const createdUser = await this.usersService.createUserInTaqueria({
      taqueriaId: taqueria.id,
      name: joinTaqueriaDto.name,
      email: joinTaqueriaDto.email,
      password: hashedPassword,
      role: joinTaqueriaDto.role,
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

  private async createTaqueriaWithUniqueCode(name: string) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const restaurantCode = this.generateRestaurantCode();
      try {
        return await this.usersService.createTaqueria({ name, restaurantCode });
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
