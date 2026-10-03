import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthorizationService } from './authorization.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('authorization')
export class AuthorizationController {
  constructor(private readonly authorizationService: AuthorizationService) {}

  @UseGuards(JwtAuthGuard)
  @Get('roles')
  getRoles() {
    return {
      roles: this.authorizationService.getRoles(),
    };
  }
}
