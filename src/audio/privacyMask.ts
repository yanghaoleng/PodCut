/** Local deterministic mask synthesis. Never sends audio to a service. */
export type PrivacyMaskStyle = 'bleep'|'bird'|'low'|'silence';
export function privacySample(style:PrivacyMaskStyle,t:number,duration:number):number {
 if(style==='silence'||t<0||t>=duration)return 0;
 const edge=Math.min(1,t/.008,(duration-t)/.008);
 if(style==='bird'){
  const u=t%.22,env=Math.sin(Math.PI*Math.min(1,u/.16))**2;
  return u>.16?0:.19*edge*env*Math.sin(2*Math.PI*(1800*u+2400*u*u));
 }
 return .19*edge*Math.sin(2*Math.PI*(style==='low'?180:1000)*t);
}
/** Real AudioBuffer in browsers; lightweight equivalent for Node sample tests. */
export function privacyBuffer(style:PrivacyMaskStyle,duration:number,sampleRate:number):AudioBuffer {
 const length=Math.max(1,Math.ceil(duration*sampleRate));
 const b=typeof AudioBuffer!=='undefined'?new AudioBuffer({numberOfChannels:1,length,sampleRate}):null;
 const data=b?.getChannelData(0)??new Float32Array(length);
 for(let i=0;i<length;i++)data[i]=privacySample(style,i/sampleRate,duration);
 return b??({duration:length/sampleRate,length,sampleRate,numberOfChannels:1,getChannelData:()=>data} as unknown as AudioBuffer);
}
