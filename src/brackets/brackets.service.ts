import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { BracketsManager } from 'brackets-manager';
import { JsonDatabase } from 'brackets-json-db';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { PrismaService } from '../prisma/prisma.service';

// Extensión para String para generar hash codes
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

export interface CreateBracketDto {
  name: string;
  type: 'single_elimination' | 'double_elimination' | 'round_robin';
  participants: string[];
  seeding?: 'natural' | 'reverse' | 'half_shift' | 'reverse_half_shift' | 'pair_flip' | 'inner_outer' | 'random';
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
    private readonly prisma: PrismaService,
  ) {
    // Inicializar brackets-manager con base de datos en memoria
    const storage = new JsonDatabase();
    this.manager = new BracketsManager(storage);
  }

  /**
   * Crear un nuevo bracket/stage
   */
  async createBracket(createBracketDto: CreateBracketDto, tournamentId?: string) {
    try {
      console.log('=== INICIO createBracket ===');
      console.log('createBracketDto recibido:', JSON.stringify(createBracketDto, null, 2));
      console.log('tournamentId:', tournamentId);

      const { name, type, participants, seeding = 'natural', settings = {} } = createBracketDto;

      console.log('Datos extraídos:');
      console.log('- name:', name);
      console.log('- type:', type);
      console.log('- participants:', participants);
      console.log('- participants type:', typeof participants);
      console.log('- participants length:', participants?.length);
      console.log('- seeding:', seeding);
      console.log('- settings:', settings);

      if (participants.length < 2) {
        throw new BadRequestException('Se requieren al menos 2 participantes');
      }

      // Verificar que todos los participantes sean strings válidos
      console.log('Verificando participantes:');
      participants.forEach((p, index) => {
        console.log(`Participante ${index}: "${p}" (tipo: ${typeof p}, válido: ${typeof p === 'string' && p.trim().length > 0})`);
      });

      // Aplicar seeding a los participantes
      let seedingParticipants = participants;
      if (seeding === 'random') {
        // Para seeding aleatorio, mezclamos los participantes
        seedingParticipants = [...participants].sort(() => Math.random() - 0.5);
        console.log('Participantes mezclados aleatoriamente:', seedingParticipants);
      } else if (seeding !== 'natural') {
        // Aplicar otras estrategias de seeding
        seedingParticipants = this.applySeedingStrategy(participants, seeding);
        console.log(`Participantes con seeding ${seeding}:`, seedingParticipants);
      }

      // Configuración del stage según el tipo
      // Usar un ID numérico simple para brackets-manager (no el ID de Prisma)
      const numericTournamentId = tournamentId ? Math.abs(tournamentId.hashCode()) : Date.now();
      
      let stageConfig: any = {
        tournamentId: numericTournamentId,
        name,
        type,
        seeding: seedingParticipants, // Los participantes ya procesados con seeding
        settings: {
          seedOrdering: ['natural'], // Siempre natural porque ya aplicamos el seeding a los participantes
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

      console.log('=== CONFIGURACIÓN FINAL DEL STAGE ===');
      console.log(JSON.stringify(stageConfig, null, 2));

      console.log('=== LLAMANDO A manager.create.stage ===');
      console.log('Manager disponible:', !!this.manager);
      console.log('Manager.create disponible:', !!this.manager?.create);
      console.log('Manager.create.stage disponible:', !!this.manager?.create?.stage);

      // Crear el stage usando la API correcta
      const stage = await this.manager.create.stage(stageConfig);

      console.log('=== STAGE CREADO EXITOSAMENTE ===');
      console.log('Stage resultado:', stage);

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
      console.error('=== ERROR EN createBracket ===');
      console.error('Error completo:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Error name:', error.name);
      throw new BadRequestException(`Error al crear bracket: ${error.message}`);
    }
  }

  /**
   * Verificar progresión del bracket y emitir notificaciones
   */
  private async checkBracketProgression(stageId: number): Promise<void> {
    try {
      console.log(`[DEBUG] Checking bracket progression for stage ${stageId}`);
      
      // Usar storage directamente para obtener datos
      const matches = await this.manager.storage.select('match', { stage_id: stageId });
      const rounds = await this.manager.storage.select('round', { stage_id: stageId });
      
      console.log(`[DEBUG] Found ${matches.length} matches and ${rounds.length} rounds`);
      
      // Ordenar rondas por número
      const sortedRounds = rounds.sort((a, b) => a.number - b.number);
      
      for (const round of sortedRounds) {
        const roundMatches = matches.filter(match => match.round_id === round.id);
        const completedMatches = roundMatches.filter(match => 
          match.status === 3 // Status 3 = completed
        );
        
        console.log(`[DEBUG] Round ${round.number}: ${completedMatches.length}/${roundMatches.length} matches completed`);
        
        // Emitir progresión del bracket
        this.websocketGateway.emitBracketProgression({
          tournamentId: stageId,
          roundId: Number(round.id),
          completedMatches: completedMatches.length,
          totalMatches: roundMatches.length,
        });
        
        // Verificar si el torneo está completo
        if (completedMatches.length === roundMatches.length && round.number === sortedRounds.length) {
          const finalMatch = completedMatches.find(match => match.round_id === round.id);
          if (finalMatch) {
            const winner = finalMatch.opponent1?.score > finalMatch.opponent2?.score 
              ? finalMatch.opponent1 
              : finalMatch.opponent2;
            
            this.websocketGateway.emitTournamentCompleted(stageId, winner);
          }
        }
      }
      
      // brackets-manager debería manejar automáticamente el avance de participantes
      // cuando se actualiza un match con resultado. No necesitamos intervención manual.
      console.log(`[DEBUG] Bracket progression check completed for stage ${stageId}`);
      
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
   * Obtener información de bracket por ID de torneo string (Prisma)
   */
  async getTournamentByStringId(tournamentId: string) {
    try {
      // Buscar el torneo en la base de datos para obtener información
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
                }
              }
            }
          }
        }
      });

      if (!tournament) {
        throw new BadRequestException('Torneo no encontrado');
      }

      // Intentar obtener el bracket del manager si existe
      let bracketData = null;
      try {
        // Generar el ID numérico usando el hash del tournamentId
        const numericTournamentId = Math.abs(tournamentId.hashCode());
        console.log(`[DEBUG] Looking for bracket with numeric ID: ${numericTournamentId} for tournament: ${tournamentId}`);
        
        // Buscar el stage que corresponde a este torneo
        const stages = await this.manager.storage.select('stage', { tournament_id: numericTournamentId });
        if (stages && stages.length > 0) {
          const stageId = stages[0].id;
          console.log(`[DEBUG] Found stage with ID: ${stageId}`);
          bracketData = await this.manager.get.tournamentData(numericTournamentId);
        }
      } catch (error) {
        console.log(`[DEBUG] No bracket found for tournament ${tournamentId}:`, error.message);
        // Si no existe bracket en el manager, devolver solo la información del torneo
      }

      return {
        success: true,
        tournament,
        bracket: bracketData,
        hasGeneratedBracket: !!bracketData
      };
    } catch (error) {
      throw new BadRequestException(`Error al obtener información del torneo: ${error.message}`);
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
      console.log(`[DEBUG] Updating match ${matchId} with data:`, JSON.stringify(updateData, null, 2));
      
      // Determinar si el match debe marcarse como completado
      const hasResults = updateData.opponent1?.score !== undefined && updateData.opponent2?.score !== undefined;
      
      // Actualizar el match usando la API correcta
      const updatePayload: any = {
        id: matchId,
        opponent1: updateData.opponent1 ? {
          score: updateData.opponent1.score,
          result: updateData.opponent1.result
        } : undefined,
        opponent2: updateData.opponent2 ? {
          score: updateData.opponent2.score,
          result: updateData.opponent2.result
        } : undefined,
      };
      
      // Si tenemos resultados, marcar como completado
      if (hasResults) {
        updatePayload.status = 3; // Status 3 = completed en brackets-manager
        console.log(`[DEBUG] Setting match ${matchId} status to completed (3)`);
      }
      
      console.log(`[DEBUG] Update payload:`, JSON.stringify(updatePayload, null, 2));
      
      await this.manager.update.match(updatePayload);

      // Obtener el match actualizado
      const updatedMatches = await this.manager.storage.select('match', { id: matchId });
      const updatedMatch = updatedMatches[0];
      
      console.log(`[DEBUG] Match ${matchId} updated successfully. New status:`, updatedMatch.status);
      
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
      console.error(`[DEBUG] Error updating match ${matchId}:`, error);
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
  private applySeedingStrategy(participants: string[], seeding: string): string[] {
    switch (seeding) {
      case 'reverse':
        return [...participants].reverse();
      case 'half_shift':
        const half = Math.floor(participants.length / 2);
        return [
          ...participants.slice(half),
          ...participants.slice(0, half)
        ];
      case 'reverse_half_shift':
        const halfReverse = Math.floor(participants.length / 2);
        return [
          ...participants.slice(halfReverse).reverse(),
          ...participants.slice(0, halfReverse).reverse()
        ];
      case 'pair_flip':
        const paired = [];
        for (let i = 0; i < participants.length; i += 2) {
          if (i + 1 < participants.length) {
            paired.push(participants[i + 1], participants[i]);
          } else {
            paired.push(participants[i]);
          }
        }
        return paired;
      case 'inner_outer':
        const result = [];
        let left = 0;
        let right = participants.length - 1;
        let toLeft = true;
        
        while (left <= right) {
          if (toLeft) {
            result.push(participants[left++]);
          } else {
            result.push(participants[right--]);
          }
          toLeft = !toLeft;
        }
        return result;
      case 'natural':
      default:
        return [...participants];
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

  /**
   * Generar bracket automáticamente para un torneo específico
   */
  async generateTournamentBracket(tournamentId: string, participants: any[], tournamentType: string = 'single_elimination') {
    try {
      console.log('=== INICIO generateTournamentBracket ===');
      console.log('tournamentId:', tournamentId);
      console.log('participants:', JSON.stringify(participants, null, 2));
      console.log('tournamentType:', tournamentType);

      // Validar que participants no sea undefined o null
      if (!participants || !Array.isArray(participants)) {
        console.log('ERROR: Lista de participantes no válida');
        throw new BadRequestException('Lista de participantes no válida');
      }

      if (participants.length < 2) {
        console.log('ERROR: Menos de 2 participantes');
        throw new BadRequestException('Se requieren al menos 2 participantes para generar un bracket');
      }

      // Preparar lista de participantes
      console.log('Participantes originales:', JSON.stringify(participants, null, 2));
      
      const participantNames = participants.map((p, index) => {
        let name = '';
        
        if (p.user?.username) {
          name = p.user.username;
        } else if (p.user?.firstName || p.user?.lastName) {
          name = `${p.user?.firstName || ''} ${p.user?.lastName || ''}`.trim();
        } else {
          name = `Participante ${p.id || index + 1}`;
        }
        
        // Asegurar que el nombre no esté vacío
        if (!name || name.trim() === '') {
          name = `Participante ${p.id || index + 1}`;
        }
        
        console.log(`Participante ${index}: ${name}`);
        return name;
      });
      
      console.log('Nombres de participantes finales:', participantNames);

      // Configuración del bracket según el tipo de torneo
      let bracketType: 'single_elimination' | 'double_elimination' | 'round_robin' = 'single_elimination';
      let settings: any = {
        balanceByes: true,
        seedOrdering: ['natural']
      };

      // Determinar tipo de bracket basado en el formato del torneo
      const normalizedType = tournamentType.toLowerCase().replace('_', '_');
      switch (normalizedType) {
        case 'single_elimination':
          bracketType = 'single_elimination';
          settings.skipFirstRound = false;
          break;
        case 'double_elimination':
          bracketType = 'double_elimination';
          settings.grandFinal = 'double';
          break;
        case 'round_robin':
          bracketType = 'round_robin';
          break;
        default:
          // Fallback basado en número de participantes si el formato no es reconocido
          if (participants.length <= 8) {
            bracketType = 'single_elimination';
            settings.skipFirstRound = false;
          } else if (participants.length <= 16) {
            bracketType = 'double_elimination';
            settings.grandFinal = 'double';
          } else {
            bracketType = 'single_elimination';
          }
      }

      // Crear el bracket
      const bracketData: CreateBracketDto = {
        name: `Bracket Principal - Torneo ${tournamentId}`,
        type: bracketType,
        participants: participantNames,
        seeding: 'natural',
        settings
      };

      console.log('Creando bracket con datos:', JSON.stringify(bracketData, null, 2));
      const result = await this.createBracket(bracketData, tournamentId);
      console.log('Bracket creado exitosamente:', result);

      // Emitir notificación de bracket generado
      this.websocketGateway.emitTournamentCreated({
        id: parseInt(tournamentId),
        name: bracketData.name,
        type: bracketType,
        participants: participantNames,
        auto_generated: true
      });

      console.log('=== FIN generateTournamentBracket EXITOSO ===');
      return {
        success: true,
        message: `Bracket ${bracketType} generado automáticamente con ${participants.length} participantes`,
        bracket: result.stage,
        type: bracketType,
        participantCount: participants.length
      };

    } catch (error) {
      console.log('=== ERROR en generateTournamentBracket ===');
      console.log('Error completo:', error);
      console.log('Error message:', error.message);
      console.log('Error stack:', error.stack);
      throw new BadRequestException(`Error al generar bracket automático: ${error.message}`);
    }
  }

  /**
   * Obtener datos del bracket por ID de torneo string
   */
  async getBracketDataByStringId(tournamentId: string) {
    try {
      const numericTournamentId = Math.abs(tournamentId.hashCode());
      
      // Buscar el stage que corresponde a este torneo
      const stages = await this.manager.storage.select('stage', { tournament_id: numericTournamentId });
      if (!stages || stages.length === 0) {
        throw new BadRequestException('No se encontró bracket para este torneo');
      }
      
      const stageId = Number(stages[0].id);
      return await this.getBracketData(stageId);
    } catch (error) {
      throw new BadRequestException(`Error al obtener datos del bracket: ${error.message}`);
    }
  }

  /**
   * Obtener matches por ID de torneo string
   */
  async getMatchesByStringId(tournamentId: string) {
    try {
      const numericTournamentId = Math.abs(tournamentId.hashCode());
      
      // Buscar el stage que corresponde a este torneo
      const stages = await this.manager.storage.select('stage', { tournament_id: numericTournamentId });
      if (!stages || stages.length === 0) {
        throw new BadRequestException('No se encontró bracket para este torneo');
      }
      
      const stageId = Number(stages[0].id);
      return await this.getMatches(stageId);
    } catch (error) {
      throw new BadRequestException(`Error al obtener matches: ${error.message}`);
    }
  }

  /**
   * Obtener estadísticas por ID de torneo string
   */
  async getTournamentStatsByStringId(tournamentId: string) {
    try {
      const numericTournamentId = Math.abs(tournamentId.hashCode());
      
      // Buscar el stage que corresponde a este torneo
      const stages = await this.manager.storage.select('stage', { tournament_id: numericTournamentId });
      if (!stages || stages.length === 0) {
        throw new BadRequestException('No se encontró bracket para este torneo');
      }
      
      const stageId = Number(stages[0].id);
      return await this.getTournamentStats(stageId);
    } catch (error) {
      throw new BadRequestException(`Error al obtener estadísticas: ${error.message}`);
    }
  }

  /**
   * Resetear torneo por ID de torneo string
   */
  async resetTournamentByStringId(tournamentId: string) {
    try {
      const numericTournamentId = Math.abs(tournamentId.hashCode());
      
      // Buscar el stage que corresponde a este torneo
      const stages = await this.manager.storage.select('stage', { tournament_id: numericTournamentId });
      if (!stages || stages.length === 0) {
        throw new BadRequestException('No se encontró bracket para este torneo');
      }
      
      const stageId = Number(stages[0].id);
      return await this.resetTournament(stageId);
    } catch (error) {
      throw new BadRequestException(`Error al resetear torneo: ${error.message}`);
    }
  }
}
