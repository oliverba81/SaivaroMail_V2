import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.company.findMany({
      include: {
        dbConfig: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        dbConfig: true,
      },
    });

    if (!company) {
      throw new NotFoundException(`Company mit ID ${id} nicht gefunden`);
    }

    return company;
  }

  async create(createCompanyDto: CreateCompanyDto) {
    return this.prisma.company.create({
      data: {
        name: createCompanyDto.name,
        slug: createCompanyDto.slug,
        status: createCompanyDto.status || 'active',
        plan: createCompanyDto.plan || 'basic',
        metadata: createCompanyDto.metadata,
      },
      include: {
        dbConfig: true,
      },
    });
  }

  async update(id: string, updateCompanyDto: UpdateCompanyDto) {
    await this.findOne(id); // Prüft, ob Company existiert

    return this.prisma.company.update({
      where: { id },
      data: updateCompanyDto,
      include: {
        dbConfig: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id); // Prüft, ob Company existiert

    return this.prisma.company.delete({
      where: { id },
    });
  }

  async getDbConfig(companyId: string) {
    const company = await this.findOne(companyId);

    if (!company.dbConfig) {
      throw new NotFoundException(`DB-Config für Company ${companyId} nicht gefunden`);
    }

    // Passwort nicht zurückgeben (Sicherheit)
    const { dbPassword, ...dbConfigWithoutPassword } = company.dbConfig;

    return dbConfigWithoutPassword;
  }
}

