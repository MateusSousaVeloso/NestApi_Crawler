import { Controller, Post, Get, Patch, Body, Param, UseGuards, Req, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, UpdateSubscriptionDto } from './users.dto';
import { AccessTokenGuard } from '../common/guards/accessToken.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  // 6.1.1 Criar Novo Usuário (Sign-Up)
  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  // 6.1.2 Consultar Perfil Logado
  @UseGuards(AccessTokenGuard)
  @Get('me')
  async findMe(@Req() req) {
    return this.usersService.findById(req.user.sub);
  }

  // 6.1.3 Atualizar Dados
  @UseGuards(AccessTokenGuard)
  @Patch('me')
  async updateMe(@Req() req, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(req.user.sub, updateUserDto);
  }

  // 6.2.2 Verificação de Status (Check-in n8n)
  @Get('check/:phone_number')
  async checkStatus(@Param('phone_number') phoneNumber: string) {
    return this.usersService.checkSubscriptionStatus(phoneNumber);
  }
} 