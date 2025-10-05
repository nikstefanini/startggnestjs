import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';

export const ROLES_KEY = 'roles';

/**
 * Decorador para especificar los roles requeridos para acceder a un endpoint
 * @param roles - Array de roles permitidos
 * 
 * @example
 * ```typescript
 * @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
 * @Get('admin-only')
 * adminOnlyEndpoint() {
 *   return 'Solo admins y organizadores pueden acceder';
 * }
 * ```
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Decorador para requerir rol de administrador
 */
export const RequireAdmin = () => Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN);

/**
 * Decorador para requerir rol de organizador o superior
 */
export const RequireOrganizer = () => Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.ORGANIZER);

/**
 * Decorador para requerir rol de moderador o superior
 */
export const RequireModerator = () => Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR);

/**
 * Decorador para permitir solo super administradores
 */
export const RequireSuperAdmin = () => Roles(UserRole.SUPER_ADMIN);