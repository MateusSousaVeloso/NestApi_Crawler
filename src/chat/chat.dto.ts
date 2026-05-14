import { IsString, IsNotEmpty, IsOptional, IsNumberString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ example: 'Quero viajar de GRU para MIA', description: 'Mensagem do usuário' })
  @IsString()
  @IsNotEmpty()
  content: string;
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
