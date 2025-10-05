import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { ParticipantDto } from './dto/participant.dto';
import { TournamentStatus, TournamentType, TournamentFormat } from '@prisma/client';
import { BracketsService } from '../brackets/brackets.service';
import { StartggService } from '../startgg/startgg.service';

// Extensión para generar hash de strings
declare global {
  interface String {
    hashCode(): number;
  }
}

String.prototype.hashCode = function(): number {
  let hash = 0;
  if (this.length === 0) return hash;
  for (let i = 0; i < this.length; i++) {
    const char = this.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
};

@Injectable()
export class TournamentsService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => BracketsService))
    private bracketsService: BracketsService,
    private startggService: StartggService,
  ) {}

  async createTournament(createTournamentDto: CreateTournamentDto) {
    try {
      const tournament = await this.prisma.tournament.create({
        data: {
          name: createTournamentDto.name,
          slug: createTournamentDto.slug,
          description: createTournamentDto.description,
          game: createTournamentDto.game,
          format: createTournamentDto.format,
          type: createTournamentDto.type,
          status: createTournamentDto.status || TournamentStatus.UPCOMING,
          startDate: new Date(createTournamentDto.startDate),
          endDate: createTournamentDto.endDate ? new Date(createTournamentDto.endDate) : null,
          registrationOpen: createTournamentDto.registrationOpen || false,
          registrationStart: createTournamentDto.registrationStart ? new Date(createTournamentDto.registrationStart) : null,
          registrationEnd: createTournamentDto.registrationEnd ? new Date(createTournamentDto.registrationEnd) : null,
          maxParticipants: createTournamentDto.maxParticipants,
          entryFee: createTournamentDto.entryFee,
          venue: createTournamentDto.venue,
          address: createTournamentDto.address,
          city: createTournamentDto.city,
          country: createTournamentDto.country,
          timezone: createTournamentDto.timezone,
          isOnline: createTournamentDto.isOnline || false,
          isPublic: createTournamentDto.isPublic !== false,
          organizerId: createTournamentDto.organizerId
        }
      });
      return tournament;
    } catch (error) {
      throw new BadRequestException('Error al crear el torneo: ' + error.message);
    }
  }

  async findAll(params?: { page?: number; limit?: number; status?: string; game?: string; search?: string }) {
    const page = params?.page && params.page > 0 ? params.page : 1;
    const limit = params?.limit && params.limit > 0 && params.limit <= 100 ? params.limit : 10;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params?.status) {
      // Validar y asignar estado si coincide con el enum
      const statuses = Object.values(TournamentStatus);
      if (statuses.includes(params.status as TournamentStatus)) {
        where.status = params.status as TournamentStatus;
      }
    }

    if (params?.game) {
      where.game = params.game;
    }

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { slug: { contains: params.search, mode: 'insensitive' } },
        { city: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.tournament.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startDate: 'desc' },
        include: {
          organizer: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
          events: true,
          participants: true,
        },
      }),
      this.prisma.tournament.count({ where }),
    ]);

    return {
      success: true,
      data: items,
      pagination: {
        page,
        limit,
        total,
      },
    };
  }

  async findOne(id: string) {
    return this.prisma.tournament.findUnique({
      where: { id },
      include: {
        organizer: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        events: true,
        participants: true,
      },
    });
  }

  async update(id: string, updateTournamentDto: UpdateTournamentDto) {
    try {
      const updateData: any = {};
       
       // Copiar campos y convertir fechas si están presentes
       Object.keys(updateTournamentDto).forEach(key => {
         const value = updateTournamentDto[key];
         if (value !== undefined) {
           if (key === 'startDate' || key === 'endDate' || key === 'registrationStart' || key === 'registrationEnd') {
             updateData[key] = new Date(value);
           } else {
             updateData[key] = value;
           }
         }
       });

      const tournament = await this.prisma.tournament.update({
          where: { id },
          data: updateData,
          include: {
            events: true,
            participants: true
          }
        });

      return tournament;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Torneo con ID ${id} no encontrado`);
      }
      throw new BadRequestException('Error al actualizar el torneo: ' + error.message);
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.tournament.delete({
        where: { id }
      });

      return { message: `Torneo con ID ${id} eliminado exitosamente` };
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Torneo con ID ${id} no encontrado`);
      }
      throw new BadRequestException('Error al eliminar el torneo: ' + error.message);
    }
  }

  async getTournamentEvents(tournamentId: string) {
    try {
      const tournament = await this.prisma.tournament.findUnique({
        where: { id: tournamentId },
        include: {
          events: {
            include: {
              participants: true,
              phases: true
            }
          }
        }
      });

      if (!tournament) {
        throw new NotFoundException(`Torneo con ID ${tournamentId} no encontrado`);
      }

      return tournament.events;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Error al obtener eventos del torneo: ' + error.message);
    }
  }

  async addParticipant(tournamentId: string, userId: string) {
    try {
      // Verificar que el torneo existe
      const tournament = await this.prisma.tournament.findUnique({
        where: { id: tournamentId },
        include: { participants: true }
      });

      if (!tournament) {
        throw new NotFoundException(`Torneo con ID ${tournamentId} no encontrado`);
      }

      // Verificar límite de participantes
      if (tournament.maxParticipants && tournament.participants.length >= tournament.maxParticipants) {
        throw new BadRequestException('El torneo ha alcanzado el límite máximo de participantes');
      }

      const participant = await this.prisma.tournamentParticipant.create({
        data: {
          userId,
          tournamentId,
          registeredAt: new Date()
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              avatar: true
            }
          }
        }
      });

      return participant;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error al inscribir participante: ' + error.message);
    }
  }

  async getTournamentParticipants(tournamentId: string) {
    try {
      const tournament = await this.prisma.tournament.findUnique({
        where: { id: tournamentId },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  firstName: true,
                  lastName: true,
                  avatar: true
                }
              }
            }
          }
        }
      });

      if (!tournament) {
        throw new NotFoundException(`Torneo con ID ${tournamentId} no encontrado`);
      }

      return tournament.participants;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Error al obtener participantes del torneo: ' + error.message);
    }
  }

  async startTournament(id: string) {
    try {
      // Verificar que el torneo existe
      const tournament = await this.prisma.tournament.findUnique({
        where: { id },
        include: {
          participants: true
        }
      });

      if (!tournament) {
        throw new NotFoundException(`Torneo con ID ${id} no encontrado`);
      }

      // Verificar que el torneo no esté ya iniciado
      if (tournament.status === TournamentStatus.IN_PROGRESS) {
        throw new BadRequestException('El torneo ya está iniciado');
      }

      if (tournament.status === TournamentStatus.COMPLETED) {
        throw new BadRequestException('El torneo ya está completado');
      }

      // Verificar que hay suficientes participantes
      if (tournament.participants.length < 2) {
        throw new BadRequestException('Se necesitan al menos 2 participantes para iniciar el torneo');
      }

      // Actualizar el estado del torneo a IN_PROGRESS
      const updatedTournament = await this.prisma.tournament.update({
        where: { id },
        data: {
          status: TournamentStatus.IN_PROGRESS,
          startDate: new Date() // Actualizar la fecha de inicio al momento actual
        },
        include: {
          organizer: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
          events: true,
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  firstName: true,
                  lastName: true,
                }
              }
            }
          },
        }
      });

      // Generar brackets automáticamente
      let bracketResult = null;
      try {
        bracketResult = await this.bracketsService.generateTournamentBracket(
          id,
          updatedTournament.participants,
          updatedTournament.format || TournamentFormat.SINGLE_ELIMINATION
        );
      } catch (bracketError) {
        // Si falla la generación de brackets, log el error pero no fallar el inicio del torneo
        console.error('Error generando brackets automáticamente:', bracketError.message);
      }

      return {
        success: true,
        message: 'Torneo iniciado exitosamente',
        tournament: updatedTournament,
        bracket: bracketResult ? {
          generated: true,
          type: bracketResult.type,
          participantCount: bracketResult.participantCount,
          message: bracketResult.message
        } : {
          generated: false,
          message: 'Brackets no generados automáticamente. Pueden crearse manualmente.'
        }
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error al iniciar el torneo: ' + error.message);
    }
  }

  async getTournamentBracket(id: string) {
    try {
      const tournament = await this.prisma.tournament.findUnique({
        where: { id },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  firstName: true,
                  lastName: true,
                }
              }
            }
          },
          events: {
            include: {
              participants: {
                include: {
                  participant: {
                    include: {
                      user: {
                        select: {
                          id: true,
                          username: true,
                          firstName: true,
                          lastName: true,
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!tournament) {
        throw new NotFoundException('Torneo no encontrado');
      }

      // Verificar si el torneo tiene brackets disponibles
      const hasBracket = tournament.status === TournamentStatus.IN_PROGRESS || 
                        tournament.status === TournamentStatus.COMPLETED;

      // Obtener participantes del torneo
      const participants = tournament.participants || [];

      if (!hasBracket) {
        return {
          success: false,
          message: 'El torneo aún no tiene brackets disponibles. Debe estar iniciado para generar brackets.',
          hasBracket: false,
          tournament: {
            id: tournament.id,
            name: tournament.name,
            status: tournament.status,
            participantCount: participants.length
          }
        };
      }

      // Intentar obtener el bracket real de brackets-manager
      try {
        // Generar el ID numérico usando el mismo método que en BracketsService
        const numericTournamentId = Math.abs(id.hashCode());
        console.log(`[DEBUG] Getting bracket for tournament ${id}, numeric ID: ${numericTournamentId}`);
        
        // Obtener datos del bracket desde BracketsService
        const bracketData = await this.bracketsService.getTournamentByStringId(id);
        
        if (bracketData.success && bracketData.bracket) {
          console.log(`[DEBUG] Found bracket data for tournament ${id}`);
          return {
            success: true,
            hasBracket: true,
            data: {
              tournament: {
                id: tournament.id,
                name: tournament.name,
                type: tournament.type,
                status: tournament.status,
              },
              participants: bracketData.bracket.participant || [],
              matches: bracketData.bracket.match || [],
              rounds: bracketData.bracket.round || [],
              groups: bracketData.bracket.group || []
            }
          };
        }
      } catch (bracketError) {
        console.log(`[DEBUG] No bracket found for tournament ${id}:`, bracketError.message);
      }

      // Si no hay bracket generado, devolver estructura básica
      const bracketData = {
        tournament: {
          id: tournament.id,
          name: tournament.name,
          type: tournament.type,
          status: tournament.status,
        },
        participants: participants.map(p => ({
          id: p.id,
          name: p.user.username || `${p.user.firstName} ${p.user.lastName}`,
          seed: p.seed || 0
        })),
        matches: [],
        rounds: []
      };

      return {
        success: true,
        hasBracket: false,
        message: 'Torneo encontrado pero no tiene bracket generado. Use el endpoint de generación de brackets.',
        data: bracketData
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Error al obtener el bracket del torneo: ' + error.message);
    }
  }

  /**
   * Sincronizar torneo con Start.gg
   */
  async syncWithStartgg(tournamentId: string, startggSlug: string) {
    try {
      // Obtener datos del torneo desde Start.gg
      const startggTournament = await this.startggService.getTournament(startggSlug);
      
      if (!startggTournament) {
        throw new BadRequestException('Torneo no encontrado en Start.gg');
      }

      // Actualizar el torneo local con datos de Start.gg
      const updatedTournament = await this.prisma.tournament.update({
        where: { id: tournamentId },
        data: {
          name: startggTournament.name,
          startDate: startggTournament.startAt ? new Date(startggTournament.startAt * 1000) : undefined,
          endDate: startggTournament.endAt ? new Date(startggTournament.endAt * 1000) : undefined,
          venue: startggTournament.venueAddress || undefined,
          city: startggTournament.city || undefined,
          country: startggTournament.countryCode || undefined,
          maxParticipants: startggTournament.numAttendees || undefined,
          // Campos específicos de Start.gg se omiten porque no existen en el modelo Prisma
        },
        include: {
          organizer: true,
          events: true,
          participants: true
        }
      });

      return {
        success: true,
        message: 'Torneo sincronizado exitosamente con Start.gg',
        tournament: updatedTournament,
        startggData: {
          id: startggTournament.id,
          name: startggTournament.name,
          slug: startggSlug,
          numAttendees: startggTournament.numAttendees,
          events: startggTournament.events?.length || 0
        }
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error sincronizando con Start.gg: ${error.message}`);
    }
  }

  /**
   * Buscar torneos en Start.gg
   */
  async searchStartggTournaments(query: string, page: number = 1, limit: number = 20) {
    try {
      const tournaments = await this.startggService.searchTournaments(query, page, limit);
      
      return {
        success: true,
        data: tournaments,
        pagination: {
          page,
          limit,
          total: tournaments.pageInfo?.total ?? tournaments.tournaments.length
        }
      };
    } catch (error) {
      throw new BadRequestException(`Error buscando torneos en Start.gg: ${error.message}`);
    }
  }

  /**
   * Importar torneo desde Start.gg
   */
  async importFromStartgg(startggSlug: string, organizerId: string) {
    try {
      // Obtener datos del torneo desde Start.gg
      const startggTournament = await this.startggService.getTournament(startggSlug);
      
      if (!startggTournament) {
        throw new BadRequestException('Torneo no encontrado en Start.gg');
      }

      // Verificar si el organizador existe
      const organizer = await this.prisma.user.findUnique({
        where: { id: organizerId }
      });

      if (!organizer) {
        throw new BadRequestException('Organizador no encontrado');
      }

      // Crear el torneo en la base de datos local
      const newTournament = await this.prisma.tournament.create({
        data: {
          name: startggTournament.name,
          slug: startggSlug,
          description: 'Torneo importado desde Start.gg',
          game: 'Unknown', // Por defecto
          // El esquema Prisma no define "TOURNAMENT" en TournamentType; usamos SINGLES por defecto
          type: TournamentType.SINGLES,
          format: TournamentFormat.SINGLE_ELIMINATION,
          // Estado inicial válido según el enum de Prisma
          status: TournamentStatus.UPCOMING,
          organizer: {
            connect: {
              id: organizerId
            }
          },
          startDate: startggTournament.startAt ? new Date(startggTournament.startAt * 1000) : new Date(),
          endDate: startggTournament.endAt ? new Date(startggTournament.endAt * 1000) : undefined,
          venue: startggTournament.venueAddress || undefined,
          city: startggTournament.city || undefined,
          country: startggTournament.countryCode || undefined,
          maxParticipants: startggTournament.numAttendees || 64,
          entryFee: 0, // Por defecto
          // prizePool no existe en el modelo Tournament del esquema Prisma; se elimina
          // rules no existe en el modelo Tournament; se omite
          // Campos específicos de Start.gg se omiten porque no existen en el modelo Prisma
        },
        include: {
          organizer: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            }
          }
        }
      });

      // Importar eventos si existen
      let importedEvents = [];
      if (startggTournament.events?.length > 0) {
        for (const startggEvent of startggTournament.events) {
          try {
            const event = await this.prisma.event.create({
              data: {
                name: startggEvent.name,
                // description no existe en el modelo Event; se omite
                tournamentId: newTournament.id,
                game: startggEvent.videogame?.name || 'Unknown',
                slug: startggEvent.slug || startggEvent.name.toLowerCase().replace(/\s+/g, '-'),
                format: TournamentFormat.SINGLE_ELIMINATION,
                type: TournamentType.SINGLES,
                startDate: startggEvent.startAt ? new Date(startggEvent.startAt * 1000) : new Date(),
                maxEntrants: startggEvent.numEntrants || 32,
                // startggEventId no existe en el modelo Event; se omite
              }
            });
            importedEvents.push(event);
          } catch (eventError) {
            console.error(`Error importando evento ${startggEvent.name}:`, eventError.message);
          }
        }
      }

      return {
        success: true,
        message: 'Torneo importado exitosamente desde Start.gg',
        tournament: newTournament,
        importedEvents: importedEvents,
        startggData: {
          id: startggTournament.id,
          name: startggTournament.name,
          slug: startggSlug,
          numAttendees: startggTournament.numAttendees,
          eventsImported: importedEvents.length
        }
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error importando torneo desde Start.gg: ${error.message}`);
    }
  }
}
