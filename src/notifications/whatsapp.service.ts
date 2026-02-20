import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  private readonly instanceId: string;
  private readonly token: string;
  private readonly clientToken: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.instanceId = this.configService.getOrThrow<string>('ZAPI_INSTANCE_ID');
    this.token = this.configService.getOrThrow<string>('ZAPI_TOKEN');
    this.clientToken = this.configService.getOrThrow<string>('ZAPI_CLIENT_TOKEN');
    this.baseUrl = `https://api.z-api.io/instances/${this.instanceId}/token/${this.token}`;
  }

  async sendMessage(phone: string, message: string): Promise<void> {
    const url = `${this.baseUrl}/send-text`;

    try {
      await axios.post(
        url,
        {
          phone,
          message,
          delayTyping: 3,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'client-token': this.clientToken,
          },
        },
      );
    } catch (error: any) {
      this.logger.error(`Erro ao enviar mensagem para ${phone}: ${error.message}`);
    }
  }
}
