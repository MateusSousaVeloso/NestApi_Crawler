import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JWT_CONSTANTS_TOKEN } from './constants';

jest.mock('bcrypt', () => ({
  __esModule: true,
  default: {
    compare: jest.fn(),
  },
}));

import bcrypt from 'bcrypt';

const mockUserId = 'user-uuid-123';
const mockEmail = 'mateus@gmail.com';

const mockTokens = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
};

const mockConstants = {
  access_token_secret: 'test-access-secret',
  refresh_token_secret: 'test-refresh-secret',
};

const mockUsersService = {
  create: jest.fn(),
  findForAuth: jest.fn(),
  findById: jest.fn(),
  updateToken: jest.fn(),
};

const mockJwtService = {
  signAsync: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;
  let usersService: typeof mockUsersService;
  let jwtService: typeof mockJwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: JWT_CONSTANTS_TOKEN, useValue: mockConstants },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signup', () => {
    const createDto = {
      name: 'Mateus',
      phone_number: '5511949381549',
      email: mockEmail,
      password: 'Mateus-2409',
      preferences: {},
    };

    it('should create a user and return tokens', async () => {
      usersService.create.mockResolvedValue({ id: mockUserId, email: mockEmail });
      mockJwtService.signAsync
        .mockResolvedValueOnce('mock-refresh-token')
        .mockResolvedValueOnce('mock-access-token');
      usersService.updateToken.mockResolvedValue(undefined);

      const result = await service.signup(createDto);

      expect(usersService.create).toHaveBeenCalledWith(createDto);
      expect(usersService.updateToken).toHaveBeenCalledWith(mockUserId, 'mock-refresh-token');
      expect(result).toEqual(mockTokens);
    });
  });

  describe('login', () => {
    const loginDto = { email: mockEmail, password: 'Mateus-2409' };

    it('should return tokens on valid credentials', async () => {
      usersService.findForAuth.mockResolvedValue({
        id: mockUserId,
        email: mockEmail,
        password: 'hashed-password',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.signAsync
        .mockResolvedValueOnce('mock-refresh-token')
        .mockResolvedValueOnce('mock-access-token');
      usersService.updateToken.mockResolvedValue(undefined);

      const result = await service.login(loginDto);

      expect(usersService.findForAuth).toHaveBeenCalledWith(mockEmail);
      expect(bcrypt.compare).toHaveBeenCalledWith('Mateus-2409', 'hashed-password');
      expect(result).toEqual(mockTokens);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      usersService.findForAuth.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Credenciais inválidas.');
    });

    it('should throw UnauthorizedException when password does not match', async () => {
      usersService.findForAuth.mockResolvedValue({
        id: mockUserId,
        email: mockEmail,
        password: 'hashed-password',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Credenciais inválidas.');
    });
  });

  describe('getTokens', () => {
    it('should generate access and refresh tokens', async () => {
      mockJwtService.signAsync
        .mockResolvedValueOnce('mock-refresh-token')
        .mockResolvedValueOnce('mock-access-token');

      const result = await service.getTokens(mockUserId, mockEmail);

      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { id: mockUserId, email: mockEmail },
        { secret: 'test-refresh-secret' },
      );
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { id: mockUserId, email: mockEmail, refreshToken: 'mock-refresh-token' },
        { secret: 'test-access-secret', expiresIn: '30m' },
      );
      expect(result).toEqual(mockTokens);
    });
  });

  describe('refreshTokens', () => {
    it('should return new tokens for valid user', async () => {
      usersService.findById.mockResolvedValue({ id: mockUserId, email: mockEmail });
      mockJwtService.signAsync
        .mockResolvedValueOnce('mock-refresh-token')
        .mockResolvedValueOnce('mock-access-token');
      usersService.updateToken.mockResolvedValue(undefined);

      const result = await service.refreshTokens(mockUserId);

      expect(usersService.findById).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(mockTokens);
    });

    it('should throw BadRequestException when user not found', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(service.refreshTokens('nonexistent')).rejects.toThrow(BadRequestException);
      await expect(service.refreshTokens('nonexistent')).rejects.toThrow('Nenhum usuário encontrado!');
    });
  });

  describe('logout', () => {
    it('should clear user token and return true', async () => {
      usersService.findById.mockResolvedValue({ id: mockUserId, email: mockEmail });
      usersService.updateToken.mockResolvedValue(undefined);

      const result = await service.logout(mockUserId);

      expect(usersService.findById).toHaveBeenCalledWith(mockUserId);
      expect(usersService.updateToken).toHaveBeenCalledWith(mockUserId, null);
      expect(result).toBe(true);
    });

    it('should throw BadRequestException when user not found', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(service.logout('nonexistent')).rejects.toThrow(BadRequestException);
      await expect(service.logout('nonexistent')).rejects.toThrow('Algo deu errado ao deslogar!');
    });
  });
});
