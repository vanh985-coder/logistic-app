import { Injectable, BadRequestException } from '@nestjs/common';
import * as xlsx from 'xlsx';
import {
  parseAndValidateExcelRows,
  ExcelRowError,
  ParsedPackageRow,
  ExcelParseResult,
} from '@logix/shared';

export type { ExcelRowError, ParsedPackageRow, ExcelParseResult };

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

    return parseAndValidateExcelRows(rawRows);
  }
}
