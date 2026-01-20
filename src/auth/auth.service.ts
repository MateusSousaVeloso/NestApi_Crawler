import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { AuthDto } from './auth.dto';
import { CreateUserDto } from '../users/users.dto';
import { JWT_CONSTANTS_TOKEN } from './constants';
import type { JwtConstants } from './constants';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @Inject(JWT_CONSTANTS_TOKEN) private constants: JwtConstants
  ) {}  

  async signup(data: CreateUserDto) {
    const user = await this.usersService.create(data);
    const { accessToken, refreshToken } = await this.getTokens(user.id, user.email);
    return { accessToken, refreshToken };
  }

  async login(data: AuthDto) {
    const user = await this.usersService.findForAuth(data.email);
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const passwordMatch = await bcrypt.compare(data.password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const { accessToken, refreshToken } = await this.getTokens(user.id, user.email);
    return { accessToken, refreshToken };
  }

  async getTokens(id: string, email: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync({ id, email }, { secret: this.constants.access_token_secret, expiresIn: '30m' }),
      this.jwtService.signAsync({ id, email }, { secret: this.constants.refresh_token_secret }),
    ]);

    return { accessToken, refreshToken };
  }

  async refreshTokens(id: string) {
    const user = await this.usersService.findById(id);
    if (!user) throw new BadRequestException('Nenhum usuário encontrado!');

    const { accessToken, refreshToken } = await this.getTokens(user.id, user.email);
    return { accessToken, refreshToken };
  }

  async logout(id: string) {
    const user = await this.usersService.findById(id);
    if (!user) throw new BadRequestException('Algo deu errado ao deslogar!');
    return true;
  }
}
