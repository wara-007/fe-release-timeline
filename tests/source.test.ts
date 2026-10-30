import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';

test('live Sheet read is cached; a later failed refresh retains the same features with a warning', async t => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Project timeline 2026');
  sheet.getCell('A6').value = 'Epic';
  sheet.getCell('E2').value = '10 October';
  sheet.getCell('E6').value = 30;
  sheet.getCell('A7').value = 'Web payment';
  sheet.getCell('A8').value = 'Dev FE';
  sheet.getCell('E8').value = 'FE';
  const bytes = await workbook.xlsx.writeBuffer();
  let calls = 0;
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  t.after(() => { globalThis.fetch = originalFetch; Date.now = originalNow; });
  globalThis.fetch = async () => {
    calls++;
    if (calls > 1) throw new Error('upstream unavailable');
    return new Response(new Uint8Array(bytes), { headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } });
  };
  const moduleUrl = new URL('../src/lib/source.ts?live-test', import.meta.url).href;
  const { getTimeline } = await import(moduleUrl);
  const first = await getTimeline();
  assert.equal(first.source.mode, 'live');
  assert.equal(first.features[0].title, 'Web payment');
  await getTimeline();
  assert.equal(calls, 1);
  Date.now = () => originalNow() + 61000;
  const refreshed = await getTimeline(true);
  assert.equal(refreshed.source.mode, 'cached');
  assert.equal(refreshed.source.fetchedAt, first.source.fetchedAt);
  assert.deepEqual(refreshed.features, first.features);
  assert.ok(refreshed.source.warning);
});

test('cold-start read failure identifies a local snapshot instead of claiming live data', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'timeline-fixture-'));
  const originalPath = process.env.TIMELINE_SNAPSHOT_PATH;
  process.env.TIMELINE_SNAPSHOT_PATH = path.join(directory, 'fixture.json');
  await writeFile(process.env.TIMELINE_SNAPSHOT_PATH, JSON.stringify({capturedAt:'2026-10-30T00:00:00Z',sheets:[{title:'Project timeline 2026',sheetId:1,year:2026,calendar:{},rows:[{row:1,label:'Example Web feature',cells:[]}]}]}));
  t.after(async () => { if(originalPath === undefined) delete process.env.TIMELINE_SNAPSHOT_PATH; else process.env.TIMELINE_SNAPSHOT_PATH=originalPath; await rm(directory,{recursive:true,force:true}); });
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => { throw new Error('network unavailable'); };
  const moduleUrl = new URL('../src/lib/source.ts?fallback-test', import.meta.url).href;
  const { getTimeline } = await import(moduleUrl);
  const result = await getTimeline();
  assert.equal(result.source.mode, 'snapshot');
  assert.ok(result.source.warning);
  assert.ok(result.features.length > 0);
  assert.ok(result.features.some((f: { title: string }) => f.title === 'Example Web feature'));
});
