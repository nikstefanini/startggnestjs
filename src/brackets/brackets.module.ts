import { Module, forwardRef } from '@nestjs/common';
import { BracketsService } from './brackets.service';
import { BracketsController } from './brackets.controller';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { TournamentsModule } from '../modules/tournaments/tournaments.module';

@Module({
  imports: [
    forwardRef(() => TournamentsModule)
  ],
  providers: [BracketsService, WebsocketGateway],
  controllers: [BracketsController],
  exports: [BracketsService, WebsocketGateway],
})
export class BracketsModule {}
