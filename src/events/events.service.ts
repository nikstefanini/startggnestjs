import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { BracketsService } from '../brackets/brackets.service';
import { StartggService } from '../startgg/startgg.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ParticipantDto } from './dto/participant.dto';
import { EventStatus, PhaseType, BracketType, SetStatus } from '@prisma/client';

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private bracketsService: BracketsService,
    private startggService: StartggService
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

  async getAllEvents(tournamentId?: string, page: number = 1, limit: number = 20, status?: string) {
    try {
      const where: any = {};
      
      if (tournamentId) {
        where.tournamentId = tournamentId;
      }
      
      if (status) {
        where.status = status;
      }
      
      const skip = (page - 1) * limit;
      
      const [events, total] = await Promise.all([
        this.prisma.event.findMany({
          where,
          include: {
            tournament: true,
            participants: true,
            phases: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          skip,
          take: limit
        }),
        this.prisma.event.count({ where })
      ]);

      return {
        events,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
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

  /**
   * Obtener sets/matches de un evento con paginación
   */
  async getEventSets(eventId: string, page: number = 1, limit: number = 20, status?: string) {
    try {
      const event = await this.prisma.event.findUnique({
        where: { id: eventId }
      });

      if (!event) {
        throw new NotFoundException(`Evento con ID ${eventId} no encontrado`);
      }

      const where: any = {
        phase: {
          eventId: eventId
        }
      };

      if (status) {
        where.status = status;
      }

      const skip = (page - 1) * limit;

      const [sets, total] = await Promise.all([
        this.prisma.set.findMany({
          where,
          include: {
            phaseGroup: {
              include: {
                phase: true
              }
            },
            player1: true,
            player2: true,
            games: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          skip,
          take: limit
        }),
        this.prisma.set.count({ where })
      ]);

      return {
        sets,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Error al obtener sets del evento: ' + error.message);
    }
  }

  /**
   * Actualizar resultado de un set/match
   */
  async updateSetResult(eventId: string, setId: string, resultDto: { winnerId: string; score: string; status: string }) {
    try {
      const event = await this.prisma.event.findUnique({
        where: { id: eventId }
      });

      if (!event) {
        throw new NotFoundException(`Evento con ID ${eventId} no encontrado`);
      }

      const set = await this.prisma.set.findUnique({
        where: { id: setId },
        include: {
          phaseGroup: {
            include: {
              phase: {
                include: {
                  event: true
                }
              }
            }
          },
          player1: true,
          player2: true
        }
      });

      if (!set) {
        throw new NotFoundException(`Set con ID ${setId} no encontrado`);
      }

      if (set.phaseGroup.phase.event.id !== eventId) {
        throw new BadRequestException('El set no pertenece al evento especificado');
      }

      // Verificar que el winnerId es válido
      const validWinner = set.player1Id === resultDto.winnerId || set.player2Id === resultDto.winnerId;
      if (!validWinner) {
        throw new BadRequestException('El ganador especificado no es válido para este set');
      }

      const updatedSet = await this.prisma.set.update({
        where: { id: setId },
        data: {
          winnerId: resultDto.winnerId,
          // Parseamos el score para extraer los puntajes individuales
          player1Score: parseInt(resultDto.score.split('-')[0]) || 0,
          player2Score: parseInt(resultDto.score.split('-')[1]) || 0,
          status: resultDto.status as SetStatus,
          completedAt: new Date()
        },
        include: {
          player1: true,
          player2: true,
          games: true
        }
      });

      return updatedSet;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error al actualizar resultado del set: ' + error.message);
    }
  }

  /**
   * Obtener standings/clasificación de un evento
   */
  async getEventStandings(eventId: string) {
    try {
      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
        include: {
          participants: {
            include: {
              participant: true
            }
          },
          phases: {
            include: {
              groups: {
                include: {
                  sets: {
                    include: {
                      player1: true,
                      player2: true,
                      games: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!event) {
        throw new NotFoundException(`Evento con ID ${eventId} no encontrado`);
      }

      // Calcular standings basado en wins/losses
      const standings = event.participants.map(eventParticipant => {
        let wins = 0;
        let losses = 0;
        let setsPlayed = 0;

        event.phases.forEach(phase => {
          phase.groups.forEach(group => {
            group.sets.forEach(set => {
              const isPlayer1 = set.player1Id === eventParticipant.participantId;
              const isPlayer2 = set.player2Id === eventParticipant.participantId;
              
              if ((isPlayer1 || isPlayer2) && set.status === 'COMPLETED') {
                setsPlayed++;
                if (set.winnerId === eventParticipant.participantId) {
                  wins++;
                } else {
                  losses++;
                }
              }
            });
          });
        });

        return {
          participant: eventParticipant.participant,
          wins,
          losses,
          setsPlayed,
          winRate: setsPlayed > 0 ? (wins / setsPlayed) * 100 : 0
        };
      });

      // Ordenar por wins descendente, luego por win rate
      standings.sort((a, b) => {
        if (a.wins !== b.wins) {
          return b.wins - a.wins;
        }
        return b.winRate - a.winRate;
      });

      return standings;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Error al obtener standings del evento: ' + error.message);
    }
  }

  /**
   * Sincronizar evento con Start.gg
   */
  async syncWithStartgg(eventId: string, startggEventId: string) {
    try {
      const event = await this.prisma.event.findUnique({
        where: { id: eventId }
      });

      if (!event) {
        throw new NotFoundException(`Evento con ID ${eventId} no encontrado`);
      }

      // Obtener datos del evento desde Start.gg
      const startggEventData = await this.startggService.getEvent(startggEventId);

      if (!startggEventData) {
        throw new BadRequestException('No se pudo obtener información del evento desde Start.gg');
      }

      // Actualizar evento local con datos de Start.gg
      const updatedEvent = await this.prisma.event.update({
        where: { id: eventId },
        data: {
          name: startggEventData.name || event.name,
          slug: startggEventData.slug || event.slug,
          game: startggEventData.videogame?.name || event.game,
          startDate: startggEventData.startAt ? new Date(startggEventData.startAt * 1000) : event.startDate,
          endDate: startggEventData.startAt ? new Date(startggEventData.startAt * 1000) : event.endDate,
          maxEntrants: startggEventData.numEntrants || event.maxEntrants,
          // Agregar campo para almacenar ID de Start.gg si no existe
          // startggEventId: startggEventId
        }
      });

      return {
        event: updatedEvent,
        startggData: startggEventData
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error al sincronizar con Start.gg: ' + error.message);
    }
  }

  /**
   * Obtener fases de un evento
   */
  async getEventPhases(eventId: string) {
    try {
      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
        include: {
          phases: {
            include: {
              groups: {
                include: {
                  sets: {
                    include: {
                      player1: true,
                      player2: true,
                      games: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!event) {
        throw new NotFoundException(`Evento con ID ${eventId} no encontrado`);
      }

      return event.phases;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Error al obtener fases del evento: ' + error.message);
    }
  }

  /**
   * Crear una nueva fase en un evento
   */
  async createEventPhase(eventId: string, phaseDto: { name: string; type: PhaseType; bracketType: BracketType }) {
    try {
      const event = await this.prisma.event.findUnique({
        where: { id: eventId }
      });

      if (!event) {
        throw new NotFoundException(`Evento con ID ${eventId} no encontrado`);
      }

      const phase = await this.prisma.phase.create({
        data: {
          name: phaseDto.name,
          type: phaseDto.type,
          bracketType: phaseDto.bracketType,
          order: 1,
          event: {
            connect: { id: eventId }
          }
        }
      });

      return phase;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Error al crear fase del evento: ' + error.message);
    }
  }
}
