import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  vehicleInput,
  fuelLogInput,
  repairLogInput,
  insuranceRecordInput,
  paginationQuery,
} from '@safari-shule/shared-types';
import { z } from 'zod';
import { RequirePermission } from '../../rbac/permission.decorators';
import { Audited } from '../../audit/audit.decorators';
import { ZodBody, ZodQuery } from '../../common/validation/zod-pipe';
import { getContext } from '../../common/context/request-context';
import { FleetService } from './fleet.service';

@ApiTags('fleet')
@Controller()
export class FleetController {
  constructor(private readonly svc: FleetService) {}

  @Get('vehicles')
  @RequirePermission('vehicles.view')
  list(@ZodQuery(paginationQuery) q: z.infer<typeof paginationQuery>) {
    return this.svc.listVehicles(q);
  }

  @Get('vehicles/:id')
  @RequirePermission('vehicles.view')
  one(@Param('id') id: string) {
    return this.svc.vehicle(id);
  }

  @Post('vehicles')
  @RequirePermission('vehicles.create')
  @Audited({ action: 'vehicle.create', entityType: 'vehicle' })
  create(@ZodBody(vehicleInput) body: z.infer<typeof vehicleInput>) {
    return this.svc.createVehicle(body);
  }

  @Patch('vehicles/:id')
  @RequirePermission('vehicles.edit')
  @Audited({ action: 'vehicle.update', entityType: 'vehicle', entityIdParam: 'id' })
  update(@Param('id') id: string, @Body() body: Partial<z.infer<typeof vehicleInput>>) {
    return this.svc.updateVehicle(id, body);
  }

  @Delete('vehicles/:id')
  @RequirePermission('vehicles.delete')
  @Audited({ action: 'vehicle.delete', entityType: 'vehicle', entityIdParam: 'id' })
  remove(@Param('id') id: string) {
    return this.svc.deleteVehicle(id);
  }

  @Get('vehicles/:id/fuel')
  @RequirePermission('fuel_logs.view')
  fuel(@Param('id') id: string) {
    return this.svc.listFuel(id);
  }

  @Post('vehicles/:id/fuel')
  @RequirePermission('fuel_logs.create')
  @Audited({ action: 'fuel.create', entityType: 'fuel_log', entityIdParam: 'id' })
  addFuel(@Param('id') id: string, @ZodBody(fuelLogInput) body: z.infer<typeof fuelLogInput>) {
    return this.svc.addFuel({ ...body, vehicleId: id });
  }

  @Get('vehicles/:id/repairs')
  @RequirePermission('repair_logs.view')
  repairs(@Param('id') id: string) {
    return this.svc.listRepairs(id);
  }

  @Post('vehicles/:id/repairs')
  @RequirePermission('repair_logs.create')
  @Audited({ action: 'repair.create', entityType: 'repair_log', entityIdParam: 'id' })
  addRepair(@Param('id') id: string, @ZodBody(repairLogInput) body: z.infer<typeof repairLogInput>) {
    return this.svc.addRepair({ ...body, vehicleId: id });
  }

  @Post('repairs/:id/approve')
  @RequirePermission('repair_logs.approve')
  @Audited({ action: 'repair.approve', entityType: 'repair_log', entityIdParam: 'id' })
  approveRepair(@Param('id') id: string) {
    const userId = getContext()?.userId ?? '';
    return this.svc.approveRepair(id, userId);
  }

  @Get('vehicles/:id/insurance')
  @RequirePermission('insurance.view')
  insurance(@Param('id') id: string) {
    return this.svc.listInsurance(id);
  }

  @Post('vehicles/:id/insurance')
  @RequirePermission('insurance.manage')
  @Audited({ action: 'insurance.create', entityType: 'insurance', entityIdParam: 'id' })
  addInsurance(
    @Param('id') id: string,
    @ZodBody(insuranceRecordInput) body: z.infer<typeof insuranceRecordInput>,
  ) {
    return this.svc.addInsurance({ ...body, vehicleId: id });
  }

  @Get('vehicles/:id/ledger')
  @RequirePermission('vehicles.view')
  ledger(@Param('id') id: string) {
    return this.svc.ledger(id);
  }
}
