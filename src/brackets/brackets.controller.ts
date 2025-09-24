import { 
  Controller, 
  Post, 
  Get, 
  Put, 
  Delete,
  Body, 
  Param, 
  ParseIntPipe,
  HttpStatus,
  HttpCode
} from '@nestjs/common';
import { BracketsService, CreateBracketDto, UpdateMatchDto } from './brackets.service';

@Controller('brackets')
export class BracketsController {
  constructor(private readonly bracketsService: BracketsService) {}

  /**
   * Crear un nuevo bracket/torneo
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createBracket(@Body() createBracketDto: CreateBracketDto) {
    return await this.bracketsService.createBracket(createBracketDto);
  }

  /**
   * Obtener información completa de un torneo
   */
  @Get(':tournamentId')
  async getTournament(@Param('tournamentId', ParseIntPipe) tournamentId: number) {
    return await this.bracketsService.getTournament(tournamentId);
  }

  /**
   * Obtener datos del bracket para visualización
   */
  @Get(':tournamentId/bracket-data')
  async getBracketData(@Param('tournamentId', ParseIntPipe) tournamentId: number) {
    return await this.bracketsService.getBracketData(tournamentId);
  }

  /**
   * Obtener todos los matches de un torneo
   */
  @Get(':tournamentId/matches')
  async getMatches(@Param('tournamentId', ParseIntPipe) tournamentId: number) {
    return await this.bracketsService.getMatches(tournamentId);
  }

  /**
   * Obtener estadísticas del torneo
   */
  @Get(':tournamentId/stats')
  async getTournamentStats(@Param('tournamentId', ParseIntPipe) tournamentId: number) {
    return await this.bracketsService.getTournamentStats(tournamentId);
  }

  /**
   * Actualizar resultado de un match
   */
  @Put(':stageId/matches/:matchId')
  async updateMatch(
    @Param('stageId', ParseIntPipe) stageId: number,
    @Param('matchId', ParseIntPipe) matchId: number,
    @Body() updateMatchDto: UpdateMatchDto
  ) {
    return await this.bracketsService.updateMatch(stageId, matchId, updateMatchDto);
  }

  /**
   * Resetear un torneo (eliminar todos los resultados)
   */
  @Delete(':tournamentId/reset')
  async resetTournament(@Param('tournamentId', ParseIntPipe) tournamentId: number) {
    return await this.bracketsService.resetTournament(tournamentId);
  }
}
