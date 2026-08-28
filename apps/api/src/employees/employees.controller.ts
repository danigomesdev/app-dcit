import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  EmployeeCreateSchema,
  EmployeeScheduleUpdateSchema,
} from '@ponto-dcit/shared-types';
import { EmployeesService } from './employees.service';
import { AuthGuard } from '../auth/auth-guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('gestor', 'rh')
  @Get()
  list() {
    return this.employees.list();
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('rh')
  @Post()
  @HttpCode(201)
  async create(@Body() body: unknown) {
    const result = EmployeeCreateSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.employees.create(result.data);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('rh')
  @Get('trash')
  listTrash() {
    return this.employees.listTrash();
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('rh')
  @Delete(':userId')
  @HttpCode(204)
  async softDelete(@Param('userId') userId: string) {
    await this.employees.softDelete(userId);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('rh')
  @Patch(':userId/restore')
  restore(@Param('userId') userId: string) {
    return this.employees.restore(userId);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('rh')
  @Delete(':userId/permanent')
  @HttpCode(204)
  async permanentlyDelete(@Param('userId') userId: string) {
    await this.employees.permanentlyDelete(userId);
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('rh')
  @Patch(':userId')
  async updateSchedule(@Param('userId') userId: string, @Body() body: unknown) {
    const result = EmployeeScheduleUpdateSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return this.employees.updateSchedule(userId, result.data);
  }
}
