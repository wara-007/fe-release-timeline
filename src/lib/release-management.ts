import type { Platform } from './types';

export type ManagedReleaseMember = {
  id:string; releaseId:string; sourceType:'sheet'|'custom'; featureId:string;
  title:string; platform:Platform; owner:string; devStart:string; devEnd:string;
  qaStart:string; qaEnd:string; note:string; sortOrder:number;
};
export type ManagedRelease = {
  id:string; origin:'manual'|'sheet_override'; name:string; version:string;
  releaseDate:string; stream:string; platform:Platform; description:string;
  archived:boolean; members:ManagedReleaseMember[];
};

type Row=Record<string,unknown>;
const platforms:Platform[]=['web','app','shared','unknown'];
function platform(value:unknown):Platform{return platforms.includes(value as Platform)?value as Platform:'unknown';}
function member(row:Row):ManagedReleaseMember{return{id:String(row.id||''),releaseId:String(row.release_id||''),sourceType:row.source_type==='sheet'?'sheet':'custom',featureId:String(row.feature_id||''),title:String(row.title||''),platform:platform(row.platform),owner:String(row.owner||''),devStart:String(row.dev_start||''),devEnd:String(row.dev_end||''),qaStart:String(row.qa_start||''),qaEnd:String(row.qa_end||''),note:String(row.note||''),sortOrder:Number(row.sort_order)||0};}
function release(row:Row,members:ManagedReleaseMember[]):ManagedRelease{return{id:String(row.id||''),origin:row.origin==='sheet_override'?'sheet_override':'manual',name:String(row.name||''),version:String(row.version||''),releaseDate:String(row.release_date||''),stream:String(row.stream||''),platform:platform(row.platform),description:String(row.description||''),archived:Boolean(row.archived),members};}

export function createReleaseManagementStore(url:string,key:string,fetcher:typeof fetch=fetch){
 const releases=new URL('/rest/v1/fe_managed_releases',url),members=new URL('/rest/v1/fe_managed_release_members',url);
 const headers={apikey:key,'Content-Type':'application/json'};
 return{
  async read():Promise<ManagedRelease[]>{
   const [rr,mr]=await Promise.all([fetcher(`${releases}?select=*&order=updated_at.desc`,{headers,cache:'no-store'}),fetcher(`${members}?select=*&order=sort_order.asc`,{headers,cache:'no-store'})]);
   if(!rr.ok||!mr.ok)throw new Error('อ่านข้อมูล Release จาก Supabase ไม่สำเร็จ');
   const releaseRows:Row[]=await rr.json(),memberRows:Row[]=await mr.json();
   if(!Array.isArray(releaseRows)||!Array.isArray(memberRows))throw new Error('ข้อมูล Release ไม่ถูกต้อง');
   const parsed=memberRows.map(member);
   return releaseRows.map(row=>release(row,parsed.filter(item=>item.releaseId===row.id)));
  },
  async save(value:ManagedRelease):Promise<ManagedRelease>{
   const body={id:value.id,origin:value.origin,name:value.name.trim(),version:value.version.trim(),release_date:value.releaseDate||null,stream:value.stream.trim(),platform:value.platform,description:value.description.trim(),archived:value.archived,updated_at:new Date().toISOString()};
   const upsert=new URL(releases);upsert.searchParams.set('on_conflict','id');
   const saved=await fetcher(upsert.toString(),{method:'POST',headers:{...headers,Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(body),cache:'no-store'});
   if(!saved.ok)throw new Error('บันทึก Release ไม่สำเร็จ');
   const remove=new URL(members);remove.searchParams.set('release_id',`eq.${value.id}`);
   const removed=await fetcher(remove.toString(),{method:'DELETE',headers:{...headers,Prefer:'return=minimal'},cache:'no-store'});
   if(!removed.ok)throw new Error('อัปเดตสมาชิก Release ไม่สำเร็จ');
   if(value.members.length){const inserted=await fetcher(members.toString(),{method:'POST',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify(value.members.map((item,index)=>({release_id:value.id,source_type:item.sourceType,feature_id:item.featureId||null,title:item.title.trim(),platform:item.platform,owner:item.owner.trim(),dev_start:item.devStart||null,dev_end:item.devEnd||null,qa_start:item.qaStart||null,qa_end:item.qaEnd||null,note:item.note.trim(),sort_order:index}))),cache:'no-store'});if(!inserted.ok)throw new Error('เพิ่มสมาชิก Release ไม่สำเร็จ');}
   return value;
  },
 };
}
export function getReleaseManagementStore(){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;if(!url||!key)throw new Error('ยังไม่ได้ตั้งค่า Supabase');return createReleaseManagementStore(url,key);}
