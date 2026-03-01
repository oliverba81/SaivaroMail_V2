import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starte Seeding...');

  // Ersten Super-Admin anlegen
  const passwordHash = await bcrypt.hash('admin123', 10);

  const admin = await prisma.sccUser.upsert({
    where: { email: 'admin@saivaro.local' },
    update: {},
    create: {
      email: 'admin@saivaro.local',
      passwordHash,
      firstName: 'System',
      lastName: 'Administrator',
      role: 'super_admin',
      status: 'active',
    },
  });

  console.log('✅ Super-Admin erstellt:', admin.email);
  console.log('   Passwort: admin123 (bitte nach erstem Login ändern!)');

  // Beispiel-Company für Tests (optional)
  const exampleCompany = await prisma.company.upsert({
    where: { slug: 'example-corp' },
    update: {},
    create: {
      name: 'Example Corporation',
      slug: 'example-corp',
      status: 'active',
      plan: 'basic',
    },
  });

  console.log('✅ Beispiel-Company erstellt:', exampleCompany.name);

  console.log('✨ Seeding abgeschlossen!');
}

main()
  .catch((e) => {
    console.error('❌ Fehler beim Seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });




