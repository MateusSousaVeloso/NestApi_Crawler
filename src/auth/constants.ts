import { ConfigService } from '@nestjs/config';

export const JWT_CONSTANTS_TOKEN = 'JWT_CONSTANTS';

export interface JwtConstants {
  access_token_secret: string;
  refresh_token_secret: string;
}

export const jwtConstantsFactory = (configService: ConfigService): JwtConstants => {
  const accessSecret = configService.get<string>('ACCESS_TOKEN_SECRET');
  const refreshSecret = configService.get<string>('REFRESH_TOKEN_SECRET');

  if (!accessSecret || !refreshSecret) {
    throw new Error(
      'FATAL ERROR: As variáveis ACCESS_TOKEN_SECRET ou REFRESH_TOKEN_SECRET não estão configuradas no .env',
    );
  }

  return {
    access_token_secret: accessSecret,
    refresh_token_secret: refreshSecret,
  };
};