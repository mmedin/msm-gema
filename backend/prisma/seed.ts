import { PrismaClient } from '@prisma/client';
import { runMasterSeed } from './seed-master';
import { runDemoSeed } from './seed-demo';

const prisma = new PrismaClient();

async function main() {
  await runMasterSeed();
  await runDemoSeed();
}

main()
  .catch((e) => {
    console.error('Error ejecutando seed unificado:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
