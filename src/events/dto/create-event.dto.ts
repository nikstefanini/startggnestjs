import { EventStatus, BracketType, TournamentFormat, TournamentType } from '@prisma/client';
import { IsString, IsOptional, IsEnum, IsNumber, IsDateString } from 'class-validator';

export class CreateEventDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsString()
  game: string;

  @IsEnum(TournamentFormat)
  format: TournamentFormat;

  @IsEnum(TournamentType)
  type: TournamentType;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @IsOptional()
  @IsEnum(BracketType)
  bracketType?: BracketType;

  @IsOptional()
  @IsString()
  startingPhase?: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  maxEntrants?: number;

  @IsOptional()
  @IsNumber()
  entryFee?: number;

  @IsString()
  tournamentId: string;
}