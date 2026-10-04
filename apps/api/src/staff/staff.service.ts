import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { StaffRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto } from './dto/staff.dto';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.staffUser.findMany({
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true, updatedAt: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const staff = await this.prisma.staffUser.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true, updatedAt: true },
    });
    if (!staff) throw new NotFoundException(`Staff member ${id} was not found.`);
    return staff;
  }

  async create(data: CreateStaffDto) {
    const email = data.email.toLowerCase();
    const existing = await this.prisma.staffUser.findUnique({ where: { email } });
    if (existing) throw new ConflictException('A staff member with this email already exists.');
    const password = await bcrypt.hash(data.password, 12);
    return this.prisma.staffUser.create({
      data: { email, name: data.name.trim(), password, role: data.role },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true, updatedAt: true },
    });
  }

  async updateRole(id: string, role: StaffRole) {
    await this.assertExists(id);
    return this.prisma.staffUser.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true, updatedAt: true },
    });
  }

  async updateStatus(id: string, isActive: boolean) {
    await this.assertExists(id);
    return this.prisma.staffUser.update({
      where: { id },
      data: { isActive },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true, updatedAt: true },
    });
  }

  private async assertExists(id: string) {
    const staff = await this.prisma.staffUser.findUnique({ where: { id }, select: { id: true } });
    if (!staff) throw new NotFoundException(`Staff member ${id} was not found.`);
  }
}
