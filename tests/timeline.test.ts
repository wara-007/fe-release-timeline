import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSheets, buildReleases, canStartMerge, selectFeatures, bangkokToday } from '../src/lib/timeline';

const sheet = {
  title: 'Project timeline 2026', sheetId: 766157187, year: 2026,
  calendar: { 303: '2026-10-26', 304: '2026-10-27', 305: '2026-10-28', 306: '2026-10-29', 307: '2026-10-30', 310: '2026-11-02' },
  rows: [
    { row: 1, label: 'Release version : 11.1101.0', cells: [] },
    { row: 2, label: 'Feature A [WEB]', note: 'release: R1\nstream: web\nstatus: Done\nimage: web:r1', cells: [] },
    { row: 3, label: 'Dev FE', cells: [{ col: 303, text: 'FE', color: '00FFFF' }, { col: 304, color: '00FFFF' }] },
    { row: 4, label: 'QA', cells: [{ col: 305, text: 'QA', color: 'D5A6BD' }] },
    { row: 5, label: 'On Cloud Prod Deploy', cells: [{ col: 307, text: '11.1101.0 Production', color: '00FF00' }] },
    { row: 6, label: 'Feature B [WEB]', note: 'release: R1\nstream: web\nstatus: Done\nimage: web:r1', cells: [] },
    { row: 7, label: 'Dev FE', cells: [{ col: 303, text: 'FE', color: '00FFFF' }] },
    { row: 8, label: 'On Cloud Prod Deploy', cells: [{ col: 307, text: '11.1101.0 Production', color: '00FF00' }] },
    { row: 9, label: 'Feature C [WEB]', note: 'release: R2\nstream: web\nstatus: Planned', cells: [] },
    { row: 10, label: 'Dev FE', cells: [{ col: 310, text: 'FE', color: '00FFFF' }] },
  ],
};

test('reads calendar dates and preserves stage ranges and source row', () => {
  const features = parseSheets([sheet]);
  assert.equal(features.length, 3);
  assert.equal(features[0].stages.find(s => s.kind === 'dev')?.end, '2026-10-27');
  assert.equal(features[0].sourceRow, 2);
  assert.equal(features[0].platform, 'web');
});

test('groups several features into an explicitly named release and retains its image', () => {
  const releases = buildReleases(parseSheets([sheet]));
  const r1 = releases.find(r => r.name === 'R1')!;
  assert.equal(r1.features.length, 2);
  assert.equal(r1.status, 'done');
  assert.deepEqual(r1.images, ['web:r1']);
  assert.equal(canStartMerge(releases.find(r => r.name === 'R2')!, releases).allowed, true);
});

test('one unfinished feature prevents Done and blocks the next release in its stream', () => {
  const changed = structuredClone(sheet);
  changed.rows[5].note = 'release: R1\nstream: web\nstatus: Testing';
  const releases = buildReleases(parseSheets([changed]));
  assert.equal(releases.find(r => r.name === 'R1')?.status, 'testing');
  assert.equal(canStartMerge(releases.find(r => r.name === 'R2')!, releases).allowed, false);
});

test('old planned dates and an ambiguous Done title never imply deployment', () => {
  const changed = structuredClone(sheet);
  changed.rows[1].label = 'Feature A [WEB] --> Done';
  changed.rows[1].note = '';
  const features = parseSheets([changed]);
  assert.equal(features[0].status, 'unknown');
  assert.ok(selectFeatures(features, { view: 'current', today: '2026-12-31' }).some(f => f.sourceRow === 2));
  assert.ok(!selectFeatures(features, { view: 'history', today: '2026-12-31' }).some(f => f.sourceRow === 2));
});

test('Done remains current until explicit Deployed; history includes explicit deployed work', () => {
  const changed = structuredClone(sheet);
  changed.rows[5].note = 'release: R1\nstream: web\nstatus: Deployed';
  const features = parseSheets([changed]);
  assert.ok(selectFeatures(features, { view: 'current', today: '2026-10-30' }).some(f => f.sourceRow === 2));
  assert.deepEqual(selectFeatures(features, { view: 'history', today: '2026-10-30' }).map(f => f.sourceRow), [6]);
});

test('unknown stream does not claim safe merge permission', () => {
  const changed = structuredClone(sheet);
  changed.rows[8].note = 'release: R2\nstatus: Planned';
  const releases = buildReleases(parseSheets([changed]));
  assert.equal(canStartMerge(releases.find(r => r.name === 'R2')!, releases).allowed, null);
});

test('a different stream does not block a completed web release chain', () => {
  const features = parseSheets([sheet]);
  const other = { ...features[0], id: 'other', releaseId: 'app-r1', stream: 'app', status: 'testing' as const };
  const releases = buildReleases([...features, other]);
  assert.equal(canStartMerge(releases.find(r => r.name === 'R2')!, releases).allowed, true);
});

test('platform and search filters include shared work but do not invent a platform', () => {
  const features = parseSheets([sheet]);
  assert.equal(selectFeatures(features, { view: 'current', today: '2026-10-30', platform: 'app' }).length, 0);
  assert.equal(selectFeatures(features, { view: 'current', today: '2026-10-30', query: 'feature c' }).length, 1);
});

test('Bangkok day rollover is independent of host timezone', () => {
  assert.equal(bangkokToday(new Date('2026-10-29T18:00:00Z')), '2026-10-30');
});

test('same-date features without version or release ID are not invented into one release', () => {
  const features = parseSheets([sheet]).slice(0, 2).map((f, i) => ({ ...f, releaseId: '', version: '', platform: i === 0 ? 'unknown' as const : 'app' as const }));
  const releases = buildReleases(features);
  assert.equal(releases.length, 2);
  assert.ok(releases.every(r => r.platform !== 'shared'));
});

test('filled-in App release milestones identify App work; an empty placeholder does not', () => {
  const changed = structuredClone(sheet);
  changed.rows[1].label = 'Insurance';
  changed.rows[1].note = '';
  changed.rows[4].label = 'App release';
  changed.rows[4].cells[0].text = 'release true app';
  const features = parseSheets([changed]);
  assert.equal(features[0].platform, 'app');
  changed.rows[4].cells = [];
  assert.equal(parseSheets([changed])[0].platform, 'unknown');
});

test('DevBE stage labels do not split a project into an invented feature', () => {
  const changed = structuredClone(sheet);
  changed.rows.splice(3, 0, { row: 35, label: 'DevBE', cells: [] });
  const features = parseSheets([changed]);
  assert.equal(features.length, 3);
  assert.equal(features[0].stages.find(s => s.kind === 'production')?.start, '2026-10-30');
  assert.ok(features.every(f => f.title !== 'DevBE'));
});

test('a version heading applies to its feature only, not the next unrelated project', () => {
  const features = parseSheets([sheet]);
  assert.equal(features[0].version, '11.1101.0');
  assert.equal(features[1].version, '');
});
