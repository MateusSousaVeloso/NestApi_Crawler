import { IsEmail, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';
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
    example: 'Mateus@2409',
    description: 'Senha de acesso (mínimo 8 caracteres, 1 maiúscula, 1 minúscula, 1 caractere especial)',
  })
  @IsNotEmpty({ message: 'Senha não pode ser vazia.' })
  @IsString({ message: 'Senha deve ser um texto.' })
  @MinLength(8, { message: 'Senha deve ter no mínimo 8 caracteres.' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/, {
    message: 'Senha deve conter pelo menos 1 letra maiúscula, 1 minúscula e 1 caractere especial.',
  })
  password: string;
}