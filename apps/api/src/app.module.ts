import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { TimeEntriesModule } from './time-entries/time-entries.module';
import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [AuthModule, TimeEntriesModule],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
