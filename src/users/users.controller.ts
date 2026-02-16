import { Controller, Get, Patch, Delete, Body, UseGuards, Req, NotFoundException, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './users.dto';
import { AccessTokenGuard } from '../common/guards/accessToken.guard';

@ApiTags('Users')
@Controller('user')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Obter dados do perfil logado' })
  @ApiResponse({ status: 200, description: 'Dados do usuário retornados.' })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  async findMe(@Req() req) {
    return this.usersService.findById(req.user.id);
  }

  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @Patch('me')
  @ApiOperation({ summary: 'Atualizar dados do usuário' })
  @ApiResponse({ status: 200, description: 'Dados atualizados com sucesso.' })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  @ApiResponse({ status: 404, description: 'Nenhum dado enviado para atualização.' })
  @ApiBody({ type: UpdateUserDto })
  async update(@Req() req, @Body() body: UpdateUserDto) {
    if (!body) throw new NotFoundException('Nenhum dado para atualizar.');
    return this.usersService.update(req.user.id, body);
  }

  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir a própria conta' })
  @ApiResponse({ status: 204, description: 'Conta excluída com sucesso.' })
  @ApiResponse({ status: 401, description: 'Não autorizado.' })
  async delete(@Req() req) {
    return this.usersService.delete(req.user.id);
  }
}
