import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum UserSearchStatusFilter {
  PENDING = 'pending',
  DOING = 'doing',
  DONE = 'done',
  ERROR = 'error',
}

export class ListUserSearchesDto {
  @ApiPropertyOptional({ enum: UserSearchStatusFilter, description: 'Filtra por status' })
  @IsEnum(UserSearchStatusFilter)
  @IsOptional()
  status?: UserSearchStatusFilter;

  @ApiPropertyOptional({ example: 'smiles', description: 'Provider (smiles, azul, qatar, iberia, tap)' })
  @IsOptional()
  provider?: string;

  @ApiPropertyOptional({ example: '20', description: 'Itens por página (padrão 20, máx 100)' })
  @IsOptional()
  take?: string;

  @ApiPropertyOptional({ description: 'id do último item da página anterior' })
  @IsOptional()
  cursor?: string;
}

export type CrawlerProvider = 'smiles' | 'azul' | 'qatar' | 'iberia' | 'tap';
