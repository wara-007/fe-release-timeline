import ExcelJS from 'exceljs';
import type { GridCell, GridRow, GridSheet } from './types';

const SHEET_IDS: Record<string, number> = { 'Project timeline 2025': 372924953, 'Project timeline 2026': 766157187 };
function noteOf(note: ExcelJS.Comment | string | undefined): string {
  return typeof note === 'string' ? note : note?.texts?.map(t => t.text).join('') || '';
}
function paletteOf(workbook: ExcelJS.Workbook): string[] {
  const xml = Object.values(workbook.model.themes || {}).join('');
  return ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'].map(name => {
    const node = xml.match(new RegExp(`<a:${name}>([\\s\\S]*?)</a:${name}>`))?.[1] || '';
    return node.match(/(?:lastClr|val)="([A-Fa-f0-9]{6})"/)?.[1]?.toUpperCase() || '';
  });
}
function colorOf(cell: ExcelJS.Cell, palette: string[]): string {
  const fill = cell.fill;
  if (fill?.type !== 'pattern' || fill.pattern !== 'solid') return '';
  if (fill.fgColor?.argb) return fill.fgColor.argb.slice(-6).toUpperCase();
  return fill.fgColor?.theme !== undefined ? palette[fill.fgColor.theme] || '' : '';
}
function meaningfulColor(color: string, baseline: string, label: string): boolean {
  if (!/^[A-F0-9]{6}$/.test(color) || color === baseline) return false;
  const rgb = [0, 2, 4].map(i => parseInt(color.slice(i, i + 2), 16));
  const chroma = Math.max(...rgb) - Math.min(...rgb);
  return chroma > 18 || (/regression/i.test(label) && Math.max(...rgb) < 210);
}
function cellDate(cell: ExcelJS.Cell, year: number): string | undefined {
  if (cell.value instanceof Date) return cell.value.toISOString().slice(0, 10);
  const text = cell.text.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(text))) return text;
  const match = text.match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?$/);
  if (!match) return undefined;
  const y = match[3] ? (match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3])) : year;
  const value = `${y}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  return Number.isNaN(Date.parse(value)) ? undefined : value;
}
export async function readWorkbook(bytes: Buffer): Promise<GridSheet[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as never, { ignoreNodes: ['drawing', 'picture', 'conditionalFormatting', 'dataValidations'] });
  const palette = paletteOf(workbook);
  const sheets: GridSheet[] = [];
  for (const ws of workbook.worksheets) {
    const yearMatch = ws.name.match(/^Project timeline (\d{4})$/i);
    if (!yearMatch || ws.state === 'hidden' || ws.state === 'veryHidden') continue;
    const year = Number(yearMatch[1]);
    let headerRow = 0;
    for (let r = 1; r <= 10; r++) if (/^Epic$/i.test(ws.getRow(r).getCell(1).text.trim())) headerRow = r;
    if (!headerRow) continue;
    const calendar: Record<number, string> = {};
    let month = 0;
    for (let col = 5; col <= Math.min(ws.columnCount, 400); col++) {
      const monthCell = ws.getRow(2).getCell(col);
      const monthMatch = Number(monthCell.master.col) === col && monthCell.text.match(/^(\d{2})\s/);
      if (monthMatch) month = Number(monthMatch[1]);
      if (Number(monthCell.master.col) === col && monthCell.value instanceof Date) month = monthCell.value.getUTCMonth() + 1;
      const day = Number(ws.getRow(headerRow).getCell(col).text);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) === date) calendar[col] = date;
      }
    }
    if (!Object.keys(calendar).length) continue;
    const rows: GridRow[] = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRow || rowNumber > 1000) return;
      const label = row.getCell(1).text.trim();
      if (!label) return;
      const cells: GridCell[] = [];
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        if (col > 400 || col === 1) return;
        const text = cell.master.address === cell.address ? cell.text.trim() : '';
        const note = noteOf(cell.note);
        const fill = colorOf(cell, palette);
        const color = meaningfulColor(fill, colorOf(ws.getRow(headerRow).getCell(col), palette), label) ? fill : '';
        if (text || note || (calendar[col] && color)) cells.push({ col, ...(text ? { text } : {}), ...(color ? { color } : {}), ...(note ? { note } : {}) });
      });
      rows.push({ row: rowNumber, label, cells, ...(noteOf(row.getCell(1).note) ? { note: noteOf(row.getCell(1).note) } : {}), start: cellDate(row.getCell(3), year), end: cellDate(row.getCell(4), year) });
    });
    sheets.push({ title: ws.name, sheetId: SHEET_IDS[ws.name] || 0, year, calendar, rows });
  }
  if (!sheets.length) throw new Error('ไม่พบแท็บ Project timeline และหัวปฏิทินที่รองรับ');
  return sheets;
}
