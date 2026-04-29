import { IsString, IsNotEmpty, IsOptional, IsNumberString, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class SendMessageDto {
  @ApiProperty({ example: 'Quero viajar de GRU para MIA', description: 'Mensagem do usuário' })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class ImportMessageDto {
  @ApiProperty({ example: 'user', enum: ['user', 'assistant'] })
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiProperty({ example: 'Olá, como posso te ajudar?' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ example: 1700000000000, description: 'Timestamp em ms' })
  @IsOptional()
  timestamp?: number;
}

export class ImportMessagesDto {
  @ApiProperty({ type: [ImportMessageDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportMessageDto)
  messages: ImportMessageDto[];
}

export class GetMessagesDto {
  @ApiPropertyOptional({ description: 'Cursor (id da mensagem mais antiga carregada)' })
  @IsString()
  @IsOptional()
  cursor?: string;

  @ApiPropertyOptional({ description: 'Mensagens por página (padrão 50, máx 100)' })
  @IsNumberString()
  @IsOptional()
  take?: string;
}
