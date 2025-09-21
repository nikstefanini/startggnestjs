import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString({ message: 'El email o nombre de usuario debe ser una cadena de texto' })
  @MinLength(3, { message: 'El email o nombre de usuario debe tener al menos 3 caracteres' })
  emailOrUsername: string;

  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;
}