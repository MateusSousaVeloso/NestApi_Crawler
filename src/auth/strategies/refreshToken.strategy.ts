import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JWT_CONSTANTS_TOKEN } from '../constants';
import type { JwtConstants } from '../constants';
import { UsersService } from '../../users/users.service';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    @Inject(JWT_CONSTANTS_TOKEN) private constants: JwtConstants,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: constants.refresh_token_secret,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    const refreshToken = req.get('Authorization')?.replace('Bearer', '').trim();
    if (!refreshToken) {
      throw new ForbiddenException();
    }

    const user = await this.usersService.findByIdWithToken(payload.id);

    if (!user.token) {
      throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
    }

    if (user.token !== refreshToken) {
      await this.usersService.updateToken(payload.id, null);
      throw new UnauthorizedException('Token inválido. Sessão revogada por segurança.');
    }

    return { ...payload, refreshToken };
  }
}
