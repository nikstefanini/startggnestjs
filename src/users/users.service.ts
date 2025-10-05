import { Injectable, ConflictException, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateUserDto, UpdateUserDto, ChangePasswordDto } from './dto';
import { UserRole } from '../common/enums/user-role.enum';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Crear un nuevo usuario
   */
  async create(createUserDto: CreateUserDto) {
    try {
      // Verificar si el email ya existe
      const existingUserByEmail = await this.prisma.user.findUnique({
        where: { email: createUserDto.email }
      });

      if (existingUserByEmail) {
        throw new ConflictException('El email ya está registrado');
      }

      // Verificar si el username ya existe
      const existingUserByUsername = await this.prisma.user.findUnique({
        where: { username: createUserDto.username }
      });

      if (existingUserByUsername) {
        throw new ConflictException('El nombre de usuario ya está en uso');
      }

      // Hashear la contraseña
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(createUserDto.password, saltRounds);

      // Crear el usuario
      const user = await this.prisma.user.create({
        data: {
          ...createUserDto,
          password: hashedPassword,
          role: createUserDto.role || UserRole.USER
        },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          avatar: true,
          bio: true,
          country: true,
          timezone: true,
          role: true,
          isVerified: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      });

      return user;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException('Error al crear el usuario');
    }
  }

  /**
   * Obtener todos los usuarios con paginación y filtros
   */
  async findAll(page: number = 1, limit: number = 10, role?: UserRole, isActive?: boolean) {
    try {
      const skip = (page - 1) * limit;
      
      const where: any = {};
      if (role) where.role = role;
      if (isActive !== undefined) where.isActive = isActive;

      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          skip,
          take: limit,
          select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
            bio: true,
            country: true,
            timezone: true,
            role: true,
            isVerified: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            lastLogin: true
          },
          orderBy: { createdAt: 'desc' }
        }),
        this.prisma.user.count({ where })
      ]);

      return {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new BadRequestException('Error al obtener los usuarios');
    }
  }

  /**
   * Obtener un usuario por ID
   */
  async findOne(id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          avatar: true,
          bio: true,
          country: true,
          timezone: true,
          role: true,
          isVerified: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          lastLogin: true,
          tournaments: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              startDate: true
            }
          },
          participations: {
            select: {
              id: true,
              status: true,
              tournament: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  status: true
                }
              }
            }
          }
        }
      });

      if (!user) {
        throw new NotFoundException('Usuario no encontrado');
      }

      return user;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Error al obtener el usuario');
    }
  }

  /**
   * Obtener un usuario por email
   */
  async findByEmail(email: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          username: true,
          password: true,
          firstName: true,
          lastName: true,
          role: true,
          isVerified: true,
          isActive: true
        }
      });

      return user;
    } catch (error) {
      throw new BadRequestException('Error al buscar el usuario por email');
    }
  }

  /**
   * Obtener un usuario por username
   */
  async findByUsername(username: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { username },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          avatar: true,
          bio: true,
          country: true,
          timezone: true,
          role: true,
          isVerified: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!user) {
        throw new NotFoundException('Usuario no encontrado');
      }

      return user;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Error al buscar el usuario por username');
    }
  }

  /**
   * Actualizar un usuario
   */
  async update(id: string, updateUserDto: UpdateUserDto, requestingUserId?: string, requestingUserRole?: UserRole) {
    try {
      const existingUser = await this.prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true, isActive: true }
      });

      if (!existingUser) {
        throw new NotFoundException('Usuario no encontrado');
      }

      // Verificar permisos: solo el propio usuario o un admin pueden actualizar
      if (requestingUserId && requestingUserId !== id) {
        if (!requestingUserRole || ![UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(requestingUserRole)) {
          throw new ForbiddenException('No tienes permisos para actualizar este usuario');
        }
      }

      // Si se está actualizando el username, verificar que no exista
      if (updateUserDto.username) {
        const existingUsername = await this.prisma.user.findUnique({
          where: { username: updateUserDto.username }
        });

        if (existingUsername && existingUsername.id !== id) {
          throw new ConflictException('El nombre de usuario ya está en uso');
        }
      }

      // Solo admins pueden cambiar roles
      if (updateUserDto.role && requestingUserRole !== UserRole.SUPER_ADMIN) {
        if (requestingUserRole !== UserRole.ADMIN || updateUserDto.role === UserRole.SUPER_ADMIN) {
          throw new ForbiddenException('No tienes permisos para cambiar roles');
        }
      }

      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: updateUserDto,
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          avatar: true,
          bio: true,
          country: true,
          timezone: true,
          role: true,
          isVerified: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      });

      return updatedUser;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException('Error al actualizar el usuario');
    }
  }

  /**
   * Cambiar contraseña de un usuario
   */
  async changePassword(id: string, changePasswordDto: ChangePasswordDto, requestingUserId?: string) {
    try {
      // Verificar permisos: solo el propio usuario puede cambiar su contraseña
      if (requestingUserId && requestingUserId !== id) {
        throw new ForbiddenException('No puedes cambiar la contraseña de otro usuario');
      }

      const user = await this.prisma.user.findUnique({
        where: { id },
        select: { id: true, password: true }
      });

      if (!user) {
        throw new NotFoundException('Usuario no encontrado');
      }

      // Verificar contraseña actual
      const isCurrentPasswordValid = await bcrypt.compare(changePasswordDto.currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new BadRequestException('La contraseña actual es incorrecta');
      }

      // Hashear nueva contraseña
      const saltRounds = 10;
      const hashedNewPassword = await bcrypt.hash(changePasswordDto.newPassword, saltRounds);

      await this.prisma.user.update({
        where: { id },
        data: { password: hashedNewPassword }
      });

      return { message: 'Contraseña actualizada exitosamente' };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error al cambiar la contraseña');
    }
  }

  /**
   * Eliminar un usuario (soft delete)
   */
  async remove(id: string, requestingUserRole?: UserRole) {
    try {
      // Solo admins pueden eliminar usuarios
      if (!requestingUserRole || ![UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(requestingUserRole)) {
        throw new ForbiddenException('No tienes permisos para eliminar usuarios');
      }

      const user = await this.prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true }
      });

      if (!user) {
        throw new NotFoundException('Usuario no encontrado');
      }

      // Super admins no pueden ser eliminados por admins regulares
      if (user.role === UserRole.SUPER_ADMIN && requestingUserRole !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('No puedes eliminar a un super administrador');
      }

      // Soft delete: marcar como inactivo
      await this.prisma.user.update({
        where: { id },
        data: { isActive: false }
      });

      return { message: 'Usuario eliminado exitosamente' };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException('Error al eliminar el usuario');
    }
  }

  /**
   * Actualizar último login
   */
  async updateLastLogin(id: string) {
    try {
      await this.prisma.user.update({
        where: { id },
        data: { lastLogin: new Date() }
      });
    } catch (error) {
      // No lanzar error si falla la actualización del último login
      console.error('Error updating last login:', error);
    }
  }

  /**
   * Obtener estadísticas de usuarios
   */
  async getStats() {
    try {
      const [total, active, verified, byRole] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { isActive: true } }),
        this.prisma.user.count({ where: { isVerified: true } }),
        this.prisma.user.groupBy({
          by: ['role'],
          _count: { role: true }
        })
      ]);

      const roleStats = byRole.reduce((acc, item) => {
        acc[item.role] = item._count.role;
        return acc;
      }, {} as Record<string, number>);

      return {
        total,
        active,
        verified,
        inactive: total - active,
        unverified: total - verified,
        byRole: roleStats
      };
    } catch (error) {
      throw new BadRequestException('Error al obtener estadísticas de usuarios');
    }
  }
}
