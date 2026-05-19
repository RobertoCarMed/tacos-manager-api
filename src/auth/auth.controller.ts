import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service';
import { JoinTaqueriaDto } from './dto/join-taqueria.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './roles.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('join-taqueria')
  joinTaqueria(@Body() joinTaqueriaDto: JoinTaqueriaDto) {
    return this.authService.joinTaqueria(joinTaqueriaDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.WAITER, UserRole.COOK)
  @Get('me')
  me(@Req() req: { user: unknown }) {
    return req.user;
  }
}
