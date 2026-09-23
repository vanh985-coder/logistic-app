export * from '@logix/shared';

export interface PackageMetadata {
  packageId: string;
  packageCode: string;
  shipmentTrackingCode: string;
  companyName: string;
  taxCode?: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  weightGrams: number;
  isFragile: boolean;
  noStack: boolean;
  dropOrder?: number;
  deliveryDestination?: string;
  color: string;
  colorName: string;
}
