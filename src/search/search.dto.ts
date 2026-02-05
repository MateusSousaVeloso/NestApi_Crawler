import { IsString, IsNotEmpty, IsObject, IsUUID, IsOptional, IsInt, Min, IsDateString, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class DispatchSearchDto {
  @IsUUID()
  user_id: string;

  @IsObject()
  search_params: {
    trip_type: 'one_way' | 'round_trip';
    origin: string;
    destination: string;
    dates: { departure_date: string; return_date?: string };
    passengers: { adults: number; children: number; infants: number };
    preferences: Record<string, any>;
  };
}

export enum CabinClass {
  ALL = 'ALL',
  ECONOMY = 'ECONOMY',
  BUSINESS = 'BUSINESS',
  FIRST = 'FIRST',
}

export class FlightSearchDto {
  @ApiProperty({ example: 'GRU', description: 'Código IATA do aeroporto de origem' })
  @IsString()
  @IsNotEmpty()
  origin: string;

  @ApiProperty({ example: 'MIA', description: 'Código IATA do aeroporto de destino' })
  @IsString()
  @IsNotEmpty()
  destination: string;

  @ApiProperty({ example: '2026-03-19', description: 'Data de partida (YYYY-MM-DD)' })
  @IsDateString()
  @IsNotEmpty()
  departureDate: string;

  @ApiPropertyOptional({ example: '2026-04-23', description: 'Data de retorno (YYYY-MM-DD) - opcional para ida e volta' })
  @IsDateString()
  @IsOptional()
  returnDate?: string;

  @ApiProperty({ example: 1, description: 'Número de adultos', default: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  adults: number = 1;

  @ApiProperty({ example: 0, description: 'Número de crianças', default: 0 })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  children: number = 0;

  @ApiProperty({ example: 0, description: 'Número de bebês', default: 0 })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  infants: number = 0;

  @ApiPropertyOptional({ enum: CabinClass, default: CabinClass.ALL, description: 'Classe da cabine' })
  @IsEnum(CabinClass)
  @IsOptional()
  cabin?: CabinClass = CabinClass.ALL;
}

export class SmilesSearchDto extends FlightSearchDto {
  @ApiPropertyOptional({ example: '', description: 'Número de membro Smiles (opcional)' })
  @IsString()
  @IsOptional()
  memberNumber?: string;
}

export class AzulSearchDto extends FlightSearchDto {
  @ApiPropertyOptional({ example: 3, description: 'Dias de flexibilidade para a esquerda', default: 3 })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  flexDaysLeft?: number = 3;

  @ApiPropertyOptional({ example: 3, description: 'Dias de flexibilidade para a direita', default: 3 })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  flexDaysRight?: number = 3;
}
