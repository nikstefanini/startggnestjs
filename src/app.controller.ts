import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './common/prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('db-test')
  async testDatabase() {
    try {
      // Probar conexión con una consulta simple
      const result = await this.prisma.$queryRaw`SELECT 1 as test`;
      
      // Contar usuarios en la base de datos
      const userCount = await this.prisma.user.count();
      
      return {
        status: 'success',
        message: 'Conexión a base de datos exitosa',
        database: 'startgg_db',
        connection: result,
        userCount,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Error de conexión a base de datos',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }
}