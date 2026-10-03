import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionGuard } from '../authorization/guards/permission.guard';
import { RequirePermissions } from '../authorization/decorators/permissions.decorator';
import { Permission } from '@project/shared';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout() {
    return this.authService.logout();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Request() req: { user: Record<string, unknown> }) {
    return {
      message: 'Profile fetched successfully',
      user: req.user,
    };
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions(Permission.STAFF_MANAGE)
  @Get('admin-only')
  getAdminData(@Request() req: { user: Record<string, unknown> }) {
    return {
      message: 'Access granted! You are viewing protected ADMIN-only data.',
      user: req.user,
      secretAdminData: {
        serverStatus: 'Healthy',
        environment: process.env.NODE_ENV || 'development',
        databaseEngine: 'PostgreSQL (Cloud)',
        timestamp: new Date().toISOString(),
      },
    };
  }
}
