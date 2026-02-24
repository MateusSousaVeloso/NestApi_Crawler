import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JWT_CONSTANTS_TOKEN } from '../constants';
import type { JwtConstants } from '../constants';
import { UsersService } from '../../users/users.service';

type JwtPayload = {
  id: string;
  email: string;
  hashedToken: string;
};

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @Inject(JWT_CONSTANTS_TOKEN) private constants: JwtConstants,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: constants.access_token_secret,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findByIdWithToken(payload.id);

    if (!user.token) {
      throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
    }

    const isTokenValid = payload.hashedToken === user.token;
    if (!isTokenValid) {
      await this.usersService.updateToken(payload.id, null);
      throw new UnauthorizedException('Token inválido. Sessão revogada por segurança.');
    }

    return { id: payload.id, email: payload.email };
  }
}
