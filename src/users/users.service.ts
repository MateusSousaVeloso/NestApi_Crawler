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
        preferences: data.preferences || {},
      },
      omit: { password: true },
    });

    return user;
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, omit: { password: true } });
    if (!user) throw new NotFoundException('Usuário não existe.');
    return user;
  }

  async findForAuth(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true, email: true, password: true } });
    if (!user) throw new NotFoundException('Usuário não existe.');
    return user;
  }

  async update(id: string, data: UpdateUserDto) {
    const userExists = await this.prisma.user.findUnique({ where: { id } });
    if (!userExists) throw new NotFoundException('Usuário não existe.');

    if (data.password) {
      data.password = await bcrypt.hash(data.password, 12);
    }
    if (data.preferences) {
      const currentPrefs = (userExists.preferences as Record<string, any>) || {};
      data.preferences = { ...currentPrefs, ...data.preferences };
    }
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        ...data,
      },
      omit: { password: true },
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

  // async checkSubscriptionStatus(email: string) {
  //   const user = await this.prisma.user.findUnique({
  //     where: { email },
  //   });
  //   if (!user) throw new NotFoundException('Usuário não existe.');

  //   const sub: any = user.subscription || {};
  //   const expiresAt = sub.expires_at ? new Date(sub.expires_at) : null;
  //   const now = new Date();

  //   // Lógica simples de expiração
  //   const isActive = sub.status === 'active' && expiresAt && expiresAt > now;
  //   const daysRemaining = expiresAt ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 3600 * 24)) : 0;

  //   if (!isActive) {
  //     return {
  //       user_id: user.id,
  //       exists: true,
  //       subscription: {
  //         is_active: false,
  //         status: 'past_due',
  //         block_reason: 'payment_required',
  //       },
  //     };
  //   }

  //   return {
  //     user_id: user.id,
  //     exists: true,
  //     subscription: {
  //       is_active: true,
  //       status: sub.status,
  //       days_remaining: daysRemaining,
  //     },
  //     context: {
  //       last_interaction: new Date().toISOString(),
  //       user_name: user.name.split(' ')[0],
  //     },
  //   };
  // }
}
