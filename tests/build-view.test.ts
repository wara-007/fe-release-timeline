import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeSavedBuilds } from '../src/lib/build-view';
import type { Feature, TimelineData } from '../src/lib/types';
const feature: Feature = {id:'f1',title:'Example',year:2026,sheetId:1,sheetTitle:'Project timeline 2026',sourceRow:1,platform:'web',platformInferred:false,version:'1',stages:[],status:'done',image:'sheet-old',releaseId:'R1',stream:'web',owner:'',notes:[]};
const data: TimelineData = {features:[feature],releases:[{id:'r1',name:'R1',date:null,features:[feature],images:['sheet-old'],status:'done',stream:'web',explicit:true,platform:'web'}],source:{mode:'live',fetchedAt:'',checkedAt:'',url:''}};
test('saved release image appears in release card data immediately',()=>{
 const result=mergeSavedBuilds(data,{r1:'saved-release'});
 assert.deepEqual(result.releases[0].images,['saved-release']);
 assert.deepEqual(data.releases[0].images,['sheet-old']);
});
test('saving a feature image also updates its containing release card',()=>{
 const result=mergeSavedBuilds(data,{f1:'saved-feature'});
 assert.equal(result.features[0].image,'saved-feature');
 assert.deepEqual(result.releases[0].images,['saved-feature']);
 assert.equal(result.releases[0].features[0].image,'saved-feature');
});
test('explicit release image wins over feature image',()=>{
 assert.deepEqual(mergeSavedBuilds(data,{r1:'release',f1:'feature'}).releases[0].images,['release']);
});
test('clearing a saved image does not resurrect an old Sheet image',()=>{
 assert.deepEqual(mergeSavedBuilds(data,{r1:''}).releases[0].images,[]);
 assert.deepEqual(mergeSavedBuilds(data,{f1:''}).releases[0].images,[]);
});
test('no saved data preserves source values',()=>{
 assert.deepEqual(mergeSavedBuilds(data,{}).releases[0].images,['sheet-old']);
});
