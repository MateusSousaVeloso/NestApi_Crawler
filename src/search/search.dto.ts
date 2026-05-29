import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsDateString, IsEnum, IsBoolean } from 'class-validator';
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

// Datas computadas uma vez no carregamento do módulo para preencher defaults
function nextMonthDate(extraDays = 0): string {
  const d = new Date();
  // mes + 1
  d.setMonth(d.getMonth() + 1);
  if (extraDays) d.setDate(d.getDate() + extraDays);
  return d.toISOString().split('T')[0];
}
const DEP_DATE_EXAMPLE = nextMonthDate();
// dia final + 3
const FIN_DATE_EXAMPLE = nextMonthDate(3);

export class FlightSearchDto {
  @ApiProperty({ example: 'GRU', description: 'Código IATA do aeroporto de origem' })
  @IsString()
  @IsNotEmpty()
  origin: string;

  @ApiProperty({ example: 'GRU', description: 'Código IATA do aeroporto de destino' })
  @IsString()
  @IsNotEmpty()
  destination: string;

  @ApiProperty({ example: DEP_DATE_EXAMPLE, description: 'Data inicial de partida (YYYY-MM-DD)' })
  @IsDateString()
  @IsNotEmpty()
  departureDate: string;

  @ApiPropertyOptional({
    example: FIN_DATE_EXAMPLE,
    description: 'Data final de partida (YYYY-MM-DD) - opcional para range de dias',
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
  @ApiProperty({ example: 'GRU' }) declare origin: string;
  @ApiProperty({ example: 'MIA' }) declare destination: string;

  @ApiPropertyOptional({ example: '', description: 'Número de membro Smiles (opcional)' })
  @IsString()
  @IsOptional()
  memberNumber?: string;
}

export class AzulSearchDto extends FlightSearchDto {
  @ApiProperty({ example: 'GRU' }) declare origin: string;
  @ApiProperty({ example: 'REC' }) declare destination: string;
}

export class QatarSearchDto extends FlightSearchDto {
  @ApiProperty({ example: 'GRU' }) declare origin: string;
  @ApiProperty({ example: 'DOH' }) declare destination: string;

  @ApiProperty({ example: FIN_DATE_EXAMPLE, description: 'Data de retorno (YYYY-MM-DD)' })
  @IsDateString()
  @IsNotEmpty()
  declare finalDate: string;
}

export class IberiaSearchDto extends FlightSearchDto {
  @ApiProperty({ example: 'GRU' }) declare origin: string;
  @ApiProperty({ example: 'MAD' }) declare destination: string;
}

export class TapSearchDto extends FlightSearchDto {
  @ApiProperty({ example: 'GRU' }) declare origin: string;
  @ApiProperty({ example: 'LIS' }) declare destination: string;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  youth?: number = 0;

  @ApiPropertyOptional({ example: true, default: true, description: 'Buscar com milhas' })
  @IsBoolean()
  @IsOptional()
  award?: boolean = true;

  @ApiPropertyOptional({ example: false, default: false })
  @IsBoolean()
  @IsOptional()
  stopover?: boolean = false;
}
