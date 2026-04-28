import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './user.entity';

const MIN_PASSWORD_LENGTH = 8;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.usersRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('ไม่พบผู้ใช้งาน');
    return user;
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { username } });
  }

  async create(dto: {
    username: string;
    password: string;
    role: UserRole;
    nameTh?: string;
    nameZh?: string;
    nameEn?: string;
    phone?: string;
  }): Promise<User> {
    // Validate username
    if (!dto.username || dto.username.trim().length < 3) {
      throw new BadRequestException('Username ต้องมีอย่างน้อย 3 ตัวอักษร');
    }
    if (!/^[a-zA-Z0-9_]+$/.test(dto.username.trim())) {
      throw new BadRequestException('Username ใช้ได้เฉพาะตัวอักษร ตัวเลข และ _ เท่านั้น');
    }

    // Enforce minimum password length
    if (!dto.password || dto.password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`,
      );
    }

    // Reject bcrypt-DoS: very long passwords are dangerous
    if (dto.password.length > 72) {
      throw new BadRequestException('รหัสผ่านยาวเกินไป (สูงสุด 72 ตัวอักษร)');
    }

    const existing = await this.findByUsername(dto.username.trim());
    if (existing) throw new ConflictException('Username นี้มีอยู่แล้ว');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepo.create({
      ...dto,
      username: dto.username.trim(),
      passwordHash,
    });
    return this.usersRepo.save(user);
  }

  async update(
    id: string,
    dto: {
      username?: string;
      nameTh?: string;
      nameZh?: string;
      nameEn?: string;
      phone?: string;
      role?: UserRole;
    },
  ): Promise<User> {
    const user = await this.findById(id);
    if (dto.username && dto.username.trim() !== user.username) {
      if (dto.username.trim().length < 3) {
        throw new BadRequestException('Username ต้องมีอย่างน้อย 3 ตัวอักษร');
      }
      if (!/^[a-zA-Z0-9_]+$/.test(dto.username.trim())) {
        throw new BadRequestException('Username ใช้ได้เฉพาะตัวอักษร ตัวเลข และ _ เท่านั้น');
      }
      const existing = await this.findByUsername(dto.username.trim());
      if (existing && existing.id !== user.id) {
        throw new ConflictException('Username นี้มีอยู่แล้ว');
      }
      user.username = dto.username.trim();
    }

    Object.assign(user, {
      ...(dto.nameTh !== undefined ? { nameTh: dto.nameTh } : {}),
      ...(dto.nameZh !== undefined ? { nameZh: dto.nameZh } : {}),
      ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      ...(dto.role !== undefined ? { role: dto.role } : {}),
    });
    return this.usersRepo.save(user);
  }

  async changePassword(id: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`,
      );
    }
    if (newPassword.length > 72) {
      throw new BadRequestException('รหัสผ่านยาวเกินไป (สูงสุด 72 ตัวอักษร)');
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersRepo.update(id, { passwordHash });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.usersRepo.update(id, { lastLoginAt: new Date() });
  }

  async deactivate(id: string): Promise<User> {
    await this.findById(id); // throws if not found
    await this.usersRepo.update(id, { isActive: false });
    return this.findById(id);
  }

  async activate(id: string): Promise<User> {
    await this.findById(id); // throws if not found
    await this.usersRepo.update(id, { isActive: true });
    return this.findById(id);
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }
}
