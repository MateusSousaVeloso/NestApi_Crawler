import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AuthDto {
  @ApiProperty({ 
    example: 'mateuspantera2409@gmail.com', 
    description: 'Email cadastrado do usuário' 
  })
  @IsNotEmpty({ message: 'Email não pode ser vazio.' })
  @IsString({ message: 'Email deve ser um texto.' })
  @IsEmail({}, { message: 'Formato de email inválido.' })
  email: string;

  @ApiProperty({ 
    example: 'Mateus-2409', 
    description: 'Senha de acesso',
  })
  @IsNotEmpty({ message: 'Senha não pode ser vazia.' })
  @IsString({ message: 'Senha deve ser um texto.' })
  password: string;
}