import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
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
    const existingUser = await this.usersService.findByEmail(registerDto.email);

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const createdUser = await this.usersService.createUserWithTaqueria({
      taqueriaName: registerDto.taqueriaName,
      name: registerDto.name,
      email: registerDto.email,
      password: hashedPassword,
      role: registerDto.role,
    });

    const user = this.usersService.sanitizeUser(createdUser);

    return {
      message: 'User registered successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        taqueriaId: user.taqueriaId,
      },
      taqueria: user.taqueria,
    };
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

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      taqueriaId: user.taqueriaId,
    };

    const accessToken = await this.jwtService.signAsync(payload);
    const authUser = await this.usersService.findAuthUserById(user.id);

    if (!authUser) {
      throw new UnauthorizedException('Unable to resolve authenticated user');
    }

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
