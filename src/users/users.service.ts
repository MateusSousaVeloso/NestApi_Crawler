import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateUserDto, UpdateUserDto } from './users.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

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
      omit: { password: true },
    });

    return user;
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, omit: { password: true, token: true } });
    if (!user) throw new NotFoundException('Usuário não existe.');
    return user;
  }

  async findForAuth(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true, email: true, password: true } });
    if (!user) throw new NotFoundException('Usuário não existe.');
    return user;
  }

  async findByIdWithToken(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, email: true, token: true } });
    if (!user) throw new NotFoundException('Usuário não existe.');
    return user;
  }

  async updateToken(id: string, token: string | null) {
    return this.prisma.user.update({
      where: { id },
      data: { token },
    });
  }

  async updatePreferences(id: string, preferences: Record<string, any>) {
    const userExists = await this.prisma.user.findUnique({ where: { id } });
    if (!userExists) throw new NotFoundException('Usuário não existe.');

    return this.prisma.user.update({
      where: { id },
      data: { preferences },
      omit: { password: true, token: true },
    });
  }

  async update(id: string, data: UpdateUserDto) {
    const userExists = await this.prisma.user.findUnique({ where: { id } });
    if (!userExists) throw new NotFoundException('Usuário não existe.');

    if (data.password) {
      data.password = await bcrypt.hash(data.password, 12);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        ...data,
      },
      omit: { password: true, token: true },
    });
    return updatedUser;
  }

  async delete(id: string) {
    const userExists = await this.prisma.user.findUnique({ where: { id } });
    if (!userExists) throw new NotFoundException('Usuário não existe.');

    return this.prisma.user.delete({
      where: { id },
    });
  }
}
