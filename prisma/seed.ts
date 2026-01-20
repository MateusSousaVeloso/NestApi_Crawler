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
  console.log('🌱 Iniciando seed dos planos e produtos');

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
  // try {
  //   const filePath = path.join(__dirname, 'products.txt');

  //   if (fs.existsSync(filePath)) {
  //     console.log(`📂 Lendo produtos do arquivo: ${filePath}`);
  //     const fileContent = fs.readFileSync(filePath, 'utf8');
  //     const productsRaw = JSON.parse(fileContent);

  //     if (Array.isArray(productsRaw)) {
  //       console.log(`💊 Semeando ${productsRaw.length} produtos...`);

  //       for (const item of productsRaw) {
  //         const productData = {
  //           sku: item.sku,
  //           product_name: item.product_name,
  //           price: item.price,
  //           product_url: item.product_url,
  //           image_url: item.image_url,
  //           category: item.category,
  //           ean_code: item.ean_code || null,
  //           is_available: item.is_available ?? true,
  //         };

  //         await prisma.product.upsert({
  //           where: { sku: item.sku },
  //           update: productData,
  //           create: productData,
  //         });
  //       }
  //     } else {
  //       console.warn('⚠️ O conteúdo de products.txt não é uma lista (Array).');
  //     }
  //   } else {
  //     console.warn('⚠️ Arquivo products.txt não encontrado. Pulando seed de produtos.');
  //   }
  // } catch (error) {
  //   console.error('❌ Erro ao ler/inserir produtos:', error);
  // }

  const users = [
    {
      name: 'Mateus',
      phone_number: '5511949381549',
      email: 'usuario@email.com',
      password: 'SenhaForte123!',
      preferences: {
        airline: 'LATAM',
      },
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: user,
      create: user,
    });
  }

  const employees = [
    {
      name: 'Lucas Batista de Sousa',
      phone_number: '5511973748821',
      user_phone: '5511949381549',
    },
  ];

  for (const employee of employees) {
    await prisma.employee.upsert({
      where: { phone_number: employee.phone_number },
      update: employee,
      create: employee,
    });
  }

  console.log('✅ Planos e produtos criados/atualizados com sucesso!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
