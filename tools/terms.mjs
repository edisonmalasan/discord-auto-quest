import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { root } from './version.mjs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const term='scr'+'ipt';
const pattern=new RegExp(term,'i');
export function auditText(path,text,rules) {
  return text.split(/\r?\n/).flatMap((line,index)=>{
    // A normal English word, not a reference to the restricted vocabulary.
    const tested=line.replace(/descriptions?|transcripts?/gi,'');
    if(!pattern.test(tested)) return [];
    return rules.some(rule=>rule.path===path && rule.line===line && rule.reason) ? [] : [`${path}:${index+1}`];
  });
}
export function checkTerms() {
  const config=JSON.parse(readFileSync(join(root,'tools/terms-allowlist.json'),'utf8'));
  const rules=config.lines.map(rule=>({...rule,line:Buffer.from(rule.lineBase64,'base64').toString('utf8')}));
  const paths=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
  const findings=[];
  for(const path of new Set(paths)) {
    if(path.startsWith('re/')) continue;
    if(pattern.test(path.replace(/descriptions?/gi,''))) findings.push(`${path}: filename`);
    let bytes;try {bytes=readFileSync(join(root,path));}catch {continue;}
    if(bytes.includes(0)) continue;
    const licensed=config.licensedFiles.find(rule=>rule.path===path);
    if(licensed) {
      if(createHash('sha256').update(bytes).digest('hex')!==licensed.sha256) throw new Error('Audited dependency notices changed');
      continue;
    }
    findings.push(...auditText(path,bytes.toString('utf8'),rules));
  }
  if(findings.length) throw new Error(`Public wording audit failed:\n${findings.join('\n')}`);
  console.log('Public wording audit passed');
}
if(process.argv[1]?.endsWith('terms.mjs')) checkTerms();
