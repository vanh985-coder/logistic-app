import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@logix/shared';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: (UserRole | string)[]) => SetMetadata(ROLES_KEY, roles);
