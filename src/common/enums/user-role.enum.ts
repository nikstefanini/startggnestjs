/**
 * Roles de usuario en el sistema Start.gg Clone
 */
export enum UserRole {
  /** Usuario administrador del sistema */
  ADMIN = 'ADMIN',
  
  /** Super administrador con acceso completo */
  SUPER_ADMIN = 'SUPER_ADMIN',
  
  /** Organizador de torneos */
  ORGANIZER = 'ORGANIZER',
  
  /** Usuario regular/jugador */
  USER = 'USER',
  
  /** Moderador de contenido */
  MODERATOR = 'MODERATOR'
}

/**
 * Utilidades para validación de roles
 */
export class RoleUtils {
  /**
   * Verifica si un rol tiene permisos de administración
   */
  static isAdminRole(role: UserRole): boolean {
    return [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR].includes(role);
  }

  /**
   * Verifica si un rol puede organizar torneos
   */
  static canOrganizeTournaments(role: UserRole): boolean {
    return [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.ORGANIZER].includes(role);
  }

  /**
   * Verifica si un rol puede participar en torneos
   */
  static canParticipateInTournaments(role: UserRole): boolean {
    return [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.ORGANIZER, UserRole.USER].includes(role);
  }

  /**
   * Verifica si un rol puede moderar contenido
   */
  static canModerateContent(role: UserRole): boolean {
    return [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR].includes(role);
  }

  /**
   * Obtiene la jerarquía de roles (mayor número = mayor privilegio)
   */
  static getRoleHierarchy(role: UserRole): number {
    const hierarchy = {
      [UserRole.USER]: 1,
      [UserRole.ORGANIZER]: 2,
      [UserRole.MODERATOR]: 3,
      [UserRole.ADMIN]: 4,
      [UserRole.SUPER_ADMIN]: 5
    };
    return hierarchy[role] || 0;
  }

  /**
   * Verifica si un rol tiene mayor o igual jerarquía que otro
   */
  static hasHigherOrEqualRole(userRole: UserRole, requiredRole: UserRole): boolean {
    return this.getRoleHierarchy(userRole) >= this.getRoleHierarchy(requiredRole);
  }
}