import { Module } from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { TournamentsController } from './tournaments.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { BracketsModule } from '../../brackets/brackets.module';

@Module({
  imports: [PrismaModule, BracketsModule],
  controllers: [TournamentsController],
  providers: [TournamentsService],
  exports: [TournamentsService],
})
export class TournamentsModule {}