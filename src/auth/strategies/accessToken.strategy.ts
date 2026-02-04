import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JWT_CONSTANTS_TOKEN } from '../constants';
import type { JwtConstants } from '../constants';
import { UsersService } from '../../users/users.service';
import { createHash } from 'crypto';

type JwtPayload = {
  id: string;
  email: string;
  tokenHash: string;
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

    const currentHash = createHash('sha256').update(user.token).digest('hex').substring(0, 16);

    if (payload.tokenHash !== currentHash) {
      throw new UnauthorizedException('Sessão invalidada. Foi feito login em outro dispositivo.');
    }

    return payload;
  }
}
