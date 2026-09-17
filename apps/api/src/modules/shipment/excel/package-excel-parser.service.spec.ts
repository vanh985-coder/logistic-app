import * as xlsx from 'xlsx';
import { PackageExcelParserService } from './package-excel-parser.service';
import { PackageType } from '@logix/shared';

describe('PackageExcelParserService', () => {
  let parser: PackageExcelParserService;

  beforeEach(() => {
    parser = new PackageExcelParserService();
  });

  function createWorkbookBuffer(rows: any[][]): Buffer {
    const ws = xlsx.utils.aoa_to_sheet(rows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Packages');
    return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  it('should successfully parse valid package rows', () => {
    const rows = [
      ['Mã kiện', 'Dài', 'Rộng', 'Cao', 'Khối lượng', 'Dễ vỡ', 'Không chồng', 'Loại'],
      ['PKG-001', 400, 300, 200, 5000, 'không', 'không', 'BOX'],
      ['PKG-002', 1200, 100, 100, 3000, 'có', 'không', 'BOX'],
      ['PKG-003', 800, 600, 400, 15000, 0, 1, 'PALLET'],
    ];

    const buffer = createWorkbookBuffer(rows);
    const result = parser.parseBuffer(buffer);

    expect(result.success).toBe(true);
    expect(result.validCount).toBe(3);
    expect(result.errors.length).toBe(0);

    expect(result.packages[0].packageCode).toBe('PKG-001');
    expect(result.packages[0].lengthMm).toBe(400);
    expect(result.packages[0].volumeMm3).toBe(24_000_000n); // 400*300*200
    expect(result.packages[0].isFragile).toBe(false);
    expect(result.packages[0].noStack).toBe(false);

    expect(result.packages[1].packageCode).toBe('PKG-002');
    expect(result.packages[1].isFragile).toBe(true);

    expect(result.packages[2].packageCode).toBe('PKG-003');
    expect(result.packages[2].noStack).toBe(true);
    expect(result.packages[2].packageType).toBe(PackageType.PALLET);
  });

  it('should detect row-by-row validation errors for invalid dimensions or missing codes', () => {
    const rows = [
      ['packageCode', 'lengthMm', 'widthMm', 'heightMm', 'weightGrams', 'isFragile', 'noStack', 'packageType'],
      ['', 400, 300, 200, 5000, false, false, 'BOX'], // Row 2: missing code
      ['PKG-002', -100, 300, 200, 5000, false, false, 'BOX'], // Row 3: negative length
      ['PKG-003', 400, 0, 200, 5000, false, false, 'BOX'], // Row 4: zero width
      ['PKG-004', 400, 300, 200, 0, false, false, 'BOX'], // Row 5: zero weight
      ['PKG-005', 400, 300, 200, 5000, false, false, 'INVALID_TYPE'], // Row 6: invalid type
    ];

    const buffer = createWorkbookBuffer(rows);
    const result = parser.parseBuffer(buffer);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBe(5);

    const errorRows = result.errors.map((e) => e.row);
    expect(errorRows).toEqual([2, 3, 4, 5, 6]);

    expect(result.errors[0].column).toBe('packageCode');
    expect(result.errors[1].column).toBe('lengthMm');
    expect(result.errors[2].column).toBe('widthMm');
    expect(result.errors[3].column).toBe('weightGrams');
    expect(result.errors[4].column).toBe('packageType');
  });

  it('should detect duplicate packageCode across rows', () => {
    const rows = [
      ['packageCode', 'lengthMm', 'widthMm', 'heightMm', 'weightGrams', 'isFragile', 'noStack'],
      ['PKG-DUP', 400, 300, 200, 5000, false, false], // Row 2
      ['PKG-DUP', 500, 400, 300, 6000, false, false], // Row 3 (duplicate)
    ];

    const buffer = createWorkbookBuffer(rows);
    const result = parser.parseBuffer(buffer);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].row).toBe(3);
    expect(result.errors[0].message).toContain('trùng với dòng 2');
  });
});
