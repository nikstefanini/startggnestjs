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
import { TournamentsService } from './tournaments.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { TournamentFiltersDto } from './dto/tournament-filters.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createTournamentDto: CreateTournamentDto,
    @Request() req: any,
  ) {
    const tournament = await this.tournamentsService.create(
      createTournamentDto,
      req.user.id,
    );
    
    return {
      success: true,
      message: 'Torneo creado exitosamente',
      data: tournament,
    };
  }

  @Get()
  async findAll(@Query() filters: TournamentFiltersDto) {
    const result = await this.tournamentsService.findAll(filters);
    
    return {
      success: true,
      message: 'Torneos obtenidos exitosamente',
      data: result.tournaments,
      meta: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasMore: result.hasMore,
      },
    };
  }

  @Get('my-tournaments')
  @UseGuards(JwtAuthGuard)
  async getMyTournaments(
    @Query() filters: TournamentFiltersDto,
    @Request() req: any,
  ) {
    const result = await this.tournamentsService.getMyTournaments(
      req.user.id,
      filters,
    );
    
    return {
      success: true,
      message: 'Mis torneos obtenidos exitosamente',
      data: result.tournaments,
      meta: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasMore: result.hasMore,
      },
    };
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    const tournament = await this.tournamentsService.findBySlug(slug);
    
    return {
      success: true,
      message: 'Torneo obtenido exitosamente',
      data: tournament,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const tournament = await this.tournamentsService.findOne(id);
    
    return {
      success: true,
      message: 'Torneo obtenido exitosamente',
      data: tournament,
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateTournamentDto: UpdateTournamentDto,
    @Request() req: any,
  ) {
    const tournament = await this.tournamentsService.update(
      id,
      updateTournamentDto,
      req.user.id,
    );
    
    return {
      success: true,
      message: 'Torneo actualizado exitosamente',
      data: tournament,
    };
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async joinTournament(@Param('id') id: string, @Request() req: any) {
    const result = await this.tournamentsService.joinTournament(id, req.user.id);
    
    return {
      success: true,
      message: 'Te has unido al torneo exitosamente',
      data: result,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @Request() req: any) {
    await this.tournamentsService.remove(id, req.user.id);
    
    return {
      success: true,
      message: 'Torneo eliminado exitosamente',
    };
  }
}