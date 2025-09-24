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
  Query
} from '@nestjs/common';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  /**
   * Crear un nuevo evento
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createEvent(@Body() createEventDto: any) {
    return await this.eventsService.createEvent(createEventDto);
  }

  /**
   * Obtener todos los eventos
   */
  @Get()
  async getAllEvents(@Query('tournamentId') tournamentId?: string) {
    return await this.eventsService.getAllEvents(tournamentId);
  }

  /**
   * Obtener un evento por ID
   */
  @Get(':id')
  async getEventById(@Param('id') id: string) {
    return await this.eventsService.getEventById(id);
  }

  /**
   * Actualizar un evento
   */
  @Put(':id')
  async updateEvent(
    @Param('id') id: string,
    @Body() updateEventDto: any
  ) {
    return await this.eventsService.updateEvent(id, updateEventDto);
  }

  /**
   * Eliminar un evento
   */
  @Delete(':id')
  async deleteEvent(@Param('id') id: string) {
    return await this.eventsService.deleteEvent(id);
  }

  /**
   * Iniciar un evento (generar brackets)
   */
  @Post(':id/start')
  async startEvent(@Param('id') id: string) {
    return await this.eventsService.startEvent(id);
  }

  /**
   * Obtener participantes de un evento
   */
  @Get(':id/participants')
  async getEventParticipants(@Param('id') id: string) {
    return await this.eventsService.getEventParticipants(id);
  }

  /**
   * Inscribir participante en un evento
   */
  @Post(':id/participants')
  async addParticipant(
    @Param('id') eventId: string,
    @Body() participantDto: any
  ) {
    return await this.eventsService.addParticipant(eventId, participantDto);
  }

  /**
   * Obtener el bracket de un evento
   */
  @Get(':id/bracket')
  async getEventBracket(@Param('id') id: string) {
    return await this.eventsService.getEventBracket(id);
  }
}
