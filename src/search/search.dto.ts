import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsDateString, IsEnum, IsBoolean, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum CabinClass {
  ALL = 'ALL',
  ECONOMIC = 'ECONOMIC',
  BUSINESS = 'BUSINESS',
  FIRST = 'FIRST',
}

export enum OrderBy {
  PRECO = 'preco',
  CUSTO_BENEFICIO = 'custo_beneficio',
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

  @ApiProperty({ example: '2026-05-19', description: 'Data inicial de partida (YYYY-MM-DD)' })
  @IsDateString()
  @IsNotEmpty()
  departureDate: string;

  @ApiPropertyOptional({
    example: '2026-05-21',
    description: 'Data final de partida (YYYY-MM-DD) - opcional para pesquisar voo de um range de dias',
  })
  @IsDateString()
  @IsOptional()
  finalDate?: string;

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

  @ApiPropertyOptional({ enum: OrderBy, default: OrderBy.PRECO, description: 'Ordenação dos resultados' })
  @IsEnum(OrderBy)
  @IsOptional()
  orderBy?: OrderBy = OrderBy.PRECO;
}

export class SmilesSearchDto extends FlightSearchDto {
  @ApiPropertyOptional({ example: '', description: 'Número de membro Smiles (opcional)' })
  @IsString()
  @IsOptional()
  memberNumber?: string;
}

export class AzulSearchDto extends FlightSearchDto {}

export class QatarSearchDto extends FlightSearchDto {
  @ApiProperty({ example: '2026-06-22', description: 'Data de retorno (YYYY-MM-DD)' })
  @IsDateString()
  @IsNotEmpty()
  declare finalDate: string;
}

export class IberiaSearchDto {
  @ApiProperty({ example: 'SAO' })
  @IsString()
  @IsNotEmpty()
  origin: string;

  @ApiProperty({ example: 'MAD' })
  @IsString()
  @IsNotEmpty()
  destination: string;

  @ApiProperty({ example: '2026-06-15', description: 'Data de partida (YYYY-MM-DD)' })
  @IsDateString()
  @IsNotEmpty()
  departureDate: string;

  @ApiProperty({ example: 1, default: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  adults: number = 1;

  @ApiProperty({ example: 0, default: 0 })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  children: number = 0;

  @ApiProperty({ example: 0, default: 0 })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  infants: number = 0;
}

export class TapSearchDto extends FlightSearchDto {
  // departureDate/finalDate em YYYY-MM-DD herdados de FlightSearchDto.
  // O crawler TAP (milhas2) faz date-range one-way e normaliza o formato internamente.
  @ApiProperty({ example: 0, default: 0, description: 'Número de jovens' })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  youth: number = 0;
}
