import { Module } from '@nestjs/common';
import { PontoPerdidoService } from './ponto-perdido.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [PontoPerdidoService],
})
export class PontoPerdidoModule {}
