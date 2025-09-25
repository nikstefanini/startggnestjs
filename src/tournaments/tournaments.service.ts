import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { ParticipantDto } from './dto/participant.dto';
import { TournamentStatus } from '@prisma/client';
import { BracketsService } from '../brackets/brackets.service';

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
    private bracketsService: BracketsService
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

  async findAll() {
    return this.prisma.tournament.findMany({
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
          updatedTournament.format || 'single_elimination'
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
}
