import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

const mockUserId = 'user-uuid-123';
const mockReq = { user: { id: mockUserId } };

const mockUser = {
  id: mockUserId,
  name: 'Mateus',
  phone_number: '5511949381549',
  email: 'mateus@gmail.com',
  preferences: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockUsersService = {
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

describe('UsersController', () => {
  let controller: UsersController;
  let service: typeof mockUsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get(UsersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findMe', () => {
    it('should return the authenticated user profile', async () => {
      service.findById.mockResolvedValue(mockUser);

      const result = await controller.findMe(mockReq);

      expect(service.findById).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(mockUser);
    });

    it('should propagate NotFoundException from service', async () => {
      service.findById.mockRejectedValue(new NotFoundException('Usuário não existe.'));

      await expect(controller.findMe(mockReq)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto = { name: 'Mateus Veloso' };
    const updatedUser = { ...mockUser, name: 'Mateus Veloso' };

    it('should update the authenticated user', async () => {
      service.update.mockResolvedValue(updatedUser);

      const result = await controller.update(mockReq, updateDto);

      expect(service.update).toHaveBeenCalledWith(mockUserId, updateDto);
      expect(result.name).toBe('Mateus Veloso');
    });

    it('should propagate NotFoundException from service', async () => {
      service.update.mockRejectedValue(new NotFoundException('Usuário não existe.'));

      await expect(controller.update(mockReq, updateDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete the authenticated user', async () => {
      service.delete.mockResolvedValue(mockUser);

      const result = await controller.delete(mockReq);

      expect(service.delete).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(mockUser);
    });

    it('should propagate NotFoundException from service', async () => {
      service.delete.mockRejectedValue(new NotFoundException('Usuário não existe.'));

      await expect(controller.delete(mockReq)).rejects.toThrow(NotFoundException);
    });
  });
});
