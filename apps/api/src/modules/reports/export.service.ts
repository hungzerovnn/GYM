import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

@Injectable()
export class ExportService {
  toCsv(title: string, rows: Record<string, unknown>[]) {
    if (!rows.length) {
      return Buffer.from(`${title}\nNo data`);
    }

    const headers = Object.keys(rows[0]);
    const lines = [
      headers.join(','),
      ...rows.map((row) =>
        headers
          .map((header) => {
            const value = row[header];
            const normalized =
              value === null || value === undefined
                ? ''
                : String(value).replace(/"/g, '""');
            return `"${normalized}"`;
          })
          .join(','),
      ),
    ];

    return Buffer.from(lines.join('\n'), 'utf-8');
  }

  async toXlsx(title: string, rows: Record<string, unknown>[]) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(title.slice(0, 31));

    if (!rows.length) {
      worksheet.addRow(['No data']);
      return Buffer.from(await workbook.xlsx.writeBuffer());
    }

    const headers = Object.keys(rows[0]);
    worksheet.columns = headers.map((header) => ({
      header,
      key: header,
      width: 22,
    }));
    rows.forEach((row) => worksheet.addRow(row));
    worksheet.getRow(1).font = { bold: true };

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async toPdf(title: string, rows: Record<string, unknown>[]) {
    return new Promise<Buffer>((resolve) => {
      const doc = new PDFDocument({ size: 'A4', margin: 32 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      doc.fontSize(18).text(title);
      doc.moveDown();

      if (!rows.length) {
        doc.fontSize(12).text('No data');
      } else {
        rows.forEach((row) => {
          doc.fontSize(10).text(
            Object.entries(row)
              .map(([key, value]) => `${key}: ${value ?? ''}`)
              .join(' | '),
          );
          doc.moveDown(0.4);
        });
      }

      doc.end();
    });
  }
}
