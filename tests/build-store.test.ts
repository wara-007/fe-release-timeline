import test from 'node:test';
import assert from 'node:assert/strict';
import { createBuildStore } from '../src/lib/build-store';

test('reads database rows into saved images without prototype pollution', async () => {
 const rows=[{record_id:'release-1',image:'web:123',comment:'release one',updated_at:'2026-10-31T00:00:00.000Z'},{record_id:'__proto__',image:'safe',comment:'',updated_at:'2026-10-31T00:01:00.000Z'}];
 const store = createBuildStore('https://example.supabase.co', 'publishable-test', async () => new Response(JSON.stringify(rows)));
 const result = await store.read();
 assert.equal(result.latest['release-1'].image, 'web:123');
 assert.equal(Object.getPrototypeOf(result.latest), null);
 assert.equal(result.latest['__proto__'].image, 'safe');
 assert.equal(result.history['release-1'][0].comment, 'release one');
});

test('saves image with atomic database upsert and trims whitespace', async () => {
 let saved: unknown;
 const store = createBuildStore('https://example.supabase.co', 'publishable-test', async (input, init) => {
  const url = new URL(String(input));
  assert.equal(url.pathname, '/rest/v1/fe_release_builds');
  assert.equal(url.searchParams.get('on_conflict'), 'record_id');
  saved = JSON.parse(String(init?.body));
  assert.equal(new Headers(init?.headers).get('prefer'), 'resolution=merge-duplicates,return=representation');
  return new Response(JSON.stringify([{...(saved as Record<string,unknown>),updated_at:'2026-10-31T00:00:00.000Z'}]),{status:201,headers:{'Content-Type':'application/json'}});
 });
 await store.save('release-1','  web:123  ',' release one ');
 assert.equal((saved as {image:string}).image,'web:123');
 assert.equal((saved as {record_id:string}).record_id,'release-1');
 assert.equal((saved as {comment:string}).comment,'release one');
});

test('database failures are visible, never reported as saved or replaced by local data', async () => {
 const store = createBuildStore('https://example.supabase.co','publishable-test',async()=>new Response('denied',{status:403}));
 await assert.rejects(()=>store.read(),/อ่าน/);
 await assert.rejects(()=>store.save('release-1','web:123',''),/บันทึก/);
});

test('rejects invalid input before contacting database', async () => {
 let calls=0;
 const store=createBuildStore('https://example.supabase.co','publishable-test',async()=>{calls++;return new Response('[]');});
 await assert.rejects(()=>store.save('', 'image',''),/ข้อมูล/);
 await assert.rejects(()=>store.save('r1','x'.repeat(501),''),/ข้อมูล/);
 assert.equal(calls,0);
});
