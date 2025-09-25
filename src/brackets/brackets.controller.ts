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
  HttpCode,
  BadRequestException
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
   * Crear un nuevo bracket para un torneo específico
   */
  @Post(':tournamentId')
  @HttpCode(HttpStatus.CREATED)
  async createBracketForTournament(
    @Param('tournamentId') tournamentId: string,
    @Body() createBracketDto: CreateBracketDto
  ) {
    return await this.bracketsService.createBracket(createBracketDto, tournamentId);
  }

  /**
   * Obtener información completa de un torneo
   */
  @Get(':tournamentId')
  async getTournament(@Param('tournamentId', ParseIntPipe) tournamentId: number) {
    return await this.bracketsService.getTournament(tournamentId);
  }

  /**
   * Obtener información de torneo por ID string (Prisma)
   */
  @Get('tournament/:tournamentId')
  async getTournamentByStringId(@Param('tournamentId') tournamentId: string) {
    return await this.bracketsService.getTournamentByStringId(tournamentId);
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

  /**
   * Generar bracket automáticamente para un torneo
   */
  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  async generateBracket(@Body() generateBracketDto: { tournamentId: string; type?: string }) {
    try {
      console.log('=== CONTROLLER generateBracket ===');
      console.log('Request body:', generateBracketDto);

      // Obtener participantes del torneo
      const tournamentData = await this.bracketsService.getTournamentByStringId(generateBracketDto.tournamentId);
      console.log('Tournament data retrieved:', tournamentData);
      
      if (!tournamentData.success || !tournamentData.tournament) {
        console.log('ERROR: Torneo no encontrado');
        throw new BadRequestException('Torneo no encontrado');
      }

      const participants = tournamentData.tournament.participants || [];
      console.log('Participants found:', participants.length);
      
      const result = await this.bracketsService.generateTournamentBracket(
        generateBracketDto.tournamentId,
        participants,
        generateBracketDto.type || 'single_elimination'
      );
      
      console.log('=== CONTROLLER generateBracket SUCCESS ===');
      return result;
    } catch (error) {
      console.log('=== CONTROLLER generateBracket ERROR ===');
      console.log('Error:', error);
      throw new BadRequestException(`Error al crear bracket: ${error.message}`);
    }
  }
}
