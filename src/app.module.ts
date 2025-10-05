import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './common/prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { TournamentsModule } from './modules/tournaments/tournaments.module';
import { EventsModule } from './modules/events/events.module';
import { BracketsModule } from './brackets/brackets.module';
import { WebsocketGateway } from './websocket/websocket.gateway';
import { UsersModule } from './users/users.module';
import { MatchesModule } from './matches/matches.module';
import { WebsocketModule } from './websocket/websocket.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    TournamentsModule,
    EventsModule,
    BracketsModule,
    UsersModule,
    MatchesModule,
    WebsocketModule,
  ],
  controllers: [AppController],
  providers: [AppService, WebsocketGateway],
})
export class AppModule {}