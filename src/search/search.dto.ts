import { IsString, IsNotEmpty, IsOptional, IsDateString, IsEnum, IsBoolean, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional({ enum: CabinClass, default: CabinClass.ALL, description: 'Classe da cabine' })
  @IsEnum(CabinClass)
  @IsOptional()
  cabin?: CabinClass = CabinClass.ALL;

  @ApiPropertyOptional({ enum: OrderBy, default: OrderBy.PRECO, description: 'Ordenação dos resultados' })
  @IsEnum(OrderBy)
  @IsOptional()
  orderBy?: OrderBy = OrderBy.PRECO;
}

export class SmilesSearchDto extends FlightSearchDto {}
export class AzulSearchDto extends FlightSearchDto {}
export class QatarSearchDto extends FlightSearchDto {}
export class IberiaSearchDto extends FlightSearchDto {}
export class TapSearchDto extends FlightSearchDto {}
export class FinnairSearchDto extends FlightSearchDto {}
export class AirEuropaSearchDto extends FlightSearchDto {}
export class AASearchDto extends FlightSearchDto {}
export class CopaSearchDto extends FlightSearchDto {}
