import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { getContext } from '../context/request-context';

const TENANT_SCOPED_MODELS = new Set<string>([
  'TenantFeature',
  'User',
  'Role',
  'Permission',
  'RolePermission',
  'UserRole',
  'RefreshToken',
  'OtpCode',
  'AuditLog',
  'Invitation',
  'AttributeDefinition',
  'Staff',
  'Student',
  'Parent',
  'Caretaker',
  'ParentStudent',
  'StudentCaretaker',
  'Vehicle',
  'InsuranceRecord',
  'FuelLog',
  'RepairLog',
  'Route',
  'BusStop',
  'Geofence',
  'RouteAssignment',
  'StudentRouteAssignment',
  'Trip',
  'TripPassenger',
  'TripLocationSnapshot',
  'Incident',
  'IncidentEmergencyContact',
  'RfidDevice',
  'RfidTag',
  'AttendanceEvent',
  'UnknownTagScan',
  'MpesaTransaction',
  'OutboundMessage',
]);

const READ_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

const WRITE_OPERATIONS = new Set([
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
]);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  readonly scoped: ReturnType<typeof PrismaService.prototype.buildScopedClient>;

  constructor() {
    super({
      log: [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ],
    });
    this.scoped = this.buildScopedClient();
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Run a callback with the RLS session variable bound to the supplied tenant
   * id (or the current context's tenant id). Bypass is honored for migrations
   * and cross-tenant system-admin queries.
   */
  async withTenantSession<T>(tenantId: string | null, fn: () => Promise<T>): Promise<T> {
    return this.$transaction(async (tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]) => {
      if (tenantId) {
        await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId.replace(/'/g, "''")}'`);
      } else {
        await tx.$executeRawUnsafe(`RESET app.tenant_id`);
      }
      return fn();
    });
  }

  private buildScopedClient() {
    return this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }: {
            model: string | undefined;
            operation: string;
            args: Record<string, unknown>;
            query: (args: Record<string, unknown>) => Promise<unknown>;
          }) {
            const ctx = getContext();
            const tenantId = ctx?.tenantId ?? null;
            const bypass = ctx?.bypassTenantScope ?? false;

            if (!model || !TENANT_SCOPED_MODELS.has(model) || bypass) {
              return query(args);
            }

            if (!tenantId) {
              throw new Error(
                `[Prisma] Refusing to run ${model}.${operation} without a tenant context. ` +
                  `Use prisma.scoped only after the tenant middleware has run, or wrap in runWithBypass for system queries.`,
              );
            }

            const mutated = applyTenantScope(operation, args, tenantId);
            return query(mutated);
          },
        },
      },
    });
  }
}

function applyTenantScope(operation: string, args: any, tenantId: string): any {
  const a = args ?? {};

  if (READ_OPERATIONS.has(operation)) {
    return { ...a, where: mergeWhere(a.where, tenantId) };
  }

  if (operation === 'create') {
    return { ...a, data: { ...(a.data ?? {}), tenantId } };
  }

  if (operation === 'createMany') {
    const data = Array.isArray(a.data) ? a.data : [a.data];
    return { ...a, data: data.map((row: any) => ({ ...row, tenantId })) };
  }

  if (operation === 'update' || operation === 'updateMany') {
    return { ...a, where: mergeWhere(a.where, tenantId) };
  }

  if (operation === 'delete' || operation === 'deleteMany') {
    return { ...a, where: mergeWhere(a.where, tenantId) };
  }

  if (operation === 'upsert') {
    return {
      ...a,
      where: mergeWhere(a.where, tenantId),
      create: { ...(a.create ?? {}), tenantId },
      update: { ...(a.update ?? {}) },
    };
  }

  return a;
}

function mergeWhere(where: any, tenantId: string): any {
  if (!where) return { tenantId };
  if (typeof where !== 'object') return where;
  if (where.AND) return { ...where, AND: [...where.AND, { tenantId }] };
  return { ...where, tenantId };
}

export type ScopedPrisma = PrismaService['scoped'];
export { Prisma };
