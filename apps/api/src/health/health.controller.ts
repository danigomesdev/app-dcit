import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  check() {
    return { status: 'ok' };
  }

  @Get()
  handle() {
    return this.check();
  }
}
