import test from 'node:test';
import assert from 'node:assert/strict';
import { createBuildStore } from '../src/lib/build-store';

test('reads database rows into saved images without prototype pollution', async () => {
 const store = createBuildStore('https://example.supabase.co', 'publishable-test', async () => new Response(JSON.stringify([{record_id:'release-1',image:'web:123'},{record_id:'__proto__',image:'safe'}])));
 const result = await store.read();
 assert.equal(result['release-1'], 'web:123');
 assert.equal(Object.getPrototypeOf(result), null);
 assert.equal(result['__proto__'], 'safe');
});

test('saves image with atomic database upsert and trims whitespace', async () => {
 let saved: unknown;
 const store = createBuildStore('https://example.supabase.co', 'publishable-test', async (input, init) => {
  const url = new URL(String(input));
  assert.equal(url.pathname, '/rest/v1/fe_release_builds');
  assert.equal(url.searchParams.get('on_conflict'), 'record_id');
  saved = JSON.parse(String(init?.body));
  assert.equal(new Headers(init?.headers).get('prefer'), 'resolution=merge-duplicates,return=minimal');
  return new Response(null,{status:201});
 });
 await store.save('release-1','  web:123  ');
 assert.equal((saved as {image:string}).image,'web:123');
 assert.equal((saved as {record_id:string}).record_id,'release-1');
});

test('database failures are visible, never reported as saved or replaced by local data', async () => {
 const store = createBuildStore('https://example.supabase.co','publishable-test',async()=>new Response('denied',{status:403}));
 await assert.rejects(()=>store.read(),/อ่าน/);
 await assert.rejects(()=>store.save('release-1','web:123'),/บันทึก/);
});

test('rejects invalid input before contacting database', async () => {
 let calls=0;
 const store=createBuildStore('https://example.supabase.co','publishable-test',async()=>{calls++;return new Response('[]');});
 await assert.rejects(()=>store.save('', 'image'),/ข้อมูล/);
 await assert.rejects(()=>store.save('r1','x'.repeat(501)),/ข้อมูล/);
 assert.equal(calls,0);
});
