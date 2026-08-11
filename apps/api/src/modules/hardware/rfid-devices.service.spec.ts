import { Test, TestingModule } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import { RfidDevicesService } from './rfid-devices.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { sha256 } from '../../common/crypto/secret-encryption';

// Minimal PrismaService stub — only the calls made by RfidDevicesService.
const prismaMock = {
  rfidDevice: {
    count: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

// Stub requireTenantId so unit tests don't need the full request context pipeline.
jest.mock('../../common/context/request-context', () => ({
  requireTenantId: () => 'tenant-uuid-test',
  runWithBypass: (fn: () => unknown) => fn(),
}));

describe('RfidDevicesService', () => {
  let svc: RfidDevicesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.DATA_ENCRYPTION_KEY ??= 'test-data-encryption-key-please-32-bytes';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RfidDevicesService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    svc = module.get(RfidDevicesService);
  });

  describe('register()', () => {
    it('creates the device and returns plain apiKey + hmacSecret + DB id exactly once', async () => {
      prismaMock.rfidDevice.create.mockResolvedValueOnce({ id: 'db-uuid-001' });

      const result = await svc.register({ deviceId: 'RFID-001' });

      expect(result.id).toBe('db-uuid-001');
      expect(result.deviceId).toBe('RFID-001');
      expect(result.apiKey).toBeDefined();
      expect(result.hmacSecret).toBeDefined();
      // Plain secrets must be non-trivially long hex strings
      expect(result.apiKey.length).toBeGreaterThanOrEqual(32);
      expect(result.hmacSecret.length).toBeGreaterThanOrEqual(32);
    });

    it('stores a SHA-256 hash of the apiKey, not the plain value', async () => {
      prismaMock.rfidDevice.create.mockResolvedValueOnce({ id: 'dev-id' });

      const result = await svc.register({ deviceId: 'RFID-002' });
      const [createCall] = prismaMock.rfidDevice.create.mock.calls;
      const { apiKeyHash } = createCall[0].data;

      expect(apiKeyHash).toBe(sha256(result.apiKey));
      expect(apiKeyHash).not.toBe(result.apiKey);
    });

    it('stores an encrypted hmacSecret, not the plain value', async () => {
      prismaMock.rfidDevice.create.mockResolvedValueOnce({ id: 'dev-id' });

      const result = await svc.register({ deviceId: 'RFID-003' });
      const [createCall] = prismaMock.rfidDevice.create.mock.calls;
      const { hmacSecretEncrypted } = createCall[0].data;

      // Encrypted payload must differ from the plain secret
      expect(hmacSecretEncrypted).not.toBe(result.hmacSecret);
      // AES-GCM output is base64, not raw hex
      expect(() => Buffer.from(hmacSecretEncrypted, 'base64')).not.toThrow();
    });

    it('two registrations produce different apiKey + hmacSecret values', async () => {
      prismaMock.rfidDevice.create.mockResolvedValue({ id: 'dev-id' });

      const a = await svc.register({ deviceId: 'RFID-004' });
      const b = await svc.register({ deviceId: 'RFID-005' });

      expect(a.apiKey).not.toBe(b.apiKey);
      expect(a.hmacSecret).not.toBe(b.hmacSecret);
    });

    it('sets status to active on creation', async () => {
      prismaMock.rfidDevice.create.mockResolvedValueOnce({ id: 'dev-id' });
      await svc.register({ deviceId: 'RFID-006' });

      const [call] = prismaMock.rfidDevice.create.mock.calls;
      expect(call[0].data.status).toBe('active');
    });
  });
});
