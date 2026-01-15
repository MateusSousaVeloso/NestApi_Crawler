import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JWT_CONSTANTS_TOKEN } from '../constants';
import type { JwtConstants } from '../constants';
type JwtPayload = {
  id: string;
  email: string;
};

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(@Inject(JWT_CONSTANTS_TOKEN) private constants: JwtConstants) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: constants.access_token_secret,
    });
  }

  validate(payload: JwtPayload) {
    return payload;
  }
}
