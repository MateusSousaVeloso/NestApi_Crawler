import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from 'src/users/users.module';
import { AccessTokenStrategy } from './strategies/accessToken.strategy';
import { RefreshTokenStrategy } from './strategies/refreshToken.strategy';
import { PrismaService } from 'src/database/prisma.service';
import { jwtConstantsFactory, JWT_CONSTANTS_TOKEN, JwtConstants } from './constants'; // <--- Importe

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      imports: [AuthModule],
      useFactory: async (constants: JwtConstants) => ({
        secret: constants.access_token_secret
      }),
      inject: [JWT_CONSTANTS_TOKEN],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccessTokenStrategy,
    RefreshTokenStrategy,
    PrismaService,
    {
      provide: JWT_CONSTANTS_TOKEN,
      useFactory: jwtConstantsFactory,
      inject: [ConfigService],
    },
  ],
  exports: [JWT_CONSTANTS_TOKEN],
})
export class AuthModule {}
