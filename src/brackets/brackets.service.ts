import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { BracketsManager } from 'brackets-manager';
import { JsonDatabase } from 'brackets-json-db';
import { WebsocketGateway } from '../websocket/websocket.gateway';

export interface CreateBracketDto {
  name: string;
  type: 'single_elimination' | 'double_elimination' | 'round_robin';
  participants: string[];
  seeding?: 'natural' | 'reverse' | 'half_shift' | 'reverse_half_shift' | 'pair_flip' | 'inner_outer';
  settings?: {
    seedOrdering?: string[];
    balanceByes?: boolean;
    grandFinal?: 'simple' | 'double';
    skipFirstRound?: boolean;
    matchesChildCount?: number;
  };
}

export interface UpdateMatchDto {
  opponent1?: {
    score?: number;
    result?: 'win' | 'loss';
  };
  opponent2?: {
    score?: number;
    result?: 'win' | 'loss';
  };
}

@Injectable()
export class BracketsService {
  private manager: BracketsManager;

  constructor(
    @Inject(forwardRef(() => WebsocketGateway))
    private readonly websocketGateway: WebsocketGateway,
  ) {
    // Inicializar brackets-manager con base de datos en memoria
    const storage = new JsonDatabase();
    this.manager = new BracketsManager(storage);
  }

  /**
   * Crear un nuevo bracket/stage
   */
  async createBracket(createBracketDto: CreateBracketDto) {
    try {
      const { name, type, participants, seeding = 'natural', settings = {} } = createBracketDto;

      if (participants.length < 2) {
        throw new BadRequestException('Se requieren al menos 2 participantes');
      }

      // Configurar participantes con seeding
      const participantsWithSeeding = this.applySeedingStrategy(participants, seeding);

      // Configuración del stage según el tipo
      let stageConfig: any = {
        tournamentId: 1, // ID del torneo (puede ser dinámico)
        name,
        type,
        seeding: participantsWithSeeding.map(p => p.name),
        settings: {
          seedOrdering: settings.seedOrdering || participantsWithSeeding.map((_, i) => i),
          balanceByes: settings.balanceByes ?? true,
          ...settings
        }
      };

      // Configuraciones específicas por tipo de bracket
      switch (type) {
        case 'single_elimination':
          stageConfig.settings.skipFirstRound = settings.skipFirstRound ?? false;
          break;
        case 'double_elimination':
          stageConfig.settings.grandFinal = settings.grandFinal ?? 'double';
          break;
        case 'round_robin':
          stageConfig.settings.matchesChildCount = settings.matchesChildCount ?? 1;
          break;
      }

      // Crear el stage usando la API correcta
      const stage = await this.manager.create.stage(stageConfig);

      // Emitir notificación de stage creado
      this.websocketGateway.emitTournamentCreated({
        id: stage.id,
        name,
        type,
        participants,
      });

      return {
        success: true,
        stage,
        message: `Bracket ${type} creado exitosamente con ${participants.length} participantes`
      };

    } catch (error) {
      throw new BadRequestException(`Error al crear bracket: ${error.message}`);
    }
  }

  /**
   * Verificar progresión del bracket y emitir notificaciones
   */
  private async checkBracketProgression(stageId: number): Promise<void> {
    try {
      // Usar storage directamente para obtener datos
      const matches = await this.manager.storage.select('match', { stage_id: stageId });
      const rounds = await this.manager.storage.select('round', { stage_id: stageId });
      
      for (const round of rounds) {
        const roundMatches = matches.filter(match => match.round_id === round.id);
        const completedMatches = roundMatches.filter(match => 
          match.status === 2 // Status 2 = completed
        );
        
        // Emitir progresión del bracket
        this.websocketGateway.emitBracketProgression({
          tournamentId: stageId,
          roundId: Number(round.id),
          completedMatches: completedMatches.length,
          totalMatches: roundMatches.length,
        });
        
        // Verificar si el torneo está completo
        if (completedMatches.length === roundMatches.length && round.number === rounds.length) {
          const finalMatch = completedMatches.find(match => match.round_id === round.id);
          if (finalMatch) {
            const winner = finalMatch.opponent1?.score > finalMatch.opponent2?.score 
              ? finalMatch.opponent1 
              : finalMatch.opponent2;
            
            this.websocketGateway.emitTournamentCompleted(stageId, winner);
          }
        }
      }
    } catch (error) {
      console.error('Error checking bracket progression:', error);
    }
  }

  /**
   * Obtener información completa de un torneo
   */
  async getTournament(stageId: number) {
    try {
      // Usar storage directamente para obtener datos
      const stages = await this.manager.storage.select('stage', { id: stageId });
      if (!stages || stages.length === 0) {
        throw new NotFoundException(`Stage con ID ${stageId} no encontrado`);
      }

      const stage = stages[0];
      const groups = await this.manager.storage.select('group', { stage_id: stageId });
      const rounds = await this.manager.storage.select('round', { stage_id: stageId });
      const matches = await this.manager.storage.select('match', { stage_id: stageId });
      const participants = await this.manager.storage.select('participant', { tournament_id: stage.tournament_id });

      return {
        stage,
        groups,
        rounds,
        matches,
        participants
      };
    } catch (error) {
      throw new NotFoundException(`Error al obtener torneo: ${error.message}`);
    }
  }

  /**
   * Obtener todos los matches de un stage
   */
  async getMatches(stageId: number) {
    try {
      const matches = await this.manager.storage.select('match', { stage_id: stageId });
      return matches;
    } catch (error) {
      throw new NotFoundException(`Error al obtener matches: ${error.message}`);
    }
  }

  /**
   * Actualizar resultado de un match
   */
  async updateMatch(stageId: number, matchId: number, updateData: UpdateMatchDto): Promise<any> {
    try {
      // Actualizar el match usando la API correcta
      await this.manager.update.match({
        id: matchId,
        opponent1: updateData.opponent1 ? {
          score: updateData.opponent1.score,
          result: updateData.opponent1.result
        } : undefined,
        opponent2: updateData.opponent2 ? {
          score: updateData.opponent2.score,
          result: updateData.opponent2.result
        } : undefined,
      });

      // Obtener el match actualizado
      const updatedMatches = await this.manager.storage.select('match', { id: matchId });
      const updatedMatch = updatedMatches[0];
      
      // Emitir notificación WebSocket
      this.websocketGateway.emitMatchUpdate({
        tournamentId: stageId,
        matchId,
        opponent1: updateData.opponent1,
        opponent2: updateData.opponent2,
      });

      // Verificar progresión del bracket
      await this.checkBracketProgression(stageId);
      
      return {
        success: true,
        match: updatedMatch,
        message: 'Match actualizado exitosamente',
      };
    } catch (error) {
      this.websocketGateway.emitError(stageId, `Error al actualizar match: ${error.message}`);
      throw new BadRequestException(`Error al actualizar match: ${error.message}`);
    }
  }

  /**
   * Obtener bracket en formato para visualización
   */
  async getBracketData(stageId: number) {
    try {
      const stageData = await this.getTournament(stageId);
      
      // Formatear datos para brackets-viewer
      const bracketData = {
        stage: stageData.stage,
        groups: stageData.groups,
        rounds: stageData.rounds,
        matches: stageData.matches,
        participants: stageData.participants
      };

      return bracketData;
    } catch (error) {
      throw new NotFoundException(`Error al obtener datos del bracket: ${error.message}`);
    }
  }

  /**
   * Resetear un stage
   */
  async resetTournament(stageId: number) {
    try {
      // Usar la API de reset para resetear los resultados del stage
      await this.manager.reset.matchResults(stageId);

      return {
        success: true,
        message: `Stage ${stageId} reseteado exitosamente`
      };
    } catch (error) {
      throw new NotFoundException(`Error al resetear stage: ${error.message}`);
    }
  }

  /**
   * Aplicar estrategia de seeding a los participantes
   */
  private applySeedingStrategy(participants: string[], seeding: string): any[] {
    const participantsWithId = participants.map((name, index) => ({
      id: index + 1,
      name,
      tournament_id: null
    }));

    switch (seeding) {
      case 'reverse':
        return participantsWithId.reverse();
      case 'half_shift':
        const half = Math.floor(participantsWithId.length / 2);
        return [
          ...participantsWithId.slice(half),
          ...participantsWithId.slice(0, half)
        ];
      case 'reverse_half_shift':
        const halfReverse = Math.floor(participantsWithId.length / 2);
        return [
          ...participantsWithId.slice(halfReverse).reverse(),
          ...participantsWithId.slice(0, halfReverse).reverse()
        ];
      case 'pair_flip':
        const paired = [];
        for (let i = 0; i < participantsWithId.length; i += 2) {
          if (i + 1 < participantsWithId.length) {
            paired.push(participantsWithId[i + 1], participantsWithId[i]);
          } else {
            paired.push(participantsWithId[i]);
          }
        }
        return paired;
      case 'inner_outer':
        const result = [];
        let left = 0;
        let right = participantsWithId.length - 1;
        let toLeft = true;
        
        while (left <= right) {
          if (toLeft) {
            result.push(participantsWithId[left++]);
          } else {
            result.push(participantsWithId[right--]);
          }
          toLeft = !toLeft;
        }
        return result;
      case 'natural':
      default:
        return participantsWithId;
    }
  }

  /**
   * Obtener estadísticas del stage
   */
  async getTournamentStats(stageId: number) {
    try {
      const stageData = await this.getTournament(stageId);
      const matches = stageData.matches;
      
      const completedMatches = matches.filter(match => 
        match.opponent1?.score !== null && match.opponent2?.score !== null
      );
      
      const pendingMatches = matches.filter(match => 
        match.opponent1?.score === null || match.opponent2?.score === null
      );

      const participantStats = stageData.participants.map(participant => {
        const participantMatches = matches.filter(match => 
          match.opponent1?.id === participant.id || match.opponent2?.id === participant.id
        );
        
        const wins = participantMatches.filter(match => {
          if (match.opponent1?.id === participant.id) {
            return match.opponent1?.result === 'win';
          }
          return match.opponent2?.result === 'win';
        }).length;

        const losses = participantMatches.filter(match => {
          if (match.opponent1?.id === participant.id) {
            return match.opponent1?.result === 'loss';
          }
          return match.opponent2?.result === 'loss';
        }).length;

        return {
          participant: participant.name,
          matches_played: participantMatches.length,
          wins,
          losses,
          win_rate: participantMatches.length > 0 ? (wins / participantMatches.length) * 100 : 0
        };
      });

      return {
        stage_info: {
          name: stageData.stage.name,
          type: stageData.stage.type,
          total_participants: stageData.participants.length,
          total_matches: matches.length,
          completed_matches: completedMatches.length,
          pending_matches: pendingMatches.length,
          progress: matches.length > 0 ? (completedMatches.length / matches.length) * 100 : 0
        },
        participant_stats: participantStats
      };
    } catch (error) {
      throw new NotFoundException(`Error al obtener estadísticas: ${error.message}`);
    }
  }
}
