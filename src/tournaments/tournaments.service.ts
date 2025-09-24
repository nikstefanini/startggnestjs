import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { ParticipantDto } from './dto/participant.dto';
import { TournamentStatus } from '@prisma/client';

@Injectable()
export class TournamentsService {
  constructor(private prisma: PrismaService) {}

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
}
