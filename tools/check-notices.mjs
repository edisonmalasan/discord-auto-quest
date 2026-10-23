import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {root} from './version.mjs';
const proof=JSON.parse(readFileSync(join(root,'tools/notices-audit.json'),'utf8'));
for(const [path,expected] of Object.entries(proof)) {
 const actual=createHash('sha256').update(readFileSync(join(root,path))).digest('hex');
 if(actual!==expected) throw new Error('Dependency notices need a fresh audit: '+path);
}
console.log('Dependency lockfiles and audited notices match');
