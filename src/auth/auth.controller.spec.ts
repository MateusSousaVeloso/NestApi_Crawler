import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';

const mockUserId = 'user-uuid-123';

const mockTokens = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
};

const mockAuthService = {
  signup: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  refreshTokens: jest.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;
  let authService: typeof mockAuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('signup', () => {
    const createUserDto = {
      name: 'Mateus',
      phone_number: '5511949381549',
      email: 'mateus@gmail.com',
      password: 'Mateus-2409',
      preferences: {},
    };

    it('should register a new user and return tokens', async () => {
      authService.signup.mockResolvedValue(mockTokens);

      const result = await controller.signup(createUserDto);

      expect(authService.signup).toHaveBeenCalledWith(createUserDto);
      expect(result).toEqual(mockTokens);
    });
  });

  describe('login', () => {
    const authDto = { email: 'mateus@gmail.com', password: 'Mateus-2409' };

    it('should authenticate user and return tokens', async () => {
      authService.login.mockResolvedValue(mockTokens);

      const result = await controller.login(authDto);

      expect(authService.login).toHaveBeenCalledWith(authDto);
      expect(result).toEqual(mockTokens);
    });

    it('should propagate UnauthorizedException', async () => {
      authService.login.mockRejectedValue(new UnauthorizedException('Credenciais inválidas.'));

      await expect(controller.login(authDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should logout and clear cookies', async () => {
      const mockRes = {
        clearCookie: jest.fn().mockReturnThis(),
      };
      const mockReq = { user: { id: mockUserId } };
      authService.logout.mockResolvedValue(true);

      const originalEnv = { ...process.env };
      process.env.REFRESH_TOKEN = 'refresh_token';
      process.env.ACCESS_TOKEN = 'access_token';

      const result = await controller.logout(mockRes, mockReq);

      expect(authService.logout).toHaveBeenCalledWith(mockUserId);
      expect(mockRes.clearCookie).toHaveBeenCalledWith('refresh_token');
      expect(mockRes.clearCookie).toHaveBeenCalledWith('access_token');
      expect(result).toEqual({ message: 'Logout realizado com sucesso.' });

      process.env = originalEnv;
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens and set cookies', async () => {
      const mockRes = {
        cookie: jest.fn().mockReturnThis(),
      };
      const mockReq = { user: { id: mockUserId } };
      authService.refreshTokens.mockResolvedValue(mockTokens);

      const originalEnv = { ...process.env };
      process.env.ACCESS_TOKEN = 'access_token';
      process.env.REFRESH_TOKEN = 'refresh_token';
      process.env.NODE_ENV = 'development';

      const result = await controller.refreshTokens(mockRes, mockReq);

      expect(authService.refreshTokens).toHaveBeenCalledWith(mockUserId);
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'access_token',
        'mock-access-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          maxAge: 30 * 60 * 1000,
        }),
      );
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'mock-refresh-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
        }),
      );
      expect(result).toEqual({ accessToken: 'mock-access-token', refreshToken: 'mock-refresh-token' });

      process.env = originalEnv;
    });
  });
});
