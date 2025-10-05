import { IsEmail, IsString, IsOptional, MinLength, MaxLength, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../common/enums/user-role.enum';

export class CreateUserDto {
  @ApiProperty({
    description: 'Email único del usuario',
    example: 'usuario@example.com'
  })
  @IsEmail({}, { message: 'Debe ser un email válido' })
  email: string;

  @ApiProperty({
    description: 'Nombre de usuario único',
    example: 'jugador123',
    minLength: 3,
    maxLength: 50
  })
  @IsString({ message: 'El username debe ser una cadena de texto' })
  @MinLength(3, { message: 'El username debe tener al menos 3 caracteres' })
  @MaxLength(50, { message: 'El username no puede tener más de 50 caracteres' })
  username: string;

  @ApiProperty({
    description: 'Contraseña del usuario',
    example: 'MiContraseñaSegura123',
    minLength: 6
  })
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;

  @ApiPropertyOptional({
    description: 'Nombre del usuario',
    example: 'Juan'
  })
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @MaxLength(100, { message: 'El nombre no puede tener más de 100 caracteres' })
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Apellido del usuario',
    example: 'Pérez'
  })
  @IsOptional()
  @IsString({ message: 'El apellido debe ser una cadena de texto' })
  @MaxLength(100, { message: 'El apellido no puede tener más de 100 caracteres' })
  lastName?: string;

  @ApiPropertyOptional({
    description: 'URL del avatar del usuario',
    example: 'https://example.com/avatar.jpg'
  })
  @IsOptional()
  @IsString({ message: 'El avatar debe ser una cadena de texto' })
  @MaxLength(500, { message: 'La URL del avatar no puede tener más de 500 caracteres' })
  avatar?: string;

  @ApiPropertyOptional({
    description: 'Biografía del usuario',
    example: 'Jugador competitivo de Street Fighter'
  })
  @IsOptional()
  @IsString({ message: 'La biografía debe ser una cadena de texto' })
  bio?: string;

  @ApiPropertyOptional({
    description: 'País del usuario',
    example: 'México'
  })
  @IsOptional()
  @IsString({ message: 'El país debe ser una cadena de texto' })
  @MaxLength(100, { message: 'El país no puede tener más de 100 caracteres' })
  country?: string;

  @ApiPropertyOptional({
    description: 'Zona horaria del usuario',
    example: 'America/Mexico_City'
  })
  @IsOptional()
  @IsString({ message: 'La zona horaria debe ser una cadena de texto' })
  @MaxLength(50, { message: 'La zona horaria no puede tener más de 50 caracteres' })
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Rol del usuario en el sistema',
    enum: UserRole,
    default: UserRole.USER
  })
  @IsOptional()
  @IsEnum(UserRole, { message: 'El rol debe ser un valor válido' })
  role?: UserRole;

  @ApiPropertyOptional({
    description: 'Si el usuario está verificado',
    default: false
  })
  @IsOptional()
  @IsBoolean({ message: 'isVerified debe ser un valor booleano' })
  isVerified?: boolean;

  @ApiPropertyOptional({
    description: 'Si el usuario está activo',
    default: true
  })
  @IsOptional()
  @IsBoolean({ message: 'isActive debe ser un valor booleano' })
  isActive?: boolean;
}