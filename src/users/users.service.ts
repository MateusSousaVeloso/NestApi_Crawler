import { Injectable, ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateUserDto, UpdateUserDto } from './users.dto';
import * as bcrypt from 'bcrypt';
import { hashToken } from '../common/hashToken';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(data.password, 12);
    if (data.password && !hashedPassword) throw new ConflictException('Erro ao processar a senha. Tente novamente mais tarde.');

    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        phone_number: data.phone_number,
        email: data.email,
        password: hashedPassword,
      },
      omit: { password: true, token: true },
    });

    return user;
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, omit: { password: true, token: true } });
    if (!user) throw new NotFoundException('Usuário não existe.');
    return user;
  }

  async findForAuth(email: string) {
    return this.prisma.user.findUnique({ where: { email }, select: { id: true, email: true, password: true } });
  }

  async findByIdWithToken(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, email: true, token: true } });
    if (!user) throw new NotFoundException('Usuário não existe.');
    return user;
  }

  async updateToken(id: string, token: string | null) {
    const hashedToken = token ? hashToken(token) : null;
    return this.prisma.user.update({
      where: { id },
      data: { token: hashedToken },
    });
  }

  async updateLoginMeta(id: string, token: string, userAgent?: string, ipAddress?: string) {
    const hashedToken = hashToken(token);
    return this.prisma.user.update({
      where: { id },
      data: {
        token: hashedToken,
        tokenIssuedAt: new Date(),
        tokenUserAgent: userAgent ?? null,
        tokenIpAddress: ipAddress ?? null,
      },
    });
  }
 
  async updatePreferences(id: string, preferences: Record<string, any>) {
    return this.prisma.user.update({
      where: { id },
      data: { preferences },
      omit: { password: true, token: true },
    });
  }

  async update(id: string, data: UpdateUserDto) {
    const userExists = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, password: true },
    });
    if (!userExists) throw new NotFoundException('Usuário não existe.');

    if (data.password || data.email) {
      if (!data.currentPassword) {
        throw new UnauthorizedException('Senha atual obrigatória para alterar senha ou email.');
      }
      const match = await bcrypt.compare(data.currentPassword, userExists.password);
      if (!match) throw new UnauthorizedException('Senha atual incorreta.');
    }

    const { currentPassword, ...updateData } = data;

    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 12);
      // Invalida a sessão — usuário precisa fazer login novamente
      await this.updateToken(id, null);
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      omit: { password: true, token: true },
    });
  }

  async delete(id: string) {
    const userExists = await this.prisma.user.findUnique({ where: { id } });
    if (!userExists) throw new NotFoundException('Usuário não existe.');

    await this.prisma.user.delete({ where: { id } });
  }
}
