import { PrismaClient } from './generated/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('❌ DATABASE_URL não encontrada no .env');
}

const pool = new Pool({ connectionString });

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({
  adapter,
  log: ['info', 'warn', 'error'],
});

async function main() {
  console.log('🌱 Iniciando seed dos planos e usuário de teste');

  const plans = [
    {
      id: 1,
      name: 'Premium Mensal',
      price: 29.9,
      durationDays: 30,
    },
    {
      id: 2,
      name: 'Premium Trimestral',
      price: 79.9,
      durationDays: 90,
    },
    {
      id: 3,
      name: 'Premium Anual',
      price: 299.9,
      durationDays: 365,
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { id: plan.id },
      update: plan,
      create: plan,
    });
  }


  const users = [
    {
      name: 'Mateus',
      phone_number: '5511949381549',
      email: 'usuario@email.com',
      password: 'SenhaForte123!',
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: user,
      create: user,
    });
  }
  console.log('✅ Planos criados/atualizados com sucesso!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
