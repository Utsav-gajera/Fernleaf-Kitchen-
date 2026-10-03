import { Module } from '@nestjs/common';
import { AuthorizationService } from './authorization.service';
import { AuthorizationController } from './authorization.controller';
import { RolesGuard } from './guards/roles.guard';

@Module({
  controllers: [AuthorizationController],
  providers: [AuthorizationService, RolesGuard],
  exports: [AuthorizationService, RolesGuard],
})
export class AuthorizationModule {}
