import { Module } from '@nestjs/common';
import { PushTokensController } from './push-tokens.controller';
import { PushTokensService } from './push-tokens.service';
import { ExpoPushService } from './expo-push.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PushTokensController],
  providers: [PushTokensService, ExpoPushService],
  exports: [ExpoPushService],
})
export class PushModule {}
