import { Module, forwardRef } from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { TournamentsController } from './tournaments.controller';
import { PrismaModule } from '../common/prisma/prisma.module';
import { BracketsModule } from '../brackets/brackets.module';
import { StartggModule } from '../startgg/startgg.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => BracketsModule),
    StartggModule,
  ],
  controllers: [TournamentsController],
  providers: [TournamentsService],
  exports: [TournamentsService],
})
export class TournamentsModule {}
