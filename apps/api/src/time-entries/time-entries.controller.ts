import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
} from '@nestjs/common';
import { TimeEntryInputSchema } from '@ponto-dcit/shared-types';
import { TimeEntriesService } from './time-entries.service';

@Controller('time-entries')
export class TimeEntriesController {
  constructor(private readonly timeEntries: TimeEntriesService) {}

  @Post()
  @HttpCode(201)
  async create(@Body() body: unknown) {
    const result = TimeEntryInputSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.timeEntries.create(result.data);
  }
}
