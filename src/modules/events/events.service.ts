import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { Event, EventStatus } from '@prisma/client';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async create(createEventDto: CreateEventDto, userId: string): Promise<Event> {
    // Verificar que el torneo existe y que el usuario es el organizador
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: createEventDto.tournamentId }
    });

    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (tournament.organizerId !== userId) {
      throw new ForbiddenException('Solo el organizador del torneo puede crear eventos');
    }

    // Validar fechas
    const startDate = new Date(createEventDto.startDate);
    const endDate = createEventDto.endDate ? new Date(createEventDto.endDate) : null;
    
    if (endDate && endDate <= startDate) {
      throw new BadRequestException('La fecha de fin debe ser posterior a la fecha de inicio');
    }

    // Verificar que las fechas del evento estén dentro del rango del torneo
    if (startDate < tournament.startDate) {
      throw new BadRequestException('El evento no puede comenzar antes que el torneo');
    }

    if (tournament.endDate && startDate > tournament.endDate) {
      throw new BadRequestException('El evento no puede comenzar después que termine el torneo');
    }

    // Verificar que el slug sea único dentro del torneo
    const existingEvent = await this.prisma.event.findFirst({
      where: {
        slug: createEventDto.slug,
        tournamentId: createEventDto.tournamentId
      }
    });

    if (existingEvent) {
      throw new BadRequestException('Ya existe un evento con ese slug en este torneo');
    }

    return this.prisma.event.create({
      data: {
        ...createEventDto,
        startDate: new Date(createEventDto.startDate),
        endDate: endDate,
      },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            slug: true,
          }
        },
        _count: {
          select: {
            participants: true
          }
        }
      }
    });
  }

  async findAll(tournamentId?: string) {
    const where: any = {};
    
    if (tournamentId) {
      where.tournamentId = tournamentId;
    }

    return this.prisma.event.findMany({
      where,
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            slug: true,
            organizer: {
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
      },
      orderBy: {
        startDate: 'asc'
      }
    });
  }

  async findOne(id: string): Promise<Event> {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            slug: true,
            organizer: {
              select: {
                id: true,
                username: true,
              }
            }
          }
        },
        participants: {
          include: {
            participant: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                  }
                }
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

    if (!event) {
      throw new NotFoundException('Evento no encontrado');
    }

    return event;
  }

  async findBySlug(tournamentSlug: string, eventSlug: string): Promise<Event> {
    const event = await this.prisma.event.findFirst({
      where: {
        slug: eventSlug,
        tournament: {
          slug: tournamentSlug
        }
      },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            slug: true,
            organizer: {
              select: {
                id: true,
                username: true,
              }
            }
          }
        },
        participants: {
          include: {
            participant: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                  }
                }
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

    if (!event) {
      throw new NotFoundException('Evento no encontrado');
    }

    return event;
  }

  async update(id: string, updateEventDto: UpdateEventDto, userId: string): Promise<Event> {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        tournament: true
      }
    });

    if (!event) {
      throw new NotFoundException('Evento no encontrado');
    }

    if (event.tournament.organizerId !== userId) {
      throw new ForbiddenException('Solo el organizador del torneo puede actualizar este evento');
    }

    // Validar fechas si se están actualizando
    if (updateEventDto.startDate || updateEventDto.endDate) {
      const startDate = updateEventDto.startDate ? new Date(updateEventDto.startDate) : event.startDate;
      const endDate = updateEventDto.endDate ? new Date(updateEventDto.endDate) : event.endDate;
      
      if (endDate && endDate <= startDate) {
        throw new BadRequestException('La fecha de fin debe ser posterior a la fecha de inicio');
      }
    }

    const updateData: any = { ...updateEventDto };
    
    if (updateEventDto.startDate) {
      updateData.startDate = new Date(updateEventDto.startDate);
    }
    
    if (updateEventDto.endDate) {
      updateData.endDate = new Date(updateEventDto.endDate);
    }

    return this.prisma.event.update({
      where: { id },
      data: updateData,
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            slug: true,
          }
        },
        _count: {
          select: {
            participants: true
          }
        }
      }
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        tournament: true
      }
    });

    if (!event) {
      throw new NotFoundException('Evento no encontrado');
    }

    if (event.tournament.organizerId !== userId) {
      throw new ForbiddenException('Solo el organizador del torneo puede eliminar este evento');
    }

    // No permitir eliminar eventos que ya han comenzado
    if (event.status === EventStatus.ACTIVE || event.status === EventStatus.COMPLETED) {
      throw new BadRequestException('No se puede eliminar un evento que ya ha comenzado o terminado');
    }

    await this.prisma.event.delete({
      where: { id }
    });
  }

  async getEventsByTournament(tournamentId: string) {
    return this.prisma.event.findMany({
      where: { tournamentId },
      include: {
        _count: {
          select: {
            participants: true
          }
        }
      },
      orderBy: {
        startDate: 'asc'
      }
    });
  }

  async attendEvent(eventId: string, userId: string) {
    // Verificar que el evento existe
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        tournament: true,
        _count: {
          select: {
            participants: true
          }
        }
      }
    });

    if (!event) {
      throw new NotFoundException('Evento no encontrado');
    }

    // Verificar que el evento está disponible para registro (basado en el estado)
    if (event.status !== 'UPCOMING') {
      throw new BadRequestException('El registro para este evento no está disponible');
    }

    // Verificar fechas de registro (usar fechas del torneo padre)
    const now = new Date();
    if (event.tournament.registrationStart && now < event.tournament.registrationStart) {
      throw new BadRequestException('El registro para este evento aún no ha comenzado');
    }

    if (event.tournament.registrationEnd && now > event.tournament.registrationEnd) {
      throw new BadRequestException('El registro para este evento ha terminado');
    }

    // Verificar límite de participantes
    if (event.maxEntrants && event._count.participants >= event.maxEntrants) {
      throw new BadRequestException('El evento ha alcanzado el límite máximo de participantes');
    }

    // Verificar que el usuario esté registrado en el torneo
    const tournamentParticipant = await this.prisma.tournamentParticipant.findUnique({
      where: {
        userId_tournamentId: {
          userId,
          tournamentId: event.tournamentId
        }
      }
    });

    if (!tournamentParticipant) {
      throw new BadRequestException('Debes estar registrado en el torneo para participar en este evento');
    }

    // Verificar que el usuario no esté ya registrado en el evento
    const existingParticipant = await this.prisma.eventParticipant.findUnique({
      where: {
        participantId_eventId: {
          participantId: tournamentParticipant.id,
          eventId
        }
      }
    });

    if (existingParticipant) {
      throw new BadRequestException('Ya estás registrado en este evento');
    }

    // Registrar al usuario en el evento
    const participant = await this.prisma.eventParticipant.create({
      data: {
        participantId: tournamentParticipant.id,
        eventId
      },
      include: {
        participant: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true
              }
            }
          }
        },
        event: {
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

  async unattendEvent(eventId: string, userId: string) {
    // Verificar que el evento existe
    const event = await this.prisma.event.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      throw new NotFoundException('Evento no encontrado');
    }

    // Obtener el participante del torneo
    const tournamentParticipant = await this.prisma.tournamentParticipant.findUnique({
      where: {
        userId_tournamentId: {
          userId,
          tournamentId: event.tournamentId
        }
      }
    });

    if (!tournamentParticipant) {
      throw new BadRequestException('No estás registrado en el torneo');
    }

    // Verificar que el usuario está registrado en el evento
    const participant = await this.prisma.eventParticipant.findUnique({
      where: {
        participantId_eventId: {
          participantId: tournamentParticipant.id,
          eventId
        }
      }
    });

    if (!participant) {
      throw new BadRequestException('No estás registrado en este evento');
    }

    // Verificar que el evento no ha comenzado
    if (event.status !== 'UPCOMING') {
      throw new BadRequestException('No puedes cancelar tu asistencia a un evento que ya ha comenzado o terminado');
    }

    // Eliminar la participación
    await this.prisma.eventParticipant.delete({
      where: {
        participantId_eventId: {
          participantId: tournamentParticipant.id,
          eventId
        }
      }
    });
  }
}