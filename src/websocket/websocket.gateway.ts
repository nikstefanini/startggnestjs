import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

interface JoinTournamentDto {
  tournamentId: number;
  userId?: string;
}

interface MatchUpdateDto {
  tournamentId: number;
  matchId: number;
  opponent1?: {
    score?: number;
    result?: 'win' | 'loss';
  };
  opponent2?: {
    score?: number;
    result?: 'win' | 'loss';
  };
}

interface BracketProgressionDto {
  tournamentId: number;
  roundId: number;
  completedMatches: number;
  totalMatches: number;
}

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:4200', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: '/brackets',
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('WebsocketGateway');
  private connectedClients: Map<string, Socket> = new Map();
  private tournamentRooms: Map<number, Set<string>> = new Map();

  handleConnection(client: Socket) {
    this.logger.log(`Cliente conectado: ${client.id}`);
    this.connectedClients.set(client.id, client);
    
    // Enviar mensaje de bienvenida
    client.emit('connection-established', {
      message: 'Conectado al servidor de brackets en tiempo real',
      clientId: client.id,
      timestamp: new Date().toISOString(),
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente desconectado: ${client.id}`);
    this.connectedClients.delete(client.id);
    
    // Remover cliente de todas las salas de torneos
    this.tournamentRooms.forEach((clients, tournamentId) => {
      if (clients.has(client.id)) {
        clients.delete(client.id);
        if (clients.size === 0) {
          this.tournamentRooms.delete(tournamentId);
        }
        this.logger.log(`Cliente ${client.id} removido del torneo ${tournamentId}`);
      }
    });
  }

  /**
   * Unirse a un torneo específico para recibir actualizaciones
   */
  @SubscribeMessage('join-tournament')
  handleJoinTournament(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinTournamentDto,
  ) {
    const { tournamentId, userId } = data;
    const roomName = `tournament-${tournamentId}`;
    
    // Unirse a la sala del torneo
    client.join(roomName);
    
    // Agregar cliente al mapa de salas
    if (!this.tournamentRooms.has(tournamentId)) {
      this.tournamentRooms.set(tournamentId, new Set());
    }
    this.tournamentRooms.get(tournamentId).add(client.id);
    
    this.logger.log(`Cliente ${client.id} se unió al torneo ${tournamentId}`);
    
    // Notificar al cliente que se unió exitosamente
    client.emit('tournament-joined', {
      tournamentId,
      message: `Te has unido al torneo ${tournamentId}`,
      timestamp: new Date().toISOString(),
    });
    
    // Notificar a otros usuarios en la sala
    client.to(roomName).emit('user-joined-tournament', {
      tournamentId,
      userId: userId || 'Usuario anónimo',
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      tournamentId,
      connectedUsers: this.tournamentRooms.get(tournamentId)?.size || 0,
    };
  }

  /**
   * Salir de un torneo
   */
  @SubscribeMessage('leave-tournament')
  handleLeaveTournament(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tournamentId: number; userId?: string },
  ) {
    const { tournamentId, userId } = data;
    const roomName = `tournament-${tournamentId}`;
    
    // Salir de la sala del torneo
    client.leave(roomName);
    
    // Remover cliente del mapa de salas
    if (this.tournamentRooms.has(tournamentId)) {
      this.tournamentRooms.get(tournamentId).delete(client.id);
      if (this.tournamentRooms.get(tournamentId).size === 0) {
        this.tournamentRooms.delete(tournamentId);
      }
    }
    
    this.logger.log(`Cliente ${client.id} salió del torneo ${tournamentId}`);
    
    // Notificar al cliente
    client.emit('tournament-left', {
      tournamentId,
      message: `Has salido del torneo ${tournamentId}`,
      timestamp: new Date().toISOString(),
    });
    
    // Notificar a otros usuarios en la sala
    client.to(roomName).emit('user-left-tournament', {
      tournamentId,
      userId: userId || 'Usuario anónimo',
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      tournamentId,
      connectedUsers: this.tournamentRooms.get(tournamentId)?.size || 0,
    };
  }

  /**
   * Métodos públicos para emitir eventos desde otros servicios
   */

  /**
   * Notificar actualización de match
   */
  emitMatchUpdate(matchUpdate: MatchUpdateDto) {
    const roomName = `tournament-${matchUpdate.tournamentId}`;
    
    this.server.to(roomName).emit('match-updated', {
      ...matchUpdate,
      timestamp: new Date().toISOString(),
    });
    
    this.logger.log(`Match ${matchUpdate.matchId} actualizado en torneo ${matchUpdate.tournamentId}`);
  }

  /**
   * Notificar progresión del bracket
   */
  emitBracketProgression(progression: BracketProgressionDto) {
    const roomName = `tournament-${progression.tournamentId}`;
    
    this.server.to(roomName).emit('bracket-progression', {
      ...progression,
      progress: (progression.completedMatches / progression.totalMatches) * 100,
      timestamp: new Date().toISOString(),
    });
    
    this.logger.log(`Progresión del bracket en torneo ${progression.tournamentId}: ${progression.completedMatches}/${progression.totalMatches}`);
  }

  /**
   * Notificar nuevo torneo creado
   */
  emitTournamentCreated(tournamentData: any) {
    this.server.emit('tournament-created', {
      tournament: tournamentData,
      timestamp: new Date().toISOString(),
    });
    
    this.logger.log(`Nuevo torneo creado: ${tournamentData.name}`);
  }

  /**
   * Notificar finalización de torneo
   */
  emitTournamentCompleted(tournamentId: number, winner: any) {
    const roomName = `tournament-${tournamentId}`;
    
    this.server.to(roomName).emit('tournament-completed', {
      tournamentId,
      winner,
      timestamp: new Date().toISOString(),
    });
    
    this.logger.log(`Torneo ${tournamentId} completado. Ganador: ${winner?.name || 'N/A'}`);
  }

  /**
   * Notificar error en tiempo real
   */
  emitError(tournamentId: number, error: string) {
    const roomName = `tournament-${tournamentId}`;
    
    this.server.to(roomName).emit('tournament-error', {
      tournamentId,
      error,
      timestamp: new Date().toISOString(),
    });
    
    this.logger.error(`Error en torneo ${tournamentId}: ${error}`);
  }

  /**
   * Obtener estadísticas de conexiones
   */
  getConnectionStats() {
    return {
      totalConnections: this.connectedClients.size,
      activeTournaments: this.tournamentRooms.size,
      tournamentRooms: Array.from(this.tournamentRooms.entries()).map(([tournamentId, clients]) => ({
        tournamentId,
        connectedUsers: clients.size,
      })),
    };
  }

  /**
   * Enviar mensaje de broadcast a todos los clientes
   */
  broadcastMessage(message: string, data?: any) {
    this.server.emit('broadcast', {
      message,
      data,
      timestamp: new Date().toISOString(),
    });
    
    this.logger.log(`Mensaje broadcast enviado: ${message}`);
  }
}
