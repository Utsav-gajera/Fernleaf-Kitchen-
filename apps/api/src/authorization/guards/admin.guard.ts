import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@project/shared';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<{ user?: { role?: Role } }>().user;
    if (user?.role !== Role.ADMIN) {
      throw new ForbiddenException('Only administrators can process cutoffs.');
    }
    return true;
  }
}
