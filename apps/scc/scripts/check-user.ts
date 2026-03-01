import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Prüfe Benutzer in der Datenbank...\n');

  const email = 'admin@saivaro.local';
  const user = await prisma.sccUser.findUnique({
    where: { email },
  });

  if (!user) {
    console.log('❌ Benutzer nicht gefunden:', email);
    console.log('📝 Erstelle Benutzer neu...\n');
    
    const passwordHash = await bcrypt.hash('admin123', 10);
    const newUser = await prisma.sccUser.create({
      data: {
        email: 'admin@saivaro.local',
        passwordHash,
        firstName: 'System',
        lastName: 'Administrator',
        role: 'super_admin',
        status: 'active',
      },
    });
    
    console.log('✅ Benutzer erstellt:');
    console.log('   Email:', newUser.email);
    console.log('   Status:', newUser.status);
    console.log('   Rolle:', newUser.role);
    console.log('   Passwort: admin123\n');
  } else {
    console.log('✅ Benutzer gefunden:');
    console.log('   Email:', user.email);
    console.log('   Status:', user.status);
    console.log('   Rolle:', user.role);
    console.log('   Erstellt am:', user.createdAt);
    console.log('   Letzter Login:', user.lastLoginAt || 'Nie');
    
    // Teste Passwort
    console.log('\n🔐 Teste Passwort...');
    const testPassword = 'admin123';
    const isPasswordValid = await bcrypt.compare(testPassword, user.passwordHash);
    
    if (isPasswordValid) {
      console.log('✅ Passwort ist korrekt');
    } else {
      console.log('❌ Passwort stimmt nicht überein!');
      console.log('📝 Setze Passwort neu...\n');
      
      const newPasswordHash = await bcrypt.hash('admin123', 10);
      await prisma.sccUser.update({
        where: { id: user.id },
        data: { passwordHash: newPasswordHash },
      });
      
      console.log('✅ Passwort wurde zurückgesetzt auf: admin123');
    }
  }
}

main()
  .catch((e) => {
    console.error('❌ Fehler:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });



