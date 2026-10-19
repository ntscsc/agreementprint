import { deflateRawSync } from 'node:zlib';

export type ReportValue = string | number | boolean | Date | null | undefined;
export interface ReportSheet { name: string; note: string; headers: string[]; rows: ReportValue[][]; money?: number[]; percent?: number[]; moneyRows?: number[]; }
const xml = (value: unknown) => String(value ?? '').slice(0, 32000).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const col = (index: number): string => index < 26 ? String.fromCharCode(65 + index) : col(Math.floor(index / 26) - 1) + col(index % 26);

// XLSX is an OOXML ZIP package. Inline strings keep customer text as text, never executable formulas.
function zip(files: Array<[string, string]>): Buffer {
  const local: Buffer[] = [], central: Buffer[] = [];
  let offset = 0;
  const crcTable = Array.from({ length: 256 }, (_, index) => { let crc = index; for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1; return crc >>> 0; });
  for (const [name, text] of files) {
    const filename = Buffer.from(name), raw = Buffer.from(text), data = deflateRawSync(raw);
    let crc = 0xffffffff; for (const byte of raw) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8); crc = (crc ^ 0xffffffff) >>> 0;
    const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(8, 8); header.writeUInt16LE(33, 12); header.writeUInt32LE(crc, 14); header.writeUInt32LE(data.length, 18); header.writeUInt32LE(raw.length, 22); header.writeUInt16LE(filename.length, 26);
    const directory = Buffer.alloc(46); directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6); directory.writeUInt16LE(8, 10); directory.writeUInt16LE(33, 14); directory.writeUInt32LE(crc, 16); directory.writeUInt32LE(data.length, 20); directory.writeUInt32LE(raw.length, 24); directory.writeUInt16LE(filename.length, 28); directory.writeUInt32LE(offset, 42);
    local.push(header, filename, data); central.push(directory, filename); offset += header.length + filename.length + data.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

export function buildReportsXlsx(sheets: ReportSheet[]): Buffer {
  const namespaces = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  const files: Array<[string, string]> = [
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', `<workbook ${namespaces} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${sheets.map((sheet, i) => `<sheet name="${xml(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', `<styleSheet ${namespaces}><numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;₹&quot; #,##0.00;[Red](&quot;₹&quot; #,##0.00)"/><numFmt numFmtId="165" formatCode="dd mmm yyyy hh:mm"/></numFmts><fonts count="4"><font><sz val="11"/><name val="Calibri"/><color rgb="FF172A39"/></font><font><b/><sz val="11"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font><font><b/><sz val="18"/><name val="Calibri"/><color rgb="FF0B4F86"/></font><font><sz val="11"/><name val="Calibri"/><color rgb="FF57534E"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B4F86"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF0F5FA"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="11"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"><alignment vertical="top"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1" applyNumberFormat="1"><alignment vertical="top"/></xf><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"><alignment vertical="top"/></xf><xf numFmtId="165" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"><alignment vertical="top"/></xf><xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"><alignment vertical="top"/></xf><xf numFmtId="10" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"><alignment vertical="top"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`],
  ];
  for (const [index, sheet] of sheets.entries()) {
    const cell = (value: ReportValue, column: number, row: number, style = 0) => {
      const ref = `${col(column)}${row}`;
      if (value instanceof Date && Number.isFinite(value.getTime())) {
        // Excel has no timezone: store India wall-clock time, including fractional days.
        const serial = (value.getTime() + 330 * 60000) / 86400000 + 25569;
        return `<c r="${ref}" s="${style === 5 || style === 6 ? 8 : 7}"><v>${serial}</v></c>`;
      }
      return typeof value === 'number' && Number.isFinite(value) ? `<c r="${ref}" s="${style}"><v>${value}</v></c>` : `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(typeof value === 'boolean' ? value ? 'Yes' : 'No' : value)}</t></is></c>`;
    };
    const last = col(sheet.headers.length - 1), end = Math.max(4, sheet.rows.length + 4);
    const rows = [`<row r="1" ht="30" customHeight="1">${cell(`AgreementPrint · ${sheet.name}`, 0, 1, 2)}</row>`, `<row r="2" ht="90" customHeight="1">${cell(sheet.note, 0, 2, 3)}</row>`, `<row r="4" ht="34" customHeight="1">${sheet.headers.map((header, i) => cell(header, i, 4, 1)).join('')}</row>`, ...sheet.rows.map((row, i) => {
      const lines = Math.max(1, ...row.map((value, column) => value instanceof Date ? 1 : String(value ?? '').split(/\r?\n/).reduce((total, line) => total + Math.max(1, Math.ceil(line.length / (/message|comment|note|address|detail|reason/i.test(sheet.headers[column]) ? 52 : 20))), 0)));
      return `<row r="${i + 5}" ht="${Math.min(409, Math.max(30, lines * 15 + 6))}" customHeight="1">${row.map((value, c) => cell(value, c, i + 5, sheet.percent?.includes(c) ? (i % 2 ? 10 : 9) : sheet.money?.includes(c) || c === 1 && sheet.moneyRows?.includes(i) ? (i % 2 ? 6 : 4) : (i % 2 ? 5 : 0))).join('')}</row>`;
    })];
    files.push([`xl/worksheets/sheet${index + 1}.xml`, `<worksheet ${namespaces}><dimension ref="A1:${last}${end}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${sheet.headers.map((header, i) => `<col min="${i + 1}" max="${i + 1}" width="${/message|comment|note|address|detail|reason/i.test(header) ? 55 : /reference|email|id|date|time/i.test(header) ? 32 : 22}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.join('')}</sheetData><autoFilter ref="A4:${last}${end}"/><mergeCells count="2"><mergeCell ref="A1:${last}1"/><mergeCell ref="A2:${last}2"/></mergeCells><pageSetup orientation="landscape" paperSize="9"/></worksheet>`]);
  }
  return zip(files);
}
