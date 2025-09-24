import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BracketsService } from '../brackets/brackets.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ParticipantDto } from './dto/participant.dto';
import { EventStatus } from '@prisma/client';

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private bracketsService: BracketsService
  ) {}

  async createEvent(createEventDto: CreateEventDto) {
    try {
      // Verificar que el torneo existe
      const tournament = await this.prisma.tournament.findUnique({
        where: { id: createEventDto.tournamentId }
      });

      if (!tournament) {
        throw new NotFoundException(`Torneo con ID ${createEventDto.tournamentId} no encontrado`);
      }

      const event = await this.prisma.event.create({
        data: {
          name: createEventDto.name,
          slug: createEventDto.slug,
          game: createEventDto.game,
          format: createEventDto.format,
          type: createEventDto.type,
          status: createEventDto.status || EventStatus.UPCOMING,
          bracketType: createEventDto.bracketType || 'SINGLE_ELIMINATION',
          startingPhase: createEventDto.startingPhase,
          startDate: new Date(createEventDto.startDate),
          endDate: createEventDto.endDate ? new Date(createEventDto.endDate) : null,
          maxEntrants: createEventDto.maxEntrants,
          entryFee: createEventDto.entryFee,
          tournamentId: createEventDto.tournamentId
        }
      });
      return event;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Error al crear el evento: ' + error.message);
    }
  }

  async getAllEvents(tournamentId?: string) {
    try {
      const where = tournamentId ? { tournamentId } : {};
      
      const events = await this.prisma.event.findMany({
        where,
        include: {
          tournament: true,
          participants: true,
          phases: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return events;
    } catch (error) {
      throw new BadRequestException('Error al obtener eventos: ' + error.message);
    }
  }

  async getEventById(id: string) {
    try {
      const event = await this.prisma.event.findUnique({
        where: { id },
        include: {
          tournament: true,
          participants: true,
          phases: {
            include: {
              groups: {
                include: {
                  sets: true
                }
              }
            }
          }
        }
      });

      if (!event) {
        throw new NotFoundException(`Evento con ID ${id} no encontrado`);
      }

      return event;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Error al obtener el evento: ' + error.message);
    }
  }

  async updateEvent(id: string, updateEventDto: UpdateEventDto) {
    try {
      const updateData: any = {};
      
      // Copiar campos y convertir fechas si están presentes
      Object.keys(updateEventDto).forEach(key => {
        const value = updateEventDto[key];
        if (value !== undefined) {
          if (key === 'startDate' || key === 'endDate') {
            updateData[key] = new Date(value);
          } else {
            updateData[key] = value;
          }
        }
      });

      const event = await this.prisma.event.update({
        where: { id },
        data: updateData
      });
      return event;
    } catch (error) {
      throw new BadRequestException('Error al actualizar el evento: ' + error.message);
    }
  }

  async deleteEvent(id: string) {
    try {
      await this.prisma.event.delete({
        where: { id }
      });
      return { message: 'Evento eliminado exitosamente' };
    } catch (error) {
      throw new BadRequestException('Error al eliminar el evento: ' + error.message);
    }
  }

  async startEvent(id: string) {
    try {
      const event = await this.prisma.event.findUnique({
        where: { id },
        include: {
          participants: true,
          phases: true
        }
      });

      if (!event) {
        throw new NotFoundException(`Evento con ID ${id} no encontrado`);
      }

      if (event.status === EventStatus.ACTIVE || event.status === EventStatus.COMPLETED) {
        throw new BadRequestException('El evento ya ha sido iniciado o completado');
      }

      if (event.participants.length < 2) {
        throw new BadRequestException('Se necesitan al menos 2 participantes para iniciar el evento');
      }

      // Generar el bracket usando el servicio de brackets
      const bracket = await this.bracketsService.createBracket({
        name: `${event.name} - Bracket`,
        type: 'single_elimination',
        participants: event.participants.map(p => p.participantId),
        seeding: 'natural'
      });

      // Actualizar el estado del evento
      const updatedEvent = await this.prisma.event.update({
        where: { id },
        data: {
          status: EventStatus.ACTIVE
        },
        include: {
          participants: true,
          phases: {
            include: {
              groups: {
                include: {
                  sets: true
                }
              }
            }
          }
        }
      });

      return {
        event: updatedEvent,
        bracket: bracket
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error al iniciar el evento: ' + error.message);
    }
  }

  async getEventParticipants(id: string) {
    try {
      const event = await this.prisma.event.findUnique({
        where: { id },
        include: {
          participants: true
        }
      });

      if (!event) {
        throw new NotFoundException(`Evento con ID ${id} no encontrado`);
      }

      return event.participants;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Error al obtener participantes del evento: ' + error.message);
    }
  }

  async addParticipant(eventId: string, participantDto: ParticipantDto) {
    try {
      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
        include: { participants: true }
      });

      if (!event) {
        throw new NotFoundException(`Evento con ID ${eventId} no encontrado`);
      }

      if (event.maxEntrants && event.participants.length >= event.maxEntrants) {
        throw new BadRequestException('El evento ha alcanzado el máximo de participantes');
      }

      if (event.status !== 'UPCOMING') {
        throw new BadRequestException('No se pueden agregar participantes a un evento que ya ha iniciado');
      }

      // Primero crear o encontrar el TournamentParticipant
      let tournamentParticipant = await this.prisma.tournamentParticipant.findUnique({
        where: {
          userId_tournamentId: {
            userId: participantDto.userId,
            tournamentId: event.tournamentId
          }
        }
      });

      if (!tournamentParticipant) {
        tournamentParticipant = await this.prisma.tournamentParticipant.create({
          data: {
            userId: participantDto.userId,
            tournamentId: event.tournamentId
          }
        });
      }

      // Luego crear el EventParticipant
      const participant = await this.prisma.eventParticipant.create({
        data: {
          eventId: eventId,
          participantId: tournamentParticipant.id
        }
      });

      return participant;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error al agregar participante: ' + error.message);
    }
  }

  async getEventBracket(id: string) {
    try {
      const event = await this.prisma.event.findUnique({
        where: { id },
        include: {
          phases: {
            include: {
              groups: {
                include: {
                  sets: true
                }
              }
            }
          }
        }
      });

      if (!event) {
        throw new NotFoundException(`Evento con ID ${id} no encontrado`);
      }

      return event.phases;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Error al obtener el bracket del evento: ' + error.message);
    }
  }
}
