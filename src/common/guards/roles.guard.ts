import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole, RoleUtils } from '../enums/user-role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    
    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    if (!user.role) {
      throw new ForbiddenException('Usuario sin rol asignado');
    }

    const hasRole = requiredRoles.some((role) => user.role === role);
    
    if (!hasRole) {
      throw new ForbiddenException(
        `Acceso denegado. Se requiere uno de los siguientes roles: ${requiredRoles.join(', ')}`
      );
    }

    return true;
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    
    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    if (!RoleUtils.isAdminRole(user.role)) {
      throw new ForbiddenException('Acceso denegado. Se requieren permisos de administrador');
    }

    return true;
  }
}

@Injectable()
export class OrganizerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    
    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    if (!RoleUtils.canOrganizeTournaments(user.role)) {
      throw new ForbiddenException('Acceso denegado. Se requieren permisos de organizador');
    }

    return true;
  }
}