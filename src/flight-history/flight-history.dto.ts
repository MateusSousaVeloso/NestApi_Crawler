import { IsOptional, IsString, IsDateString, IsNumberString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FlightHistoryFilterDto {
  @ApiPropertyOptional({ example: 'GRU', description: 'Filtrar por aeroporto de origem (IATA)' })
  @IsString()
  @IsOptional()
  origin?: string;

  @ApiPropertyOptional({ example: 'MIA', description: 'Filtrar por aeroporto de destino (IATA)' })
  @IsString()
  @IsOptional()
  destination?: string;

  @ApiPropertyOptional({ example: '2026-02-01', description: 'Data de voo inicial (YYYY-MM-DD)' })
  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-03-31', description: 'Data de voo final (YYYY-MM-DD)' })
  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @ApiPropertyOptional({ example: 'Smiles', description: 'Filtrar por provedor (Smiles)' })
  @IsString()
  @IsOptional()
  provider?: string;

  @ApiPropertyOptional({ example: 'COPA', description: 'Filtrar por companhia aerea' })
  @IsString()
  @IsOptional()
  airline?: string;

  @ApiPropertyOptional({ example: '0', description: 'Filtrar por numero de paradas (0=direto, 1, 2)' })
  @IsNumberString()
  @IsOptional()
  stops?: string;

  @ApiPropertyOptional({ example: 'ECONOMIC', description: 'Filtrar por classe (ECONOMIC, BUSINESS, FIRST, PREMIUM_ECONOMIC)' })
  @IsString()
  @IsOptional()
  cabin?: string;

  @ApiPropertyOptional({ example: 'abc123', description: 'Cursor (id do último item) para paginação por keyset' })
  @IsString()
  @IsOptional()
  cursor?: string;

  @ApiPropertyOptional({ example: '20', description: 'Itens por página (padrão 20, máx 100)' })
  @IsNumberString()
  @IsOptional()
  take?: string;
}
