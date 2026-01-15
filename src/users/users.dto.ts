import { IsString, IsNotEmpty, IsEmail, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'Usúario Nome', description: 'Nome completo do usuário' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '+55 (11) 91234-1234', description: 'Telefone com DDD' })
  @IsString()
  @IsNotEmpty()
  phone_number: string;

  @ApiProperty({ example: 'usuario@email.com', description: 'Email único' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'SenhaForte123!', description: 'Senha de acesso' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({ example: { airline: 'LATAM' } })
  @IsObject()
  @IsOptional()
  preferences?: Record<string, any>;
}

export class PreferencesDTO {
  @ApiProperty({ example: { loyalty_program: 'Smiles' } })
  @IsObject()
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