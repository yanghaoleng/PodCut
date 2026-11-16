import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
const html=await readFile('index.html','utf8');
for(const mode of ['light','dark']) {
 assert.ok(html.includes(`href="/brand/favicon-${mode}.png" media="(prefers-color-scheme: ${mode})"`));
 for(const name of [`podkit-${mode}.png`,`favicon-${mode}.png`]) {const p=`public/brand/${name}`;assert.ok((await stat(p)).size>100);const b=await readFile(p);assert.equal(b.subarray(1,4).toString(),'PNG');}
}
for(const file of ['src/main.ts','src/ui/projectHome.ts']){const s=await readFile(file,'utf8');assert.ok(s.includes('/brand/podkit-dark.png'));assert.ok(s.includes('/brand/podkit-light.png'));}
console.log('Branding: light/dark assets and system-matched favicon/page mark present.');
