import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { BracketsModule } from '../brackets/brackets.module';
import { StartggModule } from '../startgg/startgg.module';

@Module({
  imports: [PrismaModule, BracketsModule, StartggModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService]
})
export class EventsModule {}
