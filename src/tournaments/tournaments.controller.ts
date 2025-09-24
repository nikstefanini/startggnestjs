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
  Patch
} from '@nestjs/common';
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
  @HttpCode(HttpStatus.CREATED)
  async createTournament(@Body() createTournamentDto: CreateTournamentDto) {
    return await this.tournamentsService.createTournament(createTournamentDto);
  }

  /**
   * Obtener todos los torneos
   */
  @Get()
  async getAllTournaments(@Query('page') page?: string, @Query('limit') limit?: string) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    return await this.tournamentsService.findAll();
  }

  /**
   * Obtener un torneo por ID
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tournamentsService.findOne(id);
  }

  /**
   * Actualizar un torneo
   */
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTournamentDto: UpdateTournamentDto) {
    return this.tournamentsService.update(id, updateTournamentDto);
  }

  /**
   * Eliminar un torneo
   */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tournamentsService.remove(id);
  }

  /**
   * Obtener eventos de un torneo
   */
  @Get(':id/events')
  getTournamentEvents(@Param('id') id: string) {
    return this.tournamentsService.getTournamentEvents(id);
  }

  /**
   * Obtener participantes de un torneo
   */
  @Get(':id/participants')
  getTournamentParticipants(@Param('id') id: string) {
    return this.tournamentsService.getTournamentParticipants(id);
  }

  /**
   * Inscribir participante en un torneo
   */
  @Post(':id/participants')
  addParticipant(@Param('id') id: string, @Body() participantDto: { userId: string }) {
    return this.tournamentsService.addParticipant(id, participantDto.userId);
  }
}
