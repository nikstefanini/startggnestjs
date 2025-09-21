import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Start.GG Clone API - Backend funcionando correctamente!';
  }

  getHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'startgg-backend',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };
  }
}