import { IsString, IsNotEmpty, IsEmail, IsOptional, IsObject, Matches, MinLength } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

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

  @ApiProperty({ example: 'Mateus-2409', description: 'Senha de acesso (mínimo 8 caracteres, 1 maiúscula, 1 minúscula, 1 caractere especial)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Senha deve ter no mínimo 8 caracteres.' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/, {
    message: 'Senha deve conter pelo menos 1 letra maiúscula, 1 minúscula e 1 caractere especial.',
  })
  password: string;

  @ApiProperty({
    example: { loyalty_programs: ['LATAM Pass', 'Smiles'], document_cpf: '123.456.789-00' },
    description: 'Preferências do usuário em formato JSON',
  })
  @IsObject()
  @IsOptional()
  preferences: Record<string, any>;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiProperty({
    example: 'SenhaAtual-123!',
    description: 'Senha atual — obrigatória ao alterar senha ou email.',
    required: false,
  })
  @IsString()
  @IsOptional()
  currentPassword?: string;
}
