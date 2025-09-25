import { Module, forwardRef } from '@nestjs/common';
import { TournamentsController } from './tournaments.controller';
import { TournamentsService } from './tournaments.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { BracketsModule } from '../brackets/brackets.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => BracketsModule)
  ],
  controllers: [TournamentsController],
  providers: [TournamentsService],
  exports: [TournamentsService]
})
export class TournamentsModule {}
