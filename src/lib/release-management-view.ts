import type { Feature, Platform, Release, Stage, TimelineData } from './types';
import type { ManagedRelease, ManagedReleaseMember } from './release-management';
import type { ManagedFeature } from './managed-feature-store';

function customFeature(item:ManagedReleaseMember,release:ManagedRelease):Feature{
 const stages:Stage[]=[];
 if(item.devStart)stages.push({kind:'dev',label:'Dev FE',start:item.devStart,end:item.devEnd||item.devStart,note:item.note,tentative:false});
 if(item.qaStart)stages.push({kind:'qa',label:'QA',start:item.qaStart,end:item.qaEnd||item.qaStart,note:item.note,tentative:false});
 const year=Number((release.releaseDate||item.devStart||String(new Date().getFullYear())).slice(0,4));
 return{id:`custom:${item.id}`,title:item.title,year,sheetId:0,sheetTitle:'Release room',sourceRow:0,platform:item.platform,platformInferred:false,version:release.version,stages,status:'unknown',image:'',releaseId:release.name,stream:release.stream,owner:item.owner,notes:item.note?[item.note]:[]};
}
function missingSheetFeature(item:ManagedReleaseMember,release:ManagedRelease):Feature{return{id:`missing:${item.featureId}`,title:`ไม่พบงานจาก Sheet (${item.featureId})`,year:Number((release.releaseDate||String(new Date().getFullYear())).slice(0,4)),sheetId:0,sheetTitle:'งานต้นทางอาจถูกย้ายหรือลบ',sourceRow:0,platform:'unknown',platformInferred:false,version:release.version,stages:[],status:'unknown',image:'',releaseId:release.name,stream:release.stream,owner:'',notes:['กรุณาแก้ไข Release และเลือกงานจาก Sheet ใหม่']};}
export function managedFeatureView(item:ManagedFeature):Feature{const year=Number((item.devStart||item.qaStart||item.createdAt||String(new Date().getFullYear())).slice(0,4));const stages:Stage[]=[];if(item.devStart)stages.push({kind:'dev',label:'FE Development',start:item.devStart,end:item.devEnd||item.devStart,note:'',tentative:false});if(item.qaStart)stages.push({kind:'qa',label:'QA',start:item.qaStart,end:item.qaEnd||item.qaStart,note:'',tentative:false});return{id:item.id,title:item.title,year,sheetId:0,sheetTitle:'Release room',sourceRow:0,platform:item.platform,platformInferred:false,version:'',stages,status:item.status,image:'',releaseId:'',stream:'',owner:item.owner,notes:item.note?[item.note]:[]};}
function combinedPlatform(features:Feature[],fallback:Platform):Platform{const values=new Set(features.map(f=>f.platform));return values.size===1?features[0]?.platform||fallback:values.has('shared')||(values.has('web')&&values.has('app'))?'shared':fallback;}

export function mergeManagedReleases(data:TimelineData,managed:ManagedRelease[],managedFeatures:ManagedFeature[]=[]):TimelineData{
 const active=managed.filter(item=>!item.archived),archived=new Set(managed.filter(item=>item.archived).map(item=>item.id));
 const claimed=new Set(active.flatMap(item=>item.members.filter(member=>member.sourceType!=='custom').map(member=>member.featureId)));
 const featureViews=managedFeatures.filter(item=>!item.archived).map(managedFeatureView);
 const sourceFeatures=new Map([...data.features,...featureViews].map(feature=>[feature.id,feature]));
 const featureUpdates=new Map<string,Feature>();
 const releases:Release[]=data.releases.filter(release=>!archived.has(release.id)&&!active.some(item=>item.id===release.id)).map(release=>({...release,features:release.features.filter(feature=>!claimed.has(feature.id))})).filter(release=>release.features.length>0);
 const custom:Feature[]=[];
 for(const item of active){
  const features=item.members.map(member=>{if(member.sourceType==='custom'){const feature=customFeature(member,item);custom.push(feature);return feature;}const source=sourceFeatures.get(member.featureId);if(!source){const feature=missingSheetFeature(member,item);custom.push(feature);return feature;}const updated={...source,releaseId:item.name,stream:item.stream,version:item.version||source.version};featureUpdates.set(source.id,updated);return updated;});
  releases.push({id:item.id,name:item.name,date:item.releaseDate||null,features,images:[...new Set(features.map(feature=>feature.image).filter(Boolean))],status:'unknown',stream:item.stream,explicit:true,platform:combinedPlatform(features,item.platform),tags:item.tags});
 }
 const features=[...data.features,...featureViews].map(feature=>featureUpdates.get(feature.id)||feature).concat(custom);
 return{...data,features,releases:releases.sort((a,b)=>(a.date||'9999-12-31').localeCompare(b.date||'9999-12-31'))};
}
