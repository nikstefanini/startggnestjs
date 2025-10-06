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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createEventDto: CreateEventDto,
    @Request() req: any,
  ) {
    const event = await this.eventsService.create(
      createEventDto,
      req.user.id,
    );
    
    return {
      success: true,
      message: 'Evento creado exitosamente',
      data: event,
    };
  }

  @Get()
  async findAll(@Query('tournamentId') tournamentId?: string) {
    const events = await this.eventsService.findAll(tournamentId);
    
    return {
      success: true,
      message: 'Eventos obtenidos exitosamente',
      data: events,
    };
  }

  @Get('tournament/:tournamentId')
  async getEventsByTournament(@Param('tournamentId') tournamentId: string) {
    const events = await this.eventsService.getEventsByTournament(tournamentId);
    
    return {
      success: true,
      message: 'Eventos del torneo obtenidos exitosamente',
      data: events,
    };
  }

  @Get('slug/:tournamentSlug/:eventSlug')
  async findBySlug(
    @Param('tournamentSlug') tournamentSlug: string,
    @Param('eventSlug') eventSlug: string,
  ) {
    const event = await this.eventsService.findBySlug(tournamentSlug, eventSlug);
    
    return {
      success: true,
      message: 'Evento obtenido exitosamente',
      data: event,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const event = await this.eventsService.findOne(id);
    
    return {
      success: true,
      message: 'Evento obtenido exitosamente',
      data: event,
    };
  }

  /**
   * Obtener el bracket del evento (fases/grupos/sets)
   */
  @Get(':id/bracket')
  async getEventBracket(@Param('id') id: string) {
    const phases = await this.eventsService.getEventBracket(id);
    return {
      success: true,
      message: 'Bracket del evento obtenido exitosamente',
      data: phases,
    };
  }

  /**
   * Obtener todos los sets del evento
   */
  @Get(':id/sets')
  async getEventSets(@Param('id') id: string) {
    const sets = await this.eventsService.getEventSets(id);
    return {
      success: true,
      message: 'Sets del evento obtenidos exitosamente',
      data: sets,
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
    @Request() req: any,
  ) {
    const event = await this.eventsService.update(
      id,
      updateEventDto,
      req.user.id,
    );
    
    return {
      success: true,
      message: 'Evento actualizado exitosamente',
      data: event,
    };
  }

  @Post(':id/attend')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async attendEvent(@Param('id') id: string, @Request() req: any) {
    const result = await this.eventsService.attendEvent(id, req.user.id);
    
    return {
      success: true,
      message: 'Te has registrado al evento exitosamente',
      data: result,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @Request() req: any) {
    await this.eventsService.remove(id, req.user.id);
    
    return {
      success: true,
      message: 'Evento eliminado exitosamente',
    };
  }
}