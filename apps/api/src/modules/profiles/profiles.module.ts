import { Module } from '@nestjs/common';
import { AttributesModule } from '../attributes/attributes.module';
import { StudentsService } from './students/students.service';
import { StudentsController } from './students/students.controller';
import { StaffService } from './staff/staff.service';
import { StaffController } from './staff/staff.controller';
import { ParentsService } from './parents/parents.service';
import { ParentsController } from './parents/parents.controller';
import { CaretakersService } from './caretakers/caretakers.service';
import { CaretakersController } from './caretakers/caretakers.controller';

@Module({
  imports: [AttributesModule],
  providers: [StudentsService, StaffService, ParentsService, CaretakersService],
  controllers: [StudentsController, StaffController, ParentsController, CaretakersController],
  exports: [StudentsService, StaffService, ParentsService, CaretakersService],
})
export class ProfilesModule {}
