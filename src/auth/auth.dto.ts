import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AuthDto {
  @ApiProperty({ 
    example: 'usuario@email.com', 
    description: 'Email cadastrado do usuário' 
  })
  @IsNotEmpty({ message: 'Email não pode ser vazio.' })
  @IsString({ message: 'Email deve ser um texto.' })
  @IsEmail({}, { message: 'Formato de email inválido.' })
  email: string;

  @ApiProperty({ 
    example: 'SenhaForte123!', 
    description: 'Senha de acesso',
    minLength: 6 
  })
  @IsNotEmpty({ message: 'Senha não pode ser vazia.' })
  @IsString({ message: 'Senha deve ser um texto.' })
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres.' })
  password: string;
}