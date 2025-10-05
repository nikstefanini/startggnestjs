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
  UseGuards,
  ValidationPipe,
  BadRequestException
} from '@nestjs/common';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ParticipantDto } from './dto/participant.dto';
import { PhaseType, BracketType } from '@prisma/client';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  /**
   * Crear un nuevo evento
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createEvent(@Body(ValidationPipe) createEventDto: CreateEventDto) {
    try {
      return await this.eventsService.createEvent(createEventDto);
    } catch (error) {
      throw new BadRequestException(`Error creating event: ${error.message}`);
    }
  }

  /**
   * Obtener todos los eventos
   */
  @Get()
  async getAllEvents(
    @Query('tournamentId') tournamentId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 20;
    
    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      throw new BadRequestException('Invalid pagination parameters');
    }

    try {
      return await this.eventsService.getAllEvents(tournamentId, pageNum, limitNum, status);
    } catch (error) {
      throw new BadRequestException(`Error getting events: ${error.message}`);
    }
  }

  /**
   * Obtener un evento por ID
   */
  @Get(':id')
  async getEventById(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Event ID is required');
    }
    try {
      return await this.eventsService.getEventById(id);
    } catch (error) {
      throw new BadRequestException(`Error getting event: ${error.message}`);
    }
  }

  /**
   * Actualizar un evento
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async updateEvent(
    @Param('id') id: string,
    @Body(ValidationPipe) updateEventDto: UpdateEventDto
  ) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Event ID is required');
    }
    try {
      return await this.eventsService.updateEvent(id, updateEventDto);
    } catch (error) {
      throw new BadRequestException(`Error updating event: ${error.message}`);
    }
  }

  /**
   * Eliminar un evento
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteEvent(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Event ID is required');
    }
    try {
      return await this.eventsService.deleteEvent(id);
    } catch (error) {
      throw new BadRequestException(`Error deleting event: ${error.message}`);
    }
  }

  /**
   * Iniciar un evento (generar brackets)
   */
  @Post(':id/start')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async startEvent(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Event ID is required');
    }
    try {
      return await this.eventsService.startEvent(id);
    } catch (error) {
      throw new BadRequestException(`Error starting event: ${error.message}`);
    }
  }

  /**
   * Obtener participantes de un evento
   */
  @Get(':id/participants')
  async getEventParticipants(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Event ID is required');
    }
    try {
      return await this.eventsService.getEventParticipants(id);
    } catch (error) {
      throw new BadRequestException(`Error getting event participants: ${error.message}`);
    }
  }

  /**
   * Inscribir participante en un evento
   */
  @Post(':id/participants')
  @UseGuards(JwtAuthGuard)
  async addParticipant(
    @Param('id') eventId: string,
    @Body() participantDto: { participantId: string }
  ) {
    if (!eventId || eventId.trim() === '') {
      throw new BadRequestException('Event ID is required');
    }
    if (!participantDto.participantId || participantDto.participantId.trim() === '') {
      throw new BadRequestException('Participant ID is required');
    }
    try {
      // Convertir participantId a userId para el DTO
      const dto: ParticipantDto = { userId: participantDto.participantId };
      return await this.eventsService.addParticipant(eventId, dto);
    } catch (error) {
      throw new BadRequestException(`Error adding participant: ${error.message}`);
    }
  }

  /**
   * Obtener el bracket de un evento
   */
  @Get(':id/bracket')
  async getEventBracket(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Event ID is required');
    }
    try {
      return await this.eventsService.getEventBracket(id);
    } catch (error) {
      throw new BadRequestException(`Error getting event bracket: ${error.message}`);
    }
  }

  /**
   * Obtener sets/matches de un evento
   */
  @Get(':id/sets')
  async getEventSets(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string
  ) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Event ID is required');
    }
    
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 20;
    
    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      throw new BadRequestException('Invalid pagination parameters');
    }

    try {
      return await this.eventsService.getEventSets(id, pageNum, limitNum, status);
    } catch (error) {
      throw new BadRequestException(`Error getting event sets: ${error.message}`);
    }
  }

  /**
   * Actualizar resultado de un set/match
   */
  @Put(':eventId/sets/:setId')
  @UseGuards(JwtAuthGuard)
  async updateSetResult(
    @Param('eventId') eventId: string,
    @Param('setId') setId: string,
    @Body() resultDto: { winnerId: string; score: string; status: string }
  ) {
    if (!eventId || eventId.trim() === '') {
      throw new BadRequestException('Event ID is required');
    }
    if (!setId || setId.trim() === '') {
      throw new BadRequestException('Set ID is required');
    }
    if (!resultDto.winnerId || resultDto.winnerId.trim() === '') {
      throw new BadRequestException('Winner ID is required');
    }
    try {
      return await this.eventsService.updateSetResult(eventId, setId, resultDto);
    } catch (error) {
      throw new BadRequestException(`Error updating set result: ${error.message}`);
    }
  }

  /**
   * Obtener standings/clasificación de un evento
   */
  @Get(':id/standings')
  async getEventStandings(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Event ID is required');
    }
    try {
      return await this.eventsService.getEventStandings(id);
    } catch (error) {
      throw new BadRequestException(`Error getting event standings: ${error.message}`);
    }
  }

  /**
   * Sincronizar evento con Start.gg
   */
  @Post(':id/sync-startgg')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async syncWithStartgg(
    @Param('id') id: string,
    @Body() syncDto: { startggEventId: string }
  ) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Event ID is required');
    }
    if (!syncDto.startggEventId || syncDto.startggEventId.trim() === '') {
      throw new BadRequestException('Start.gg Event ID is required');
    }
    try {
      return await this.eventsService.syncWithStartgg(id, syncDto.startggEventId);
    } catch (error) {
      throw new BadRequestException(`Error syncing with Start.gg: ${error.message}`);
    }
  }

  /**
   * Obtener fases de un evento
   */
  @Get(':id/phases')
  async getEventPhases(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('Event ID is required');
    }
    try {
      return await this.eventsService.getEventPhases(id);
    } catch (error) {
      throw new BadRequestException(`Error getting event phases: ${error.message}`);
    }
  }

  /**
   * Crear una nueva fase en un evento
   */
  @Post(':id/phases')
  @UseGuards(JwtAuthGuard)
  async createEventPhase(
    @Param('id') eventId: string,
    @Body() phaseDto: { name: string; type: PhaseType; bracketType: BracketType }
  ) {
    if (!eventId || eventId.trim() === '') {
      throw new BadRequestException('Event ID is required');
    }
    if (!phaseDto.name || phaseDto.name.trim() === '') {
      throw new BadRequestException('Phase name is required');
    }
    try {
      return await this.eventsService.createEventPhase(eventId, phaseDto);
    } catch (error) {
      throw new BadRequestException(`Error creating event phase: ${error.message}`);
    }
  }
}
