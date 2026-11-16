export const trackDbToLinear=(db:number)=>10**(Math.max(-60,Math.min(12,Number.isFinite(db)?db:0))/20);
export interface ChannelControl {channel:number;gainDb:number;muted?:boolean}
export function channelGains(controls:ChannelControl[]|undefined,count:number):number[]|undefined {
 if(!controls?.length)return undefined;
 const result=Array.from({length:count},()=>1);
 for(const c of controls)if(Number.isInteger(c.channel)&&c.channel>=0&&c.channel<count)result[c.channel]=c.muted?0:trackDbToLinear(c.gainDb);
 return result;
}
/** Preserve native channel positions; never sum L/R into an accidental mono bus. */
export function connectChannelGains(ctx:BaseAudioContext,source:AudioNode,dest:AudioNode,gains:number[]|undefined){
 if(!gains?.length||gains.every(g=>g===1)){source.connect(dest);return;}
 const splitter=ctx.createChannelSplitter(gains.length),merger=ctx.createChannelMerger(gains.length);source.connect(splitter);
 for(let c=0;c<gains.length;c++){const gain=ctx.createGain();gain.gain.value=gains[c]!;splitter.connect(gain,c);gain.connect(merger,0,c);}
 merger.connect(dest);
}
export const sampleChannelGain=(gains:number[]|undefined,c:number)=>gains?.[Math.min(c,gains.length-1)]??1;
