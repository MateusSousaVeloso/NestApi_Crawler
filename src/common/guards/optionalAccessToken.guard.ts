import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalAccessTokenGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any, context: any) {
    return user;
  }
}
