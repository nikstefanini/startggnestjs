import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  Query, 
  UseGuards, 
  Request,
  ValidationPipe,
  ParseIntPipe,
  ParseBoolPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, ChangePasswordDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, AdminGuard } from '../common/guards/roles.guard';
import { Roles, RequireAdmin } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequireAdmin()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear un nuevo usuario (solo admins)' })
  @ApiResponse({ status: 201, description: 'Usuario creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 409, description: 'Email o username ya existe' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async create(@Body(ValidationPipe) createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener todos los usuarios con paginación y filtros' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Número de página' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Elementos por página' })
  @ApiQuery({ name: 'role', required: false, enum: UserRole, description: 'Filtrar por rol' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean, description: 'Filtrar por estado activo' })
  @ApiResponse({ status: 200, description: 'Lista de usuarios obtenida exitosamente' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('role') role?: UserRole,
    @Query('isActive', new ParseBoolPipe({ optional: true })) isActive?: boolean
  ) {
    return this.usersService.findAll(page, limit, role, isActive);
  }

  @Get('stats')
  @RequireAdmin()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener estadísticas de usuarios (solo admins)' })
  @ApiResponse({ status: 200, description: 'Estadísticas obtenidas exitosamente' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  async getStats() {
    return this.usersService.getStats();
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil obtenido exitosamente' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async getProfile(@Request() req) {
    return this.usersService.findOne(req.user.id);
  }

  @Get('username/:username')
  @ApiOperation({ summary: 'Obtener usuario por username (público)' })
  @ApiResponse({ status: 200, description: 'Usuario encontrado' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async findByUsername(@Param('username') username: string) {
    return this.usersService.findByUsername(username);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener usuario por ID' })
  @ApiResponse({ status: 200, description: 'Usuario encontrado' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar perfil del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil actualizado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 409, description: 'Username ya existe' })
  async updateProfile(
    @Request() req,
    @Body(ValidationPipe) updateUserDto: UpdateUserDto
  ) {
    return this.usersService.update(req.user.id, updateUserDto, req.user.id, req.user.role);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar usuario por ID (solo admins)' })
  @ApiResponse({ status: 200, description: 'Usuario actualizado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  @ApiResponse({ status: 409, description: 'Username ya existe' })
  async update(
    @Param('id') id: string,
    @Body(ValidationPipe) updateUserDto: UpdateUserDto,
    @Request() req
  ) {
    return this.usersService.update(id, updateUserDto, req.user.id, req.user.role);
  }

  @Patch(':id/password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cambiar contraseña de usuario' })
  @ApiResponse({ status: 200, description: 'Contraseña actualizada exitosamente' })
  @ApiResponse({ status: 400, description: 'Contraseña actual incorrecta o datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No puedes cambiar la contraseña de otro usuario' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async changePassword(
    @Param('id') id: string,
    @Body(ValidationPipe) changePasswordDto: ChangePasswordDto,
    @Request() req
  ) {
    return this.usersService.changePassword(id, changePasswordDto, req.user.id);
  }

  @Delete(':id')
  @RequireAdmin()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar usuario (soft delete, solo admins)' })
  @ApiResponse({ status: 200, description: 'Usuario eliminado exitosamente' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async remove(@Param('id') id: string, @Request() req) {
    return this.usersService.remove(id, req.user.role);
  }
}
