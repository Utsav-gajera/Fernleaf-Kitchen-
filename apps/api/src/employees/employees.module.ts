import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { MenuModule } from '../menu/menu.module';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';

@Module({
  imports: [AuthorizationModule, MenuModule],
  controllers: [EmployeesController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
