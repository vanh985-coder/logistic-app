import { Injectable, BadRequestException } from '@nestjs/common';
import * as xlsx from 'xlsx';
import { PackageType } from '@logix/shared';
import { calcVolumeMm3 } from '@logix/shared';

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

@Injectable()
export class PackageExcelParserService {
  parseBuffer(buffer: Buffer): ExcelParseResult {
    let workbook: xlsx.WorkBook;
    try {
      workbook = xlsx.read(buffer, { type: 'buffer' });
    } catch {
      throw new BadRequestException('Invalid Excel file format or corrupted file');
    }

    if (!workbook.SheetNames.length) {
      throw new BadRequestException('Excel file does not contain any sheets');
    }

    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rawRows: any[][] = xlsx.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });

    if (rawRows.length < 2) {
      return {
        success: false,
        totalRows: 0,
        validCount: 0,
        errors: [
          {
            row: 1,
            column: 'HEADER',
            value: null,
            message: 'Sheet must have a header row and at least one data row',
          },
        ],
        packages: [],
      };
    }

    // Map column indices from header
    const headerRow = rawRows[0].map((cell) =>
      String(cell).trim().toLowerCase(),
    );

    const findColIndex = (keywords: string[]) => {
      return headerRow.findIndex((col) =>
        keywords.some((kw) => col.includes(kw.toLowerCase())),
      );
    };

    const colMap = {
      packageCode: findColIndex(['packagecode', 'mã kiện', 'code', 'ma kien']),
      lengthMm: findColIndex(['lengthmm', 'dài', 'length', 'dai']),
      widthMm: findColIndex(['widthmm', 'rộng', 'width', 'rong']),
      heightMm: findColIndex(['heightmm', 'cao', 'height']),
      weightGrams: findColIndex(['weightgrams', 'trọng lượng', 'khối lượng', 'weight', 'cân nặng']),
      isFragile: findColIndex(['isfragile', 'dễ vỡ', 'fragile', 'de vo']),
      noStack: findColIndex(['nostack', 'không chồng', 'no stack', 'khong chong', 'không xếp đè']),
      packageType: findColIndex(['packagetype', 'loại kiện', 'type', 'loai kien']),
    };

    // Fallback to position-based indexing if headers are not matched by keyword
    if (colMap.packageCode === -1) colMap.packageCode = 0;
    if (colMap.lengthMm === -1) colMap.lengthMm = 1;
    if (colMap.widthMm === -1) colMap.widthMm = 2;
    if (colMap.heightMm === -1) colMap.heightMm = 3;
    if (colMap.weightGrams === -1) colMap.weightGrams = 4;
    if (colMap.isFragile === -1) colMap.isFragile = 5;
    if (colMap.noStack === -1) colMap.noStack = 6;
    if (colMap.packageType === -1) colMap.packageType = 7;

    const errors: ExcelRowError[] = [];
    const packages: ParsedPackageRow[] = [];
    const seenCodes = new Map<string, number>();

    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNumber = i + 1; // 1-indexed (row 1 is header)

      // Skip empty row
      if (row.every((cell) => cell === '' || cell === null || cell === undefined)) {
        continue;
      }

      let hasRowError = false;

      // 1. packageCode
      const rawCode = String(row[colMap.packageCode] ?? '').trim();
      if (!rawCode) {
        errors.push({
          row: rowNumber,
          column: 'packageCode',
          value: rawCode,
          message: 'Mã kiện (packageCode) không được để trống',
        });
        hasRowError = true;
      } else if (seenCodes.has(rawCode.toUpperCase())) {
        errors.push({
          row: rowNumber,
          column: 'packageCode',
          value: rawCode,
          message: `Mã kiện "${rawCode}" bị trùng với dòng ${seenCodes.get(rawCode.toUpperCase())}`,
        });
        hasRowError = true;
      } else {
        seenCodes.set(rawCode.toUpperCase(), rowNumber);
      }

      // 2. lengthMm
      const lengthMm = Number(row[colMap.lengthMm]);
      if (isNaN(lengthMm) || lengthMm <= 0 || !Number.isInteger(lengthMm)) {
        errors.push({
          row: rowNumber,
          column: 'lengthMm',
          value: row[colMap.lengthMm],
          message: 'Chiều dài (lengthMm) phải là số nguyên dương tính bằng mm',
        });
        hasRowError = true;
      }

      // 3. widthMm
      const widthMm = Number(row[colMap.widthMm]);
      if (isNaN(widthMm) || widthMm <= 0 || !Number.isInteger(widthMm)) {
        errors.push({
          row: rowNumber,
          column: 'widthMm',
          value: row[colMap.widthMm],
          message: 'Chiều rộng (widthMm) phải là số nguyên dương tính bằng mm',
        });
        hasRowError = true;
      }

      // 4. heightMm
      const heightMm = Number(row[colMap.heightMm]);
      if (isNaN(heightMm) || heightMm <= 0 || !Number.isInteger(heightMm)) {
        errors.push({
          row: rowNumber,
          column: 'heightMm',
          value: row[colMap.heightMm],
          message: 'Chiều cao (heightMm) phải là số nguyên dương tính bằng mm',
        });
        hasRowError = true;
      }

      // 5. weightGrams
      const weightGrams = Number(row[colMap.weightGrams]);
      if (isNaN(weightGrams) || weightGrams <= 0 || !Number.isInteger(weightGrams)) {
        errors.push({
          row: rowNumber,
          column: 'weightGrams',
          value: row[colMap.weightGrams],
          message: 'Khối lượng (weightGrams) phải là số nguyên dương tính bằng gram',
        });
        hasRowError = true;
      }

      // 6. isFragile
      const isFragile = this.parseBoolean(row[colMap.isFragile]);

      // 7. noStack
      const noStack = this.parseBoolean(row[colMap.noStack]);

      // 8. packageType
      const rawType = String(row[colMap.packageType] ?? '').trim().toUpperCase();
      let packageType = PackageType.BOX;
      if (rawType) {
        if (Object.values(PackageType).includes(rawType as PackageType)) {
          packageType = rawType as PackageType;
        } else {
          errors.push({
            row: rowNumber,
            column: 'packageType',
            value: rawType,
            message: `Loại kiện "${rawType}" không hợp lệ. Chỉ chấp nhận: BOX, PALLET, CRATE, OTHER`,
          });
          hasRowError = true;
        }
      }

      if (!hasRowError) {
        packages.push({
          rowNumber,
          packageCode: rawCode,
          lengthMm,
          widthMm,
          heightMm,
          volumeMm3: calcVolumeMm3(lengthMm, widthMm, heightMm),
          weightGrams,
          isFragile,
          noStack,
          packageType,
        });
      }
    }

    return {
      success: errors.length === 0,
      totalRows: rawRows.length - 1,
      validCount: packages.length,
      errors,
      packages,
    };
  }

  private parseBoolean(val: any): boolean {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val === 1;
    if (typeof val === 'string') {
      const lower = val.trim().toLowerCase();
      return ['true', '1', 'yes', 'y', 'có', 'co', 'x'].includes(lower);
    }
    return false;
  }
}
