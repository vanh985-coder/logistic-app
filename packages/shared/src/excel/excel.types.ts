import { PackageType } from '../constants/enums.js';

export interface ExcelRowError {
  row: number;
  column: string;
  value: any;
  message: string;
}

export interface ParsedPackageRow {
  rowNumber: number;
  packageCode: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  volumeMm3: bigint;
  weightGrams: number;
  isFragile: boolean;
  noStack: boolean;
  packageType: PackageType;
}

export interface ExcelParseResult {
  success: boolean;
  totalRows: number;
  validCount: number;
  errors: ExcelRowError[];
  packages: ParsedPackageRow[];
}
