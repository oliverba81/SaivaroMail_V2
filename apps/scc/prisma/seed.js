"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Starte Seeding...');
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
//# sourceMappingURL=seed.js.map