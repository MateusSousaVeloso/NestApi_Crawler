import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class SearchService {
  async dispatchSearch(data: any) {
    // 1. Validações de regra de negócio pré-crawler
    
    // 2. Chamada ao Módulo Interno (Crawler Engine) - 6.5.1
    // Em produção, isso seria uma chamada para uma fila (RabbitMQ/Bull) ou HTTP interno
    const crawlerPayload = {
      job_id: crypto.randomUUID(),
      origin: data.search_params.origin,
      destination: data.search_params.destination,
      date: data.search_params.dates.departure_date,
      targets: data.search_params.preferences.programs,
    };

    // Simulação da chamada ao Crawler Service
    // await axios.post('http://crawler-service:3000/engine/job', crawlerPayload);

    // 3. Retorno Mockado conforme documentação (pois o crawler é assíncrono na realidade)
    return {
      status: "success",
      execution_id: crawlerPayload.job_id,
      results: {
        cheapest_option: {
          airline: "TAP",
          miles: 60000,
          tax: 200.00,
          stops: 1,
          duration_minutes: 800,
          departure: `${data.search_params.dates.departure_date}T08:00:00`,
          booking_link: "https://..."
        },
        smart_option: {
          airline: "LATAM",
          miles: 65000,
          tax: 210.00,
          stops: 0,
          duration_minutes: 600,
          departure: `${data.search_params.dates.departure_date}T22:00:00`,
          booking_link: "https://..."
        }
      }
    };
  }
}