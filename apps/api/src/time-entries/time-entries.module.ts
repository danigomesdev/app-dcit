import { Module } from '@nestjs/common';
import { TimeEntriesController } from './time-entries.controller';
import { TimeEntriesService } from './time-entries.service';
import { AuthModule } from '../auth/auth.module';
import { AlertasModule } from '../alertas/alertas.module';

@Module({
  imports: [AuthModule, AlertasModule],
  controllers: [TimeEntriesController],
  providers: [TimeEntriesService],
})
export class TimeEntriesModule {}
