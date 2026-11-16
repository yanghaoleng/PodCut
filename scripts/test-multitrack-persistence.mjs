import assert from 'node:assert/strict';import {build} from 'esbuild';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {pathToFileURL} from 'node:url';
const temp=await mkdtemp(join(tmpdir(),'podcut-track-persist-'));
class BufferMock{constructor({numberOfChannels,length,sampleRate}){Object.assign(this,{numberOfChannels,length,sampleRate,duration:length/sampleRate});this.channels=Array.from({length:numberOfChannels},()=>new Float32Array(length));}getChannelData(c){return this.channels[c];}copyToChannel(a,c){this.channels[c].set(a);}}
globalThis.AudioBuffer=BufferMock;
try{
 await build({entryPoints:[resolve('src/edit/draftStore.ts')],outfile:join(temp,'store.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'});
 const {projectToDraft,draftToProject,slimDraftForQuota,verifyDraftSources}=await import(pathToFileURL(join(temp,'store.mjs')));
 const b=new AudioBuffer({numberOfChannels:2,length:480,sampleRate:48000});b.getChannelData(0).fill(.2);b.getChannelData(1).fill(.4);
 const extra=new AudioBuffer({numberOfChannels:1,length:240,sampleRate:48000});extra.getChannelData(0).fill(.1);
 const c={id:'c',name:'c',privacyRanges:[{start:.001,end:.002}],privacyMaskStyle:'bird',buffer:b,cleanBuffer:b,duration:.01,words:[],ranges:[{start:0,end:.004},{start:.006,end:.01}],denoised:false,beautified:false,channelTracks:[{id:'L',name:'Speaker A',channel:0,gainDb:-6,muted:false},{id:'R',name:'Speaker B',channel:1,gainDb:-3,muted:true}],syncedTracks:[{id:'other',name:'第三轨',buffer:extra,gainDb:-12,muted:false}]};
 const p={clips:[c],music:[],gainDb:0};const d=projectToDraft({project:p,activeClipId:'c',clipIdSeq:1,musicIdSeq:0});
 assert.deepEqual(d.clips[0].channelTracks,c.channelTracks);assert.equal(d.clips[0].syncedTracks[0].buffer.channels.length,1);assert.notEqual(d.clips[0].channelTracks,c.channelTracks);
 const restored=await draftToProject(d,{decode:async()=>{throw Error('No encoded source expected')}});const r=restored.project.clips[0];assert.deepEqual(r.privacyRanges,c.privacyRanges);assert.equal(r.privacyMaskStyle,'bird');assert.deepEqual(r.channelTracks,c.channelTracks);assert.equal(r.syncedTracks[0].buffer.getChannelData(0)[0],extra.getChannelData(0)[0]);assert.deepEqual(r.ranges,c.ranges);assert.equal(r.syncedTracks[0].gainDb,-12);
 const slim=slimDraftForQuota(d);assert.ok((await verifyDraftSources(slim)).ok);assert.equal(slim.clips[0].syncedTracks.length,1);assert.equal(slim.clips[0].privacyMaskStyle,'bird');assert.deepEqual(slim.clips[0].privacyRanges,c.privacyRanges);
 const invalid=structuredClone(d);delete invalid.clips[0].syncedTracks[0].buffer;assert.equal((await verifyDraftSources(invalid)).ok,false);await assert.rejects(()=>draftToProject(invalid,{decode:async()=>b}),/无法恢复/);
 const encoded=projectToDraft({project:{...p,clips:[{...c,syncedTracks:[{...c.syncedTracks[0],sourceBlob:new Blob(['audio'],{type:'audio/wav'}),sourceMime:'audio/wav'}]}]},activeClipId:'c',clipIdSeq:1,musicIdSeq:0});assert.equal(encoded.clips[0].syncedTracks[0].source.blob.size,5);assert.equal(encoded.clips[0].syncedTracks[0].buffer,undefined);
 const legacy=projectToDraft({project:{...p,clips:[{...c,channelTracks:undefined,syncedTracks:undefined}]},activeClipId:'c',clipIdSeq:1,musicIdSeq:0});const lr=await draftToProject(legacy,{decode:async()=>b});assert.equal(lr.project.clips[0].channelTracks,undefined);assert.deepEqual(lr.project.clips[0].ranges,c.ranges);
 console.log('Multi-track persistence passed: channel names/gains/mutes, third source PCM/Blob, shared cuts, quota preservation, missing-track hard failure, legacy unchanged.');
}finally{await rm(temp,{recursive:true,force:true});}
