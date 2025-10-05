import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  ParseIntPipe,
  HttpStatus,
  HttpCode,
  Query,
  Patch,
  UseGuards,
  ValidationPipe,
  BadRequestException
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TournamentsService } from './tournaments.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';

@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  /**
   * Crear un nuevo torneo
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createTournament(@Body(ValidationPipe) createTournamentDto: CreateTournamentDto) {
    try {
      return await this.tournamentsService.createTournament(createTournamentDto);
    } catch (error) {
      throw new BadRequestException(`Error creating tournament: ${error.message}`);
    }
  }

  /**
   * Obtener todos los torneos con paginación y filtros
   */
  @Get()
  async getAllTournaments(
    @Query('page') page?: string, 
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('game') game?: string,
    @Query('search') search?: string
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    
    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      throw new BadRequestException('Invalid pagination parameters');
    }

    return await this.tournamentsService.findAll({
      page: pageNum,
      limit: limitNum,
      status,
      game,
      search
    });
  }

  /**
   * Obtener un torneo por ID
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Tournament ID is required');
    }
    return await this.tournamentsService.findOne(id);
  }

  /**
   * Actualizar un torneo
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id') id: string, @Body(ValidationPipe) updateTournamentDto: UpdateTournamentDto) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Tournament ID is required');
    }
    try {
      return await this.tournamentsService.update(id, updateTournamentDto);
    } catch (error) {
      throw new BadRequestException(`Error updating tournament: ${error.message}`);
    }
  }

  /**
   * Eliminar un torneo
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Tournament ID is required');
    }
    try {
      return await this.tournamentsService.remove(id);
    } catch (error) {
      throw new BadRequestException(`Error deleting tournament: ${error.message}`);
    }
  }

  /**
   * Obtener eventos de un torneo
   */
  @Get(':id/events')
  async getTournamentEvents(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Tournament ID is required');
    }
    return await this.tournamentsService.getTournamentEvents(id);
  }

  /**
   * Obtener participantes de un torneo
   */
  @Get(':id/participants')
  async getTournamentParticipants(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Tournament ID is required');
    }
    return await this.tournamentsService.getTournamentParticipants(id);
  }

  /**
   * Inscribir participante en un torneo
   */
  @Post(':id/participants')
  @UseGuards(JwtAuthGuard)
  async addParticipant(@Param('id') id: string, @Body() participantDto: { userId: string }) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Tournament ID is required');
    }
    if (!participantDto.userId || participantDto.userId.trim() === '') {
      throw new BadRequestException('User ID is required');
    }
    try {
      return await this.tournamentsService.addParticipant(id, participantDto.userId);
    } catch (error) {
      throw new BadRequestException(`Error adding participant: ${error.message}`);
    }
  }

  /**
   * Iniciar un torneo
   */
  @Post(':id/start')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async startTournament(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Tournament ID is required');
    }
    try {
      return await this.tournamentsService.startTournament(id);
    } catch (error) {
      throw new BadRequestException(`Error starting tournament: ${error.message}`);
    }
  }

  /**
   * Obtener el bracket de un torneo
   */
  @Get(':id/bracket')
  async getTournamentBracket(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Tournament ID is required');
    }
    try {
      return await this.tournamentsService.getTournamentBracket(id);
    } catch (error) {
      throw new BadRequestException(`Error getting tournament bracket: ${error.message}`);
    }
  }

  /**
   * Sincronizar torneo con Start.gg
   */
  @Post(':id/sync-startgg')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async syncWithStartgg(@Param('id') id: string, @Body() syncDto: { startggSlug: string }) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Tournament ID is required');
    }
    if (!syncDto.startggSlug || syncDto.startggSlug.trim() === '') {
      throw new BadRequestException('Start.gg slug is required');
    }
    try {
      return await this.tournamentsService.syncWithStartgg(id, syncDto.startggSlug);
    } catch (error) {
      throw new BadRequestException(`Error syncing with Start.gg: ${error.message}`);
    }
  }

  /**
   * Buscar torneos en Start.gg
   */
  @Get('startgg/search')
  async searchStartggTournaments(
    @Query('query') query: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    if (!query || query.trim() === '') {
      throw new BadRequestException('Search query is required');
    }
    
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 20;
    
    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      throw new BadRequestException('Invalid pagination parameters');
    }

    try {
      return await this.tournamentsService.searchStartggTournaments(query, pageNum, limitNum);
    } catch (error) {
      throw new BadRequestException(`Error searching Start.gg tournaments: ${error.message}`);
    }
  }

  /**
   * Importar torneo desde Start.gg
   */
  @Post('startgg/import')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async importFromStartgg(@Body() importDto: { startggSlug: string; organizerId: string }) {
    if (!importDto.startggSlug || importDto.startggSlug.trim() === '') {
      throw new BadRequestException('Start.gg slug is required');
    }
    if (!importDto.organizerId || importDto.organizerId.trim() === '') {
      throw new BadRequestException('Organizer ID is required');
    }
    try {
      return await this.tournamentsService.importFromStartgg(importDto.startggSlug, importDto.organizerId);
    } catch (error) {
      throw new BadRequestException(`Error importing from Start.gg: ${error.message}`);
    }
  }
}
