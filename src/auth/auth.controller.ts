import { Body, Controller, Delete, Get, HttpCode, HttpStatus, NotFoundException, Param, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthDto } from './auth.dto';
import { AuthService } from './auth.service';
import { AccessTokenGuard } from '../common/guards/accessToken.guard';
import { RefreshTokenGuard } from '../common/guards/refreshToken.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { CreateUserDto } from '../users/users.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @ApiOperation({ summary: 'Registrar um novo usuário' })
  @ApiResponse({ status: 201, description: 'Usuário criado com sucesso.' })
  @ApiResponse({ status: 400, description: 'Dados inválidos.' })
  @ApiResponse({ status: 409, description: 'Telefone ou Email já cadastrados.' })
  @ApiBody({ type: CreateUserDto })
  async signup(@Body() body: CreateUserDto) {
    return await this.authService.signup(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK) // 200
  @ApiOperation({ summary: 'Autenticar usuário e obter tokens' })
  @ApiResponse({ status: 200, description: 'Login realizado com sucesso.' })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas.' })
  @ApiBody({ type: AuthDto })
  async login(@Body() body: AuthDto) {
    return await this.authService.login(body);
  }

  @UseGuards(AccessTokenGuard)
  @Get('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Encerrar sessão (Logout)' })
  @ApiResponse({ status: 200, description: 'Logout realizado com sucesso.' })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  async logout(@Res({ passthrough: true }) res, @Req() req) {
    await this.authService.logout(req.user['id']);

    res.clearCookie(process.env.REFRESH_TOKEN).clearCookie(process.env.ACCESS_TOKEN).status(200);
  }

  @UseGuards(RefreshTokenGuard)
  @Get('refresh')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Renovar Access Token usando Refresh Token' })
  @ApiResponse({ status: 200, description: 'Tokens renovados com sucesso.' })
  @ApiResponse({ status: 401, description: 'Refresh token inválido ou expirado.' })
  async refreshTokens(@Res({ passthrough: true }) res, @Req() req) {
    const { accessToken, refreshToken } = await this.authService.refreshTokens(req['user'].id);
    res
      .cookie(process.env.ACCESS_TOKEN, accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
        maxAge: 30 * 60 * 1000,
      })
      .cookie(process.env.REFRESH_TOKEN, refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
      })
      .status(200);
  }
}
