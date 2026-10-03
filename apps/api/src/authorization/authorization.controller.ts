import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthorizationService } from './authorization.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from './guards/permission.guard';
import { RequirePermissions } from './decorators/permissions.decorator';
import { Permission } from '@project/shared';

@Controller('authorization')
export class AuthorizationController {
  constructor(private readonly authorizationService: AuthorizationService) {}

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @Get('roles')
  getRoles() {
    return {
      roles: this.authorizationService.getRoles(),
    };
  }
}
