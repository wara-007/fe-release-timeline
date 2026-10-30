import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { readWorkbook } from '../src/lib/workbook';
import { parseSheets } from '../src/lib/timeline';

test('reads actual month/day headers, colored bars and notes; ignores weekend background', async () => {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Project timeline 2026');
  ws.getCell('A6').value = 'Epic';
  ws.getCell('E2').value = '10 October';
  ws.getCell('F2').value = '11 November';
  ws.getCell('E6').value = 31;
  ws.getCell('F6').value = 1;
  ws.getCell('G6').value = 2;
  ws.getCell('A7').value = 'Payment [WEB]';
  ws.getCell('A7').note = 'status: Testing\nrelease: R1';
  ws.getCell('A8').value = 'Dev FE';
  for (const a of ['F6', 'F8']) ws.getCell(a).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB7B7B7' } };
  for (const a of ['E8', 'G8']) ws.getCell(a).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00FFFF' } };
  const buffer = await workbook.xlsx.writeBuffer();
  const sheets = await readWorkbook(Buffer.from(buffer));
  assert.equal(sheets[0].calendar[5], '2026-10-31');
  assert.equal(sheets[0].calendar[6], '2026-11-01');
  assert.deepEqual(sheets[0].rows.find(r => r.label === 'Dev FE')?.cells.map(c => c.col), [5, 7]);
  assert.equal(parseSheets(sheets)[0].status, 'testing');
});

test('retains a named FE feature with no filled-in dates', () => {
  const f = parseSheets([{ title: 'Project timeline 2026', sheetId: 1, year: 2026, calendar: {}, rows: [
    { row: 7, label: 'Mystery Box', cells: [] }, { row: 8, label: 'Dev FE', cells: [] },
  ] }]);
  assert.equal(f.length, 1);
  assert.equal(f[0].stages.length, 0);
});

test('invalid workbook schema fails visibly instead of silently deleting all features', async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Unexpected tab');
  await assert.rejects(async () => readWorkbook(Buffer.from(await workbook.xlsx.writeBuffer())), /timeline/i);
});

test('theme holiday fills equal to RGB task backgrounds do not become fake milestones', async () => {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Project timeline 2026');
  ws.getCell('A6').value = 'Epic';
  ws.getCell('E2').value = '10 October';
  ws.getCell('E6').value = 23;
  // ExcelJS default Office accent1 is 4F81BD. The exported Sheet similarly mixes theme and RGB.
  ws.getCell('E6').fill = { type: 'pattern', pattern: 'solid', fgColor: { theme: 4 } };
  ws.getCell('A7').value = 'TOL Prepaid';
  ws.getCell('A8').value = 'Dev FE';
  ws.getCell('E8').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
  const sheets = await readWorkbook(Buffer.from(await workbook.xlsx.writeBuffer()));
  assert.equal(parseSheets(sheets)[0].stages.length, 0);
});
