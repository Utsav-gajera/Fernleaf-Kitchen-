import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission, Role } from '@project/shared';
import { AuthorizationService } from '../authorization.service';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorizationService: AuthorizationService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user?.role) {
      throw new ForbiddenException('Access denied: no user role found');
    }

    const permissions = this.authorizationService.getPermissionsForRole(user.role as Role);
    const missingPermissions = requiredPermissions.filter(
      (permission) => !permissions.includes(permission),
    );

    if (missingPermissions.length > 0) {
      throw new ForbiddenException(
        `Access denied: missing permissions ${missingPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
