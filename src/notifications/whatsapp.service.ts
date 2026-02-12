import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  private readonly instanceId = '3EE3F6D305BFD125E81BC226D26E541A';
  private readonly token = 'FE9635F8BEBF1060EA7363D7';
  private readonly clientToken = 'F4f3ca36f9141487cbf3f6625bfafc8c6S';
  private readonly baseUrl = `https://api.z-api.io/instances/${this.instanceId}/token/${this.token}`;

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
      this.logger.log(`Mensagem enviada para ${phone}`);
    } catch (error: any) {
      this.logger.error(`Erro ao enviar mensagem para ${phone}: ${error.message}`);
    }
  }
}
