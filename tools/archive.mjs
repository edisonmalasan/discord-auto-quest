import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { verifyCandidateFiles, candidateNames } from './release-policy.mjs';
export const distributionFiles=['discord-auto-quest.exe','LICENSE','NOTICE','THIRD_PARTY_NOTICES.txt','README.md','RELEASE.txt'];
export function verifyArchiveEntries(entries) {
  const remaining=new Set(distributionFiles), files=entries.filter(entry=>!entry.endsWith('/'));
  if(files.length!==remaining.size || files.some(entry=>!remaining.delete(entry))) throw new Error('Portable archive has missing, duplicate, unsafe, or unexpected entries');
}
export function fileHash(path) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }
export function zipEntries(bytes) {
  const invalid=()=>{throw new Error('Invalid or unsupported portable ZIP');};
  let end=-1;
  for(let offset=bytes.length-22;offset>=Math.max(0,bytes.length-65557);offset--) {
    if(bytes.readUInt32LE(offset)===0x06054b50 && offset+22+bytes.readUInt16LE(offset+20)===bytes.length) {end=offset;break;}
  }
  if(end<0) return invalid();
  const count=bytes.readUInt16LE(end+10),size=bytes.readUInt32LE(end+12),start=bytes.readUInt32LE(end+16);
  if(bytes.readUInt16LE(end+4)!==0 || bytes.readUInt16LE(end+6)!==0 || bytes.readUInt16LE(end+8)!==count || count>100 || start+size!==end) return invalid();
  let offset=start;const entries=[];
  for(let index=0;index<count;index++) {
    if(offset+46>end || bytes.readUInt32LE(offset)!==0x02014b50) return invalid();
    const length=bytes.readUInt16LE(offset+28),extra=bytes.readUInt16LE(offset+30),comment=bytes.readUInt16LE(offset+32);
    const next=offset+46+length+extra+comment,local=bytes.readUInt32LE(offset+42);
    if(next>end || bytes.readUInt16LE(offset+34)!==0 || (bytes.readUInt16LE(offset+8)&1) || local+30>start || bytes.readUInt32LE(local)!==0x04034b50) return invalid();
    const name=bytes.subarray(offset+46,offset+46+length);
    const localLength=bytes.readUInt16LE(local+26),localExtra=bytes.readUInt16LE(local+28);
    if(localLength!==length || !bytes.subarray(local+30,local+30+localLength).equals(name) || local+30+localLength+localExtra+bytes.readUInt32LE(offset+20)>start) return invalid();
    entries.push(name.toString('utf8'));offset=next;
  }
  if(offset!==end) return invalid();
  return entries;
}
export function checksumText(directory,version) {
  const names=candidateNames(version);
  return [names.setup,names.portable].map(name=>`${fileHash(join(directory,name))}  ${name}`).join('\n')+'\n';
}
export function verifyCandidate(directory,version) {
  verifyCandidateFiles(readdirSync(directory),version);
  const names=candidateNames(version);
  if(readFileSync(join(directory,names.checksums),'utf8')!==checksumText(directory,version)) throw new Error('Candidate checksum mismatch');
  const entries=zipEntries(readFileSync(join(directory,names.portable)));
  verifyArchiveEntries(entries);
  if(readFileSync(join(directory,names.setup)).subarray(0,2).toString()!=='MZ') throw new Error('Installer is not a Windows executable');
  console.log('Candidate names, checksums, and portable contents verified');
}
