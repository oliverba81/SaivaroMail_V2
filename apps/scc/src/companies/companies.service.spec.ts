import { Test, TestingModule } from '@nestjs/testing';
import { CompaniesService } from './companies.service';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption.service';

describe('CompaniesService', () => {
  let service: CompaniesService;
  let prisma: PrismaService;
  let encryption: EncryptionService;

  const mockPrismaService = {
    company: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockEncryptionService = {
    encrypt: jest.fn((text: string) => `encrypted:${text}`),
    decrypt: jest.fn((text: string) => text.replace('encrypted:', '')),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EncryptionService,
          useValue: mockEncryptionService,
        },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
    prisma = module.get<PrismaService>(PrismaService);
    encryption = module.get<EncryptionService>(EncryptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of companies', async () => {
      const mockCompanies = [
        {
          id: '1',
          name: 'Test Company',
          slug: 'test-company',
          status: 'active',
          plan: 'basic',
          dbConfig: null,
        },
      ];

      mockPrismaService.company.findMany.mockResolvedValue(mockCompanies);

      const result = await service.findAll();

      expect(result).toEqual(mockCompanies);
      expect(prisma.company.findMany).toHaveBeenCalled();
    });
  });

  describe('getDbConfigWithPassword', () => {
    it('should decrypt password when returning db config', async () => {
      const companyId = 'test-company-id';
      const encryptedPassword = 'encrypted:test-password';

      const mockCompany = {
        id: companyId,
        name: 'Test Company',
        dbConfig: {
          id: 'config-id',
          companyId,
          dbHost: 'localhost',
          dbPort: 5432,
          dbName: 'test_db',
          dbUser: 'test_user',
          dbPassword: encryptedPassword,
          dbSslMode: 'prefer',
        },
      };

      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany);

      const result = await service.getDbConfigWithPassword(companyId);

      expect(result.dbPassword).toBe('test-password');
      expect(encryption.decrypt).toHaveBeenCalledWith(encryptedPassword);
    });
  });
});
