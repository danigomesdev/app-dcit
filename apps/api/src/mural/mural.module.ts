import { Module } from '@nestjs/common';
import { MuralController } from './mural.controller';
import { MuralService } from './mural.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [MuralController],
  providers: [MuralService],
})
export class MuralModule {}
