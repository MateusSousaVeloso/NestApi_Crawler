import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WhatsAppService } from './whatsapp.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockConfigService = {
  getOrThrow: jest.fn((key: string) => {
    const config: Record<string, string> = {
      ZAPI_INSTANCE_ID: 'test-instance-id',
      ZAPI_TOKEN: 'test-token',
      ZAPI_CLIENT_TOKEN: 'test-client-token',
    };
    return config[key];
  }),
};

describe('WhatsAppService', () => {
  let service: WhatsAppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<WhatsAppService>(WhatsAppService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendMessage', () => {
    it('should call axios with correct URL and payload', async () => {
      mockedAxios.post.mockResolvedValue({ data: { success: true } });

      await service.sendMessage('5511999999999', 'Hello');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.z-api.io/instances/test-instance-id/token/test-token/send-text',
        {
          phone: '5511999999999',
          message: 'Hello',
          delayTyping: 3,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'client-token': 'test-client-token',
          },
        },
      );
    });

    it('should not throw on error', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network error'));

      await expect(
        service.sendMessage('5511999999999', 'Hello'),
      ).resolves.not.toThrow();
    });
  });
});
