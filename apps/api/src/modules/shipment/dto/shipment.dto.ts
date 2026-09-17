import { PackageType, ShipmentStatus } from '@logix/shared';

export interface CreateShipmentDto {
  laneId: string;
}

export interface AddPackageDto {
  packageCode: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  weightGrams: number;
  isFragile?: boolean;
  noStack?: boolean;
  packageType?: PackageType;
}

export interface ShipmentQueryDto {
  cursor?: string;
  limit?: number;
  status?: ShipmentStatus;
}
