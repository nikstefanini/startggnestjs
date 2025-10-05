import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsOptional, IsString, MaxLength, IsEnum, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { UserRole } from '../../common/enums/user-role.enum';

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['email', 'password'] as const)
) {
  @ApiPropertyOptional({
    description: 'Nombre de usuario único',
    example: 'nuevoUsername'
  })
  @IsOptional()
  @IsString({ message: 'El username debe ser una cadena de texto' })
  @MaxLength(50, { message: 'El username no puede tener más de 50 caracteres' })
  username?: string;

  @ApiPropertyOptional({
    description: 'Nombre del usuario',
    example: 'Juan Carlos'
  })
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @MaxLength(100, { message: 'El nombre no puede tener más de 100 caracteres' })
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Apellido del usuario',
    example: 'García López'
  })
  @IsOptional()
  @IsString({ message: 'El apellido debe ser una cadena de texto' })
  @MaxLength(100, { message: 'El apellido no puede tener más de 100 caracteres' })
  lastName?: string;

  @ApiPropertyOptional({
    description: 'URL del avatar del usuario',
    example: 'https://example.com/nuevo-avatar.jpg'
  })
  @IsOptional()
  @IsString({ message: 'El avatar debe ser una cadena de texto' })
  @MaxLength(500, { message: 'La URL del avatar no puede tener más de 500 caracteres' })
  avatar?: string;

  @ApiPropertyOptional({
    description: 'Biografía actualizada del usuario'
  })
  @IsOptional()
  @IsString({ message: 'La biografía debe ser una cadena de texto' })
  bio?: string;

  @ApiPropertyOptional({
    description: 'País del usuario',
    example: 'España'
  })
  @IsOptional()
  @IsString({ message: 'El país debe ser una cadena de texto' })
  @MaxLength(100, { message: 'El país no puede tener más de 100 caracteres' })
  country?: string;

  @ApiPropertyOptional({
    description: 'Zona horaria del usuario',
    example: 'Europe/Madrid'
  })
  @IsOptional()
  @IsString({ message: 'La zona horaria debe ser una cadena de texto' })
  @MaxLength(50, { message: 'La zona horaria no puede tener más de 50 caracteres' })
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Rol del usuario en el sistema',
    enum: UserRole
  })
  @IsOptional()
  @IsEnum(UserRole, { message: 'El rol debe ser un valor válido' })
  role?: UserRole;

  @ApiPropertyOptional({
    description: 'Si el usuario está verificado'
  })
  @IsOptional()
  @IsBoolean({ message: 'isVerified debe ser un valor booleano' })
  isVerified?: boolean;

  @ApiPropertyOptional({
    description: 'Si el usuario está activo'
  })
  @IsOptional()
  @IsBoolean({ message: 'isActive debe ser un valor booleano' })
  isActive?: boolean;
}

export class ChangePasswordDto {
  @ApiPropertyOptional({
    description: 'Contraseña actual del usuario'
  })
  @IsString({ message: 'La contraseña actual debe ser una cadena de texto' })
  currentPassword: string;

  @ApiPropertyOptional({
    description: 'Nueva contraseña del usuario',
    minLength: 6
  })
  @IsString({ message: 'La nueva contraseña debe ser una cadena de texto' })
  newPassword: string;
}