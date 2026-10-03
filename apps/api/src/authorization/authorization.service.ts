import { Injectable } from '@nestjs/common';
import { Role } from '@project/shared';

@Injectable()
export class AuthorizationService {
  /**
   * Domain check for role authorization (stubs for future business logic)
   */
  hasRequiredRole(userRole: string, allowedRoles: (Role | string)[]): boolean {
    return allowedRoles.includes(userRole as Role);
  }

  getRoles(): string[] {
    return Object.values(Role);
  }
}
