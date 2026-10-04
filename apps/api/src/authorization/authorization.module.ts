import { Global, Module } from '@nestjs/common';
import { AuthorizationService } from './authorization.service';
import { AuthorizationController } from './authorization.controller';
import { PermissionGuard } from './guards/permission.guard';

@Global()
@Module({
  controllers: [AuthorizationController],
  providers: [AuthorizationService, PermissionGuard],
  exports: [AuthorizationService, PermissionGuard],
})
export class AuthorizationModule {}
