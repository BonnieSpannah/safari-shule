import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '@safari-shule/shared-types';

export const PERMISSION_METADATA = 'safari.permission';
export const RequirePermission = (...keys: PermissionKey[]) => SetMetadata(PERMISSION_METADATA, keys);

export const PUBLIC_METADATA = 'safari.public';
export const Public = () => SetMetadata(PUBLIC_METADATA, true);

export const HARDWARE_METADATA = 'safari.hardware';
export const HardwareEndpoint = () => SetMetadata(HARDWARE_METADATA, true);
