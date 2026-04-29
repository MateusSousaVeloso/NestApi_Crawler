import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UseGuards, Headers } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response, Request } from 'express';
import { AuthDto } from './auth.dto';
import { AuthService } from './auth.service';
import { AccessTokenGuard } from '../common/guards/accessToken.guard';
import { RefreshTokenGuard } from '../common/guards/refreshToken.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { CreateUserDto } from '../users/users.dto';

function setCookies(res: Response, accessToken: string, refreshToken: string) {
  const isProduction = process.env.NODE_ENV === 'production';
  res
    .cookie(process.env.ACCESS_TOKEN || 'access_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 30 * 60 * 1000,
    })
    .cookie(process.env.REFRESH_TOKEN || 'refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict', // strict: nunca enviado em requisições cross-site
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @Throttle({ auth: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Registrar um novo usuário' })
  @ApiResponse({ status: 201, description: 'Usuário criado com sucesso.' })
  @ApiResponse({ status: 400, description: 'Dados inválidos.' })
  @ApiResponse({ status: 409, description: 'Telefone ou Email já cadastrados.' })
  @ApiBody({ type: CreateUserDto })
  async signup(@Body() body: CreateUserDto, @Res({ passthrough: true }) res: Response, @Req() req: Request) {
    const userAgent = req.headers?.['user-agent'] as string | undefined;
    const forwarded = req.headers?.['x-forwarded-for'] as string | undefined;
    const ipAddress = forwarded?.split(',')[0]?.trim() ?? req.ip;
    const { accessToken, refreshToken } = await this.authService.signup(body, userAgent, ipAddress);
    setCookies(res, accessToken, refreshToken);
    return { message: 'Conta criada com sucesso.' };
  }

  @Post('login')
  @Throttle({ auth: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autenticar usuário e obter tokens' })
  @ApiResponse({ status: 200, description: 'Login realizado com sucesso.' })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas.' })
  @ApiBody({ type: AuthDto })
  async login(@Body() body: AuthDto, @Res({ passthrough: true }) res: Response, @Req() req: Request) {
    const userAgent = (req as any).headers?.['user-agent'] as string | undefined;
    const forwarded = (req as any).headers?.['x-forwarded-for'] as string | undefined;
    const ipAddress = forwarded?.split(',')[0]?.trim() ?? (req as any).ip;
    const { accessToken, refreshToken } = await this.authService.login(body, userAgent, ipAddress);
    setCookies(res, accessToken, refreshToken);
    return { message: 'Login realizado com sucesso.' };
  }

  @UseGuards(AccessTokenGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Encerrar sessão (Logout)' })
  @ApiResponse({ status: 200, description: 'Logout realizado com sucesso.' })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  async logout(@Res({ passthrough: true }) res: Response, @Req() req: Request) {
    await this.authService.logout((req.user as any)['id']);
    res
      .clearCookie(process.env.ACCESS_TOKEN || 'access_token')
      .clearCookie(process.env.REFRESH_TOKEN || 'refresh_token');
    return { message: 'Logout realizado com sucesso.' };
  }

  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  @Throttle({ auth: { ttl: 60000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Renovar Access Token usando Refresh Token' })
  @ApiResponse({ status: 200, description: 'Tokens renovados com sucesso.' })
  @ApiResponse({ status: 401, description: 'Refresh token inválido ou expirado.' })
  async refreshTokens(@Res({ passthrough: true }) res: Response, @Req() req: Request) {
    const { accessToken, refreshToken } = await this.authService.refreshTokens((req as any)['user'].id);
    setCookies(res, accessToken, refreshToken);
    return { message: 'Tokens renovados com sucesso.' };
  }
}
