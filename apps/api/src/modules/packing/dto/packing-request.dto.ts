import { ContainerDimension, PackageItem, PackingOptions } from '@logix/packing';

export class CalculatePackingDto {
  matchGroupId?: string;
  containerTypeId?: string;
  shipmentIds?: string[];
  container?: ContainerDimension;
  packages?: PackageItem[];
  options?: PackingOptions;
}
