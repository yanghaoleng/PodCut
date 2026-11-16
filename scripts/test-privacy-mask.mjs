import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';import {build} from 'esbuild';import {mkdtemp,rm,mkdir,writeFile,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {pcm16} from './wav-test-utils.mjs';
const temp=await mkdtemp(join(tmpdir(),'podkit-privacy-'));
try{
 const mods={};for(const file of ['audio/mixSchedule','audio/exportAudio','audio/privacyMask']){const out=join(temp,file.replace('/','-')+'.mjs');await build({entryPoints:[resolve('src',file+'.ts')],outfile:out,bundle:true,plugins:[{name:'worker-url',setup(b){b.onResolve({filter:/speechProcessor\?worker&url$/},()=>({path:'worker',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export default "unused"',loader:'js'}));}}],platform:'node',format:'esm',logLevel:'silent'});Object.assign(mods,await import(pathToFileURL(out)));}
 const {buildMixSchedule,exportMixedWav,privacySample}=mods,sr=48000;
 const buffer={duration:1,sampleRate:sr,length:sr,numberOfChannels:2,getChannelData:c=>new Float32Array(sr).fill(c?.4:.2)};
 const c={id:'c',buffer,ranges:[{start:0,end:1}],privacyRanges:[{start:.2,end:.6},{start:.5,end:.7}],syncedTracks:[{id:'other',buffer,gainDb:0}],channelTracks:[{channel:0,gainDb:-6},{channel:1,gainDb:0,muted:true}]};
 for(const style of ['bleep','bird','low','silence']){
  c.privacyMaskStyle=style;const mix=buildMixSchedule([c],[]);assert.equal(mix.totalDuration,1);assert.equal(mix.hasClipGain,true);
  assert.ok(mix.sources.filter(s=>s.laneId==='primary'||s.laneId?.startsWith('synced:')).every(s=>s.offset+s.duration<=.2||s.offset>=.7));
  const wav=new DataView(await(await exportMixedWav([c],[])).arrayBuffer());const sample=(t,ch)=>pcm16(wav,Math.round(t*sr)*2+ch)/32768;
  assert.ok(Math.abs(sample(.1,0)-(.2*10**(-6/20)+.2))<.001);
  assert.ok(Math.abs(sample(.3,0)-sample(.3,1))<.0001,'mask replaces both channels incl synced track');
  if(style==='silence')assert.equal(sample(.3,0),0);
  else assert.ok(mix.sources.filter(s=>s.privacyTone).some(s=>s.buffer.getChannelData(0).some(x=>Math.abs(x)>.05)));
 }
 c.privacyRanges=[{start:0,end:1}];c.privacyMaskStyle='silence';const fullySilent=new DataView(await(await exportMixedWav([c],[])).arrayBuffer());assert.ok(fullySilent.byteLength>sr*2,'fully silent retains duration');
 const legacy=buildMixSchedule([{id:'old',buffer,ranges:c.ranges}],[]);assert.equal(legacy.sources.length,1);assert.equal(legacy.hasClipGain,false);
 assert.equal(privacySample('silence',.1,1),0);
 const root=join(temp,'project'),job=join(root,'exports','test');await mkdir(join(root,'assets'),{recursive:true});await mkdir(job,{recursive:true});
 const wav=(duration,values)=>{const frames=Math.round(duration*sr),bytes=Buffer.alloc(44+frames*values.length*2);bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(values.length,22);bytes.writeUInt32LE(sr,24);bytes.writeUInt32LE(sr*values.length*2,28);bytes.writeUInt16LE(values.length*2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(bytes.length-44,40);for(let i=0;i<frames;i++)for(let ch=0;ch<values.length;ch++)bytes.writeInt16LE(Math.round(values[ch]*32767),44+(i*values.length+ch)*2);return bytes};
 const asset=async(d,v)=>{const bytes=wav(d,v),id=createHash('sha256').update(bytes).digest('hex');await writeFile(join(root,'assets',id),bytes);return {mime:'audio/wav',blob:{diskAsset:id,bytes:bytes.length,kind:'blob',mime:'audio/wav'}}};

 const diskClip={...c,buffer:undefined,duration:1,source:await asset(1,[.2,.4]),syncedTracks:[{id:'other',name:'other',duration:1,gainDb:0,source:await asset(1,[.2,.4])}]};
 await build({entryPoints:[resolve('server/localExportWorker.ts')],outfile:join(job,'worker.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'});
 for(const style of ['bleep','bird','low','silence']){
  diskClip.privacyMaskStyle=style;diskClip.privacyRanges=[{start:.2,end:.7}];c.privacyMaskStyle=style;c.privacyRanges=diskClip.privacyRanges;
  await writeFile(join(job,'snapshot.json'),JSON.stringify({revision:'test',payload:{clips:[diskClip],music:[],gainDb:0,speechRate:1}}));
  execFileSync(process.execPath,[join(job,'worker.mjs'),root,job,'/opt/homebrew/bin/ffmpeg']);const status=JSON.parse(await readFile(join(job,'status.json'),'utf8'));assert.equal(status.done,true);assert.equal(status.duration,1);
  const raw=execFileSync('/opt/homebrew/bin/ffmpeg',['-v','error','-i',join(job,'audio.wav'),'-f','f32le','-']);
  const expected=new DataView(await(await exportMixedWav([c],[])).arrayBuffer());
  for(const t of [.1,.301,.411,.8])for(const ch of [0,1]){const sample=Math.round(t*sr)*2+ch;assert.ok(Math.abs(raw.readFloatLE(sample*4)-pcm16(expected,sample)/32768)<.0002,style+' disk matches preview PCM');}
 }
 console.log('Actual WAV worker parity passed for all four styles, source + synchronized audio masked.');
 console.log('Privacy masks passed: 4 styles, overlapping ranges, both stereo channels and synced sources removed, unchanged timeline, all-silence duration, legacy unchanged.');
}finally{await rm(temp,{recursive:true,force:true});}
