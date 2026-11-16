import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,writeFile,readFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
import {pcm16} from './wav-test-utils.mjs';
const temp=await mkdtemp(join(tmpdir(),'podcut-tracks-'));
try{
 const mods={};
 for(const file of ['audio/mixSchedule','audio/exportAudio','audio/channelMix']){const out=join(temp,file.replace('/','-')+'.mjs');await build({entryPoints:[resolve('src',file+'.ts')],outfile:out,bundle:true,plugins:[{name:'worker-url',setup(b){b.onResolve({filter:/speechProcessor\?worker&url$/},()=>({path:'worker',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export default "unused"',loader:'js'}));}}],platform:'node',format:'esm',logLevel:'silent'});Object.assign(mods,await import(pathToFileURL(out)));}
 const {buildMixSchedule,exportMixedWav,channelGains,connectChannelGains}=mods;
 const sr=48000,buffer=(duration,values)=>({duration,sampleRate:sr,length:Math.round(duration*sr),numberOfChannels:values.length,getChannelData:c=>new Float32Array(Math.round(duration*sr)).fill(values[c])});
 const source=buffer(2,[.1,.2]),extra=buffer(1.25,[.03]),bed=buffer(1.5,[.04]);
 const c={id:'body',buffer:source,ranges:[{start:0,end:.5},{start:1,end:2}],channelTracks:[{channel:0,gainDb:-6},{channel:1,gainDb:0,muted:true}],syncedTracks:[{id:'third',buffer:extra,gainDb:0}],words:[]};
 const music=[{id:'bed',kind:'bed',name:'music',clipId:'body',originalTime:0,buffer:bed,gainDb:0,fadeInSec:0,fadeOutSec:0}];
 const mix=buildMixSchedule([c],music);assert.equal(mix.totalDuration,1.5);assert.equal(mix.hasClipGain,true);
 assert.deepEqual(mix.sources.filter(s=>s.laneId==='synced:third').map(s=>[s.whenEdit,s.offset,s.duration]),[[0,0,.5],[.5,1,.25]]);
 assert.deepEqual(mix.sources.find(s=>s.laneId==='primary').channelGains,[10**(-6/20),0]);assert.equal(mix.sources.find(s=>s.role==='bed').channelGains,undefined);
 const wave=new DataView(await(await exportMixedWav([c],music)).arrayBuffer());
 const sample=(t,ch)=>pcm16(wave,Math.round(t*sr)*2+ch)/32768;
 assert.ok(Math.abs(sample(.2,0)-(.1*10**(-6/20)+.03+.04))<.0001);assert.ok(Math.abs(sample(.2,1)-.07)<.0001);
 assert.ok(Math.abs(sample(1,0)-(.1*10**(-6/20)+.04))<.0001);assert.ok(Math.abs(sample(1,1)-.04)<.0001);
 console.log('✓ L/R independent gain and mute; third mono track sums in parallel; music untouched; short tail silent; shared cuts preserve duration');
 c.syncedTracks[0].muted=true;assert.equal(buildMixSchedule([c],music).sources.filter(s=>s.laneId==='synced:third').length,0);c.syncedTracks[0].muted=false;
 const legacy=buildMixSchedule([{id:'old',buffer:source,ranges:[{start:0,end:2}]}],[]);assert.equal(legacy.sources.length,1);assert.equal(legacy.sources[0].channelGains,undefined);assert.equal(legacy.hasClipGain,false);
 assert.deepEqual(channelGains([{channel:99,gainDb:20},{channel:0,gainDb:0}],2),[1,1]);
 const connected=[];const node=()=>({gain:{value:0},connect:(...args)=>connected.push(args)});const context={createChannelSplitter:n=>{assert.equal(n,2);return node()},createChannelMerger:n=>{assert.equal(n,2);return node()},createGain:node};connectChannelGains(context,node(),node(),[.5,0]);assert.equal(connected.length,6);
 console.log('✓ Legacy drafts unchanged; invalid channel ignored; WebAudio stereo splitter/merger wiring preserves positions');
 assert.ok(Math.abs(channelGains([{channel:0,gainDb:-60}],1)[0]-.001)<1e-10);
 const st={...music[0],id:'break',kind:'stinger',originalTime:1.1,buffer:buffer(.2,[0])};
 const split=buildMixSchedule([c],[st]);assert.ok(Math.abs(split.totalDuration-1.7)<1e-8);
 for(const aux of split.sources.filter(s=>s.laneId==='synced:third'))assert.ok(split.sources.some(s=>s.laneId==='primary'&&Math.abs(s.whenEdit-aux.whenEdit)<1e-8&&Math.abs(s.offset-aux.offset)<1e-8));
 console.log('✓ Inserted music gaps split every synchronized track at identical source and edit boundaries; -60 dB gain works');

 const tempo=new DataView(await(await exportMixedWav([c],[],1,1.25)).arrayBuffer());assert.ok(Math.abs(tempo.getUint32(40,true)/6/sr-1.2)<.001);assert.ok(Math.abs(pcm16(tempo,Math.round(.25*sr)*2+1)/32768-.03)<.008);
 console.log('✓ Tempo fallback preserves simultaneous track mixing and expected duration');
 // Use genuine WAV inputs and the actual disk render worker, never private fixtures.
 const root=join(temp,'project'),job=join(root,'exports','test');await mkdir(join(root,'assets'),{recursive:true});await mkdir(job,{recursive:true});
 const wav=(duration,values)=>{const frames=Math.round(duration*sr),bytes=Buffer.alloc(44+frames*values.length*2);bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(values.length,22);bytes.writeUInt32LE(sr,24);bytes.writeUInt32LE(sr*values.length*2,28);bytes.writeUInt16LE(values.length*2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(bytes.length-44,40);for(let i=0;i<frames;i++)for(let ch=0;ch<values.length;ch++)bytes.writeInt16LE(Math.round(values[ch]*32767),44+(i*values.length+ch)*2);return bytes};
 const asset=async(d,v)=>{const bytes=wav(d,v),id=createHash('sha256').update(bytes).digest('hex');await writeFile(join(root,'assets',id),bytes);return {mime:'audio/wav',blob:{diskAsset:id,bytes:bytes.length,kind:'blob',mime:'audio/wav'}}};
 const diskClip={...c,buffer:undefined,duration:2,source:await asset(2,[.1,.2]),syncedTracks:[{id:'third',name:'third',duration:1.25,gainDb:0,source:await asset(1.25,[.03])}]};
 const diskMusic=[{...music[0],buffer:undefined,outPoint:1.5,source:await asset(1.5,[.04])}];await writeFile(join(job,'snapshot.json'),JSON.stringify({revision:'test',payload:{clips:[diskClip],music:diskMusic,gainDb:0,speechRate:1}}));
 await build({entryPoints:[resolve('server/localExportWorker.ts')],outfile:join(job,'worker.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'});
 execFileSync(process.execPath,[join(job,'worker.mjs'),root,job,'/opt/homebrew/bin/ffmpeg']);const status=JSON.parse(await readFile(join(job,'status.json'),'utf8'));assert.equal(status.done,true);assert.equal(status.duration,1.5);
 const raw=execFileSync('/opt/homebrew/bin/ffmpeg',['-v','error','-i',join(job,'audio.wav'),'-f','f32le','-']);const diskSample=(t,ch)=>raw.readFloatLE((Math.round(t*sr)*2+ch)*4);
 assert.ok(Math.abs(diskSample(.2,0)-sample(.2,0))<.0001);assert.ok(Math.abs(diskSample(.2,1)-sample(.2,1))<.0001);assert.ok(Math.abs(diskSample(1,1)-sample(1,1))<.0001);
 console.log('✓ Actual disk worker renders three synchronized voice tracks plus music, agreeing with browser fallback samples');
}catch(e){console.error(e);process.exitCode=1;}finally{await rm(temp,{recursive:true,force:true});}
