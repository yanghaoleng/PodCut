import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
class Element {
 constructor(){this.children=[];this.style={};this.listeners={};this.attrs={};this.value='';this.files=[];}
 append(...xs){this.children.push(...xs);}
 replaceChildren(...xs){this.children=xs;}
 setAttribute(k,v){this.attrs[k]=v;}
 addEventListener(k,fn){this.listeners[k]=fn;}
 click(){this.clicked=true;return this.listeners.click?.({currentTarget:this});}
}
const ids=new Map();const get=id=>{if(!ids.has(id))ids.set(id,new Element());return ids.get(id);};
const base={id:'body',name:'录音',buffer:{numberOfChannels:2,duration:10},words:[],ranges:[{start:0,end:2},{start:4,end:10}]};
const teaser={...base,id:'teaser',name:'片头'};const mono={...base,id:'mono',buffer:{numberOfChannels:1,duration:10}};
let active=base,saves=0,syncs=0,decodeCount=0;const messages=[];
const context={console,Blob,crypto,project:{clips:[base,teaser,mono]},document:{querySelector:get,createElement:()=>new Element()},getActiveClip:()=>active,syncEngineFromProject:()=>syncs++,scheduleDraftSave:()=>saves++,toast:m=>messages.push(m),fmt:n=>String(n),engine:{decodeArrayBuffer:async()=>{decodeCount++;return {numberOfChannels:1,duration:8,length:8000};}}};
vm.createContext(context);
const source=fs.readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
vm.runInContext(source.slice(source.indexOf('function formatTrackGainDb('),source.indexOf('function renderSpeakerInspector() {')),context);
context.renderChannelTrackInspector();assert.equal(get('#btn-split-channels').disabled,false);
get('#btn-split-channels').click();assert.equal(base.channelTracks.length,2);assert.equal(base.channelTracks[0].channel,0);assert.equal(base.channelTracks[1].channel,1);
let row=get('#channel-tracks-list').children[0];let gain=row.children[1].children[1];gain.value='-60';gain.listeners.input();assert.equal(base.channelTracks[0].gainDb,-60);assert.equal(row.children[1].children[2].textContent,'-60.0 dB');
row.children[0].children[1].click();assert.equal(base.channelTracks[0].muted,true);
get('#btn-link-channel-settings').click();assert.equal(teaser.channelTracks[0].muted,true);assert.notEqual(teaser.channelTracks,base.channelTracks);assert.equal(mono.channelTracks,undefined);
assert.deepEqual(base.ranges,[{start:0,end:2},{start:4,end:10}]);
active=mono;context.renderChannelTrackInspector();assert.equal(get('#btn-split-channels').disabled,true);
active=base;context.renderSyncedTrackInspector();get('#btn-import-synced-track').click();const input=get('#file-synced-track');assert.equal(input.clicked,true);
input.files=[{name:'guest.wav',type:'audio/wav',arrayBuffer:async()=>new ArrayBuffer(8)}];await input.listeners.change({currentTarget:input});assert.equal(decodeCount,1);assert.equal(base.syncedTracks.length,1);assert.equal(base.syncedTracks[0].name,'guest');assert.ok(base.syncedTracks[0].sourceBlob instanceof Blob);assert.equal(base.syncedTracks[0].gainDb,0);
row=get('#synced-tracks-list').children[0];row.children[0].children[1].click();assert.equal(base.syncedTracks[0].muted,true);
row=get('#synced-tracks-list').children[0];gain=row.children[1].children[1];gain.value='-6';gain.listeners.input();assert.equal(base.syncedTracks[0].gainDb,-6);
row.children[2].children[1].click();assert.equal(base.syncedTracks.length,0);assert.ok(messages.some(m=>m.includes('原始文件未删除')));assert.ok(saves>=6);assert.ok(syncs>=6);
assert.deepEqual(base.ranges,[{start:0,end:2},{start:4,end:10}]);
console.log('Channel UI: split/mute/gain/link, mono guard, local synchronized import/edit/remove, and immutable cut ranges passed.');
context.activeWordId=null;context.wordClipboard={hasSyncedTracks:true};
vm.runInContext(source.slice(source.indexOf('function pasteWordsAtAnchor('),source.indexOf('function pasteWordsAtStart(')),context);
assert.equal(context.pasteWordsAtAnchor(),false);
context.wordClipboard={hasSyncedTracks:false};base.syncedTracks=[{id:'guest'}];assert.equal(context.pasteWordsAtAnchor(),false);
assert.ok(messages.some(m=>m.includes('以免音轨错位')));
assert.ok(source.includes('此处波形与试听仅为主录音原音'));
console.log('Cross-source paste is blocked for synchronized source or destination; raw audition limitation is visible.');
