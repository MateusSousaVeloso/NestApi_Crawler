import { IsNotEmpty, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubscribeDto {
  @ApiProperty({ 
    example: 1, 
    description: 'ID do plano que o usuário deseja assinar (1: Premium Mensal, 2: Premium Trimestral, 3: Premium Anual)' 
  })
  @IsInt()
  @IsNotEmpty()
  planId: number;
}