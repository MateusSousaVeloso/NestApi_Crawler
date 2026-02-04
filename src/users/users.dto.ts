import { IsString, IsNotEmpty, IsEmail, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'Mateus', description: 'Nome completo do usuário' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '5511949381549', description: 'Telefone com DDD' })
  @IsString()
  @IsNotEmpty()
  phone_number: string;

  @ApiProperty({ example: 'mateuspantera2409@gmail.com', description: 'Email único' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Mateus-2409', description: 'Senha de acesso' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    example: { loyalty_programs: ['LATAM Pass', 'Smiles'], document_cpf: '123.456.789-00' },
    description: 'Preferências do usuário em formato JSON',
  })
  @IsObject()
  @IsOptional()
  preferences: Record<string, any>;
}

export class UpdateSubscriptionDto {
  @IsString()
  status: string;

  @IsString()
  plan_tier: string;

  @IsString()
  expiration_date: string;

  @IsString()
  transaction_id: string;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {}
