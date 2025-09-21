import { IsString, IsOptional, IsDateString, IsNumber, IsEnum, Min, Max } from 'class-validator';
import { TournamentFormat, TournamentType, BracketType } from '@prisma/client';

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
  @IsEnum(BracketType)
  bracketType?: BracketType = BracketType.SINGLE_ELIMINATION;

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
  @Min(2)
  @Max(1024)
  maxEntrants?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  entryFee?: number;

  @IsString()
  tournamentId: string;
}