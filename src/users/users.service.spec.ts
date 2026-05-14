import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../database/prisma.service';
import * as bcrypt from 'bcrypt';
import { hashToken } from '../common/hashToken';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

const mockUserId = 'user-uuid-123';

const mockUser = {
  id: mockUserId,
  name: 'Mateus',
  phone_number: '5511949381549',
  email: 'mateus@gmail.com',
  preferences: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockUserWithPassword = {
  ...mockUser,
  password: 'hashed-password',
  token: 'some-token',
};

const mockPrisma = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('UsersService', () => {
  let service: UsersService;
  let prisma: typeof mockPrisma;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      name: 'Mateus',
      phone_number: '5511949381549',
      email: 'mateus@gmail.com',
      password: 'Mateus-2409',
      preferences: {},
    };

    it('should create a user with hashed password', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      prisma.user.create.mockResolvedValue(mockUser);

      const result = await service.create(createDto);

      expect(bcrypt.hash).toHaveBeenCalledWith('Mateus-2409', 12);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          name: 'Mateus',
          phone_number: '5511949381549',
          email: 'mateus@gmail.com',
          password: 'hashed-password',
        },
        omit: { password: true },
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('findById', () => {
    it('should return a user without password and token', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById(mockUserId);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUserId },
        omit: { password: true, token: true },
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
      await expect(service.findById('nonexistent')).rejects.toThrow('Usuário não existe.');
    });
  });

  describe('findForAuth', () => {
    const authUser = { id: mockUserId, email: 'mateus@gmail.com', password: 'hashed-password' };

    it('should return user with id, email and password', async () => {
      prisma.user.findUnique.mockResolvedValue(authUser);

      const result = await service.findForAuth('mateus@gmail.com');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'mateus@gmail.com' },
        select: { id: true, email: true, password: true },
      });
      expect(result).toEqual(authUser);
    });

    it('should return null when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.findForAuth('unknown@gmail.com');
      expect(result).toBeNull();
    });
  });

  describe('findByIdWithToken', () => {
    const tokenUser = { id: mockUserId, email: 'mateus@gmail.com', token: 'refresh-token' };

    it('should return user with id, email and token', async () => {
      prisma.user.findUnique.mockResolvedValue(tokenUser);

      const result = await service.findByIdWithToken(mockUserId);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUserId },
        select: { id: true, email: true, token: true },
      });
      expect(result).toEqual(tokenUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findByIdWithToken('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateToken', () => {
    it('should update user refresh token', async () => {
      prisma.user.update.mockResolvedValue({ ...mockUserWithPassword, token: 'new-token' });

      await service.updateToken(mockUserId, 'new-token');

      const hashedToken = hashToken('new-token');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: { token: hashedToken },
      });
    });

    it('should set token to null on logout', async () => {
      prisma.user.update.mockResolvedValue({ ...mockUserWithPassword, token: null });

      await service.updateToken(mockUserId, null);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: { token: null },
      });
    });
  });

  describe('updatePreferences', () => {
    const preferences = { loyalty_programs: ['Smiles'] };

    it('should update user preferences', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUserWithPassword);
      prisma.user.update.mockResolvedValue({ ...mockUser, preferences });

      const result = await service.updatePreferences(mockUserId, preferences);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: { preferences },
        omit: { password: true, token: true },
      });
      expect(result.preferences).toEqual(preferences);
    });

    it('should throw NotFoundException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.updatePreferences('nonexistent', preferences)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update user data', async () => {
      const updateDto = { name: 'Mateus Veloso' };
      prisma.user.findUnique.mockResolvedValue(mockUserWithPassword);
      prisma.user.update.mockResolvedValue({ ...mockUser, name: 'Mateus Veloso' });

      const result = await service.update(mockUserId, updateDto);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: { name: 'Mateus Veloso' },
        omit: { password: true, token: true },
      });
      expect(result.name).toBe('Mateus Veloso');
    });

    it('should hash password when updating password', async () => {
      const updateDto = { password: 'NewPassword123' };
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');
      prisma.user.findUnique.mockResolvedValue(mockUserWithPassword);
      prisma.user.update.mockResolvedValue(mockUser);

      await service.update(mockUserId, updateDto);

      expect(bcrypt.hash).toHaveBeenCalledWith('NewPassword123', 12);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: { password: 'new-hashed-password' },
        omit: { password: true, token: true },
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'Test' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete a user', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUserWithPassword);
      prisma.user.delete.mockResolvedValue(mockUserWithPassword);

      const result = await service.delete(mockUserId);

      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: mockUserId } });
      expect(result).toEqual(mockUserWithPassword);
    });

    it('should throw NotFoundException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
