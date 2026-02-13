import { IsOptional, IsString, IsDateString } from 'class-validator';
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

  @ApiPropertyOptional({ example: 'Smiles', description: 'Filtrar por provedor (Smiles, Azul)' })
  @IsString()
  @IsOptional()
  provider?: string;
}
