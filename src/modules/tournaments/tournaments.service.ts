import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { TournamentFiltersDto } from './dto/tournament-filters.dto';
import { Tournament, TournamentStatus } from '@prisma/client';

@Injectable()
export class TournamentsService {
  constructor(private prisma: PrismaService) {}

  async create(createTournamentDto: CreateTournamentDto, organizerId: string): Promise<Tournament> {
    // Validar fechas
    const startDate = new Date(createTournamentDto.startDate);
    const endDate = createTournamentDto.endDate ? new Date(createTournamentDto.endDate) : null;
    
    if (endDate && endDate <= startDate) {
      throw new BadRequestException('La fecha de fin debe ser posterior a la fecha de inicio');
    }

    // Validar fechas de registro
    if (createTournamentDto.registrationStart && createTournamentDto.registrationEnd) {
      const regStart = new Date(createTournamentDto.registrationStart);
      const regEnd = new Date(createTournamentDto.registrationEnd);
      
      if (regEnd <= regStart) {
        throw new BadRequestException('La fecha de cierre de registro debe ser posterior a la fecha de apertura');
      }
      
      if (regEnd > startDate) {
        throw new BadRequestException('El registro debe cerrar antes del inicio del torneo');
      }
    }

    // Verificar que el slug sea único
    const existingTournament = await this.prisma.tournament.findUnique({
      where: { slug: createTournamentDto.slug }
    });

    if (existingTournament) {
      throw new BadRequestException('Ya existe un torneo con ese slug');
    }

    return this.prisma.tournament.create({
      data: {
        name: createTournamentDto.name,
        slug: createTournamentDto.slug,
        description: createTournamentDto.description,
        game: createTournamentDto.game,
        format: createTournamentDto.format,
        type: createTournamentDto.type,
        startDate: new Date(createTournamentDto.startDate),
        endDate: createTournamentDto.endDate ? new Date(createTournamentDto.endDate) : null,
        registrationOpen: createTournamentDto.registrationOpen,
        registrationStart: createTournamentDto.registrationStart ? new Date(createTournamentDto.registrationStart) : null,
        registrationEnd: createTournamentDto.registrationEnd ? new Date(createTournamentDto.registrationEnd) : null,
        maxParticipants: createTournamentDto.maxParticipants,
        entryFee: createTournamentDto.entryFee,
        venue: createTournamentDto.venue,
        address: createTournamentDto.address,
        city: createTournamentDto.city,
        country: createTournamentDto.country,
        timezone: createTournamentDto.timezone,
        isOnline: createTournamentDto.isOnline,
        isPublic: createTournamentDto.isPublic,
        organizer: {
          connect: { id: organizerId }
        },
      },
      include: {
        organizer: {
          select: {
            id: true,
            username: true,
            email: true,
          }
        },
        events: true,
        _count: {
          select: {
            participants: true
          }
        }
      }
    });
  }

  async findAll(filters: TournamentFiltersDto) {
    const where: any = {};

    // Aplicar filtros
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { city: { contains: filters.search, mode: 'insensitive' } },
        { country: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.format) {
      where.format = filters.format;
    }

    if (filters.city) {
      where.city = { contains: filters.city, mode: 'insensitive' };
    }

    if (filters.country) {
      where.country = { contains: filters.country, mode: 'insensitive' };
    }

    if (filters.isOnline !== undefined) {
      where.isOnline = filters.isOnline;
    }

    if (filters.registrationOpen !== undefined) {
      where.registrationOpen = filters.registrationOpen;
    }

    if (filters.startDateFrom || filters.startDateTo) {
      where.startDate = {};
      if (filters.startDateFrom) {
        where.startDate.gte = new Date(filters.startDateFrom);
      }
      if (filters.startDateTo) {
        where.startDate.lte = new Date(filters.startDateTo);
      }
    }

    // Solo mostrar torneos públicos por defecto
    where.isPublic = true;

    const [tournaments, total] = await Promise.all([
      this.prisma.tournament.findMany({
        where,
        include: {
          organizer: {
            select: {
              id: true,
              username: true,
            }
          },
          events: {
            select: {
              id: true,
              name: true,
              game: true,
            }
          },
          _count: {
            select: {
              participants: true
            }
          }
        },
        orderBy: {
          [filters.sortBy]: filters.sortOrder
        },
        take: filters.limit,
        skip: filters.offset,
      }),
      this.prisma.tournament.count({ where })
    ]);

    return {
      tournaments,
      total,
      limit: filters.limit,
      offset: filters.offset,
      hasMore: filters.offset + filters.limit < total
    };
  }

  async findOne(id: string): Promise<Tournament> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      include: {
        organizer: {
          select: {
            id: true,
            username: true,
            email: true,
          }
        },
        events: {
          include: {
            _count: {
              select: {
                participants: true
              }
            }
          }
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              }
            }
          }
        },
        _count: {
          select: {
            participants: true
          }
        }
      }
    });

    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }

    return tournament;
  }

  async findBySlug(slug: string): Promise<Tournament> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { slug },
      include: {
        organizer: {
          select: {
            id: true,
            username: true,
            email: true,
          }
        },
        events: {
          include: {
            _count: {
              select: {
                participants: true
              }
            }
          }
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              }
            }
          }
        },
        _count: {
          select: {
            participants: true
          }
        }
      }
    });

    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }

    return tournament;
  }

  async update(id: string, updateTournamentDto: UpdateTournamentDto, userId: string): Promise<Tournament> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id }
    });

    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (tournament.organizerId !== userId) {
      throw new ForbiddenException('Solo el organizador puede actualizar este torneo');
    }

    // Validar fechas si se están actualizando
    if (updateTournamentDto.startDate || updateTournamentDto.endDate) {
      const startDate = updateTournamentDto.startDate ? new Date(updateTournamentDto.startDate) : tournament.startDate;
      const endDate = updateTournamentDto.endDate ? new Date(updateTournamentDto.endDate) : tournament.endDate;
      
      if (endDate && endDate <= startDate) {
        throw new BadRequestException('La fecha de fin debe ser posterior a la fecha de inicio');
      }
    }

    const updateData: any = { ...updateTournamentDto };
    
    if (updateTournamentDto.startDate) {
      updateData.startDate = new Date(updateTournamentDto.startDate);
    }
    
    if (updateTournamentDto.endDate) {
      updateData.endDate = new Date(updateTournamentDto.endDate);
    }
    
    if (updateTournamentDto.registrationStart) {
      updateData.registrationStart = new Date(updateTournamentDto.registrationStart);
    }
    
    if (updateTournamentDto.registrationEnd) {
      updateData.registrationEnd = new Date(updateTournamentDto.registrationEnd);
    }

    return this.prisma.tournament.update({
      where: { id },
      data: updateData,
      include: {
        organizer: {
          select: {
            id: true,
            username: true,
            email: true,
          }
        },
        events: true,
        _count: {
          select: {
            participants: true
          }
        }
      }
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id }
    });

    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (tournament.organizerId !== userId) {
      throw new ForbiddenException('Solo el organizador puede eliminar este torneo');
    }

    // No permitir eliminar torneos que ya han comenzado
    if (tournament.status === TournamentStatus.IN_PROGRESS || tournament.status === TournamentStatus.COMPLETED) {
      throw new BadRequestException('No se puede eliminar un torneo que ya ha comenzado o terminado');
    }

    await this.prisma.tournament.delete({
      where: { id }
    });
  }

  async getMyTournaments(userId: string, filters: TournamentFiltersDto) {
    const where: any = {
      organizerId: userId
    };

    // Aplicar filtros adicionales
    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    const [tournaments, total] = await Promise.all([
      this.prisma.tournament.findMany({
        where,
        include: {
          events: {
            select: {
              id: true,
              name: true,
              game: true,
            }
          },
          _count: {
            select: {
              participants: true
            }
          }
        },
        orderBy: {
          [filters.sortBy]: filters.sortOrder
        },
        take: filters.limit,
        skip: filters.offset,
      }),
      this.prisma.tournament.count({ where })
    ]);

    return {
      tournaments,
      total,
      limit: filters.limit,
      offset: filters.offset,
      hasMore: filters.offset + filters.limit < total
    };
  }

  async joinTournament(tournamentId: string, userId: string) {
    // Verificar que el torneo existe
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        _count: {
          select: {
            participants: true
          }
        }
      }
    });

    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }

    // Verificar que el torneo está abierto para registro
    if (!tournament.registrationOpen) {
      throw new BadRequestException('El registro para este torneo está cerrado');
    }

    // Verificar fechas de registro
    const now = new Date();
    if (tournament.registrationStart && now < tournament.registrationStart) {
      throw new BadRequestException('El registro para este torneo aún no ha comenzado');
    }

    if (tournament.registrationEnd && now > tournament.registrationEnd) {
      throw new BadRequestException('El registro para este torneo ha terminado');
    }

    // Verificar límite de participantes
    if (tournament.maxParticipants && tournament._count.participants >= tournament.maxParticipants) {
      throw new BadRequestException('El torneo ha alcanzado el límite máximo de participantes');
    }

    // Verificar que el usuario no esté ya registrado
    const existingParticipant = await this.prisma.tournamentParticipant.findUnique({
      where: {
        userId_tournamentId: {
          userId,
          tournamentId
        }
      }
    });

    if (existingParticipant) {
      throw new BadRequestException('Ya estás registrado en este torneo');
    }

    // Registrar al usuario en el torneo
    const participant = await this.prisma.tournamentParticipant.create({
      data: {
        tournamentId,
        userId,
        registeredAt: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true
          }
        },
        tournament: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    return participant;
  }

  async leaveTournament(tournamentId: string, userId: string) {
    // Verificar que el torneo existe
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId }
    });

    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }

    // Verificar que el usuario está registrado
    const participant = await this.prisma.tournamentParticipant.findUnique({
      where: {
        userId_tournamentId: {
          userId,
          tournamentId
        }
      }
    });

    if (!participant) {
      throw new BadRequestException('No estás registrado en este torneo');
    }

    // Verificar que el torneo no ha comenzado
    if (tournament.status !== 'UPCOMING') {
      throw new BadRequestException('No puedes abandonar un torneo que ya ha comenzado o terminado');
    }

    // Eliminar la participación
    await this.prisma.tournamentParticipant.delete({
      where: {
        userId_tournamentId: {
          userId,
          tournamentId
        }
      }
    });
  }
}