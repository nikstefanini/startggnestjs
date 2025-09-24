import { Module, forwardRef } from '@nestjs/common';
import { BracketsService } from './brackets.service';
import { BracketsController } from './brackets.controller';
import { WebsocketGateway } from '../websocket/websocket.gateway';

@Module({
  providers: [BracketsService, WebsocketGateway],
  controllers: [BracketsController],
  exports: [BracketsService, WebsocketGateway],
})
export class BracketsModule {}
