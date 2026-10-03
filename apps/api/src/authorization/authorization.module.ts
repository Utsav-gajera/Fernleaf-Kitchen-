import { Global, Module } from '@nestjs/common';
import { AuthorizationService } from './authorization.service';
import { AuthorizationController } from './authorization.controller';
import { RolesGuard } from './guards/roles.guard';
import { PermissionGuard } from './guards/permission.guard';

@Global()
@Module({
  controllers: [AuthorizationController],
  providers: [AuthorizationService, RolesGuard, PermissionGuard],
  exports: [AuthorizationService, RolesGuard, PermissionGuard],
})
export class AuthorizationModule {}
