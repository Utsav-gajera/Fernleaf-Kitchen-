import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    void dto;
    throw new ForbiddenException('Public registration is disabled. An administrator must create staff accounts.');
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.staffUser.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = this.generateToken(user.id, user.email, user.role);

    return {
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      },
      accessToken: token,
    };
  }

  logout() {
    return {
      message: 'Logged out successfully',
    };
  }

  private generateToken(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };
    return this.jwtService.sign(payload);
  }
}
