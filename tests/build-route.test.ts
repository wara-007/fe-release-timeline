import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/builds/route';

test('same-site writes work when Next.js normalizes localhost but browser uses 127.0.0.1', async t => {
 const oldFetch=globalThis.fetch;
 const oldUrl=process.env.SUPABASE_URL, oldKey=process.env.SUPABASE_PUBLISHABLE_KEY;
 t.after(()=>{globalThis.fetch=oldFetch;if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;if(oldKey===undefined)delete process.env.SUPABASE_PUBLISHABLE_KEY;else process.env.SUPABASE_PUBLISHABLE_KEY=oldKey;});
 process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_PUBLISHABLE_KEY='publishable-test';
 globalThis.fetch=async()=>new Response(JSON.stringify([{record_id:'release-1',image:'web:123',comment:'release one',updated_at:'2026-10-31T00:00:00.000Z'}]),{status:201,headers:{'Content-Type':'application/json'}});
 const response=await POST(new NextRequest('http://localhost:3000/api/builds',{method:'POST',headers:{Host:'127.0.0.1:3000',Origin:'http://127.0.0.1:3000','Content-Type':'application/json'},body:JSON.stringify({id:'release-1',image:'web:123',comment:'release one'})}));
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{saved:true,record:{recordId:'release-1',image:'web:123',comment:'release one',updatedAt:'2026-10-31T00:00:00.000Z'}});
});

test('foreign origins cannot write saved builds', async()=>{
 const response=await POST(new NextRequest('http://localhost:3000/api/builds',{method:'POST',headers:{Host:'localhost:3000',Origin:'https://foreign.example'},body:'{}'}));
 assert.equal(response.status,403);
});
