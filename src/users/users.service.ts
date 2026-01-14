import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateUserDto, UpdateUserDto } from './users.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { phone_number: data.phone_number },
    });
    if (existingUser) throw new ConflictException('Número de telefone já cadastrado.');

    const hashedPassword = data.password ? await bcrypt.hash(data.password, 10) : undefined;
    if (data.password && !hashedPassword) throw new ConflictException('Erro ao processar a senha. Tente novamente mais tarde.');

    const user = await this.prisma.user.create({
      data: {
        full_name: data.full_name,
        phone_number: data.phone_number,
        email: data.email,
        password: hashedPassword,
        preferences: data.initial_preferences || {},
        subscription: { status: 'pending_payment' }, 
      },
    });

    return {
      data: {  
        user_id: user.id,
        status: 'pending_payment' 
      },
      message: 'Usuário criado com sucesso.',
    };
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    // Mapear retorno conforme doc
    return {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone_number,
      subscription: user.subscription,
      preferences: user.preferences,
    };
  }

  async update(id: string, data: UpdateUserDto) {
    // Lógica de merge de JSON para preferências seria ideal aqui
    return this.prisma.user.update({
      where: { id },
      data: { preferences: data.preferences }, // Simplificado (sobrescreve)
    });
  }

  async checkSubscriptionStatus(phone_number: string) {
    const user = await this.prisma.user.findUnique({
      where: { phone_number },
    });

    if (!user) {
      return { exists: false };
    }

    const sub: any = user.subscription || {};
    const expiresAt = sub.expires_at ? new Date(sub.expires_at) : null;
    const now = new Date();

    // Lógica simples de expiração
    const isActive = sub.status === 'active' && expiresAt && expiresAt > now;
    const daysRemaining = expiresAt ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 3600 * 24)) : 0;

    if (isActive) {
      return {
        user_id: user.id,
        exists: true,
        subscription: {
          is_active: true,
          status: sub.status,
          days_remaining: daysRemaining,
        },
        context: {
          last_interaction: new Date().toISOString(), // Exemplo
          user_name: user.full_name.split(' ')[0],
        },
      };
    } else {
      return {
        user_id: user.id,
        exists: true,
        subscription: {
          is_active: false,
          status: 'past_due',
          block_reason: 'payment_required',
        },
      };
    }
  }

    async findForAuth(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      omit: { password: true },
    });
  }

}
