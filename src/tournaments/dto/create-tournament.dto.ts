import { TournamentFormat, TournamentType, TournamentStatus } from '@prisma/client';
import { IsString, IsOptional, IsEnum, IsBoolean, IsNumber, IsDateString } from 'class-validator';

export class CreateTournamentDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  game: string;

  @IsEnum(TournamentFormat)
  format: TournamentFormat;

  @IsEnum(TournamentType)
  type: TournamentType;

  @IsOptional()
  @IsEnum(TournamentStatus)
  status?: TournamentStatus;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  registrationOpen?: boolean;

  @IsOptional()
  @IsDateString()
  registrationStart?: string;

  @IsOptional()
  @IsDateString()
  registrationEnd?: string;

  @IsOptional()
  @IsNumber()
  maxParticipants?: number;

  @IsOptional()
  @IsNumber()
  entryFee?: number;

  @IsOptional()
  @IsString()
  venue?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsString()
  organizerId?: string;
}