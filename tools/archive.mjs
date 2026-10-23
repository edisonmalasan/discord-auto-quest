import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { verifyCandidateFiles, candidateNames } from './release-policy.mjs';
export const distributionFiles=['discord-auto-quest.exe','LICENSE','NOTICE','THIRD_PARTY_NOTICES.txt','README.md','RELEASE.txt'];
export function verifyArchiveEntries(entries) {
  const remaining=new Set(distributionFiles), files=entries.filter(entry=>!entry.endsWith('/'));
  if(files.length!==remaining.size || files.some(entry=>!remaining.delete(entry))) throw new Error('Portable archive has missing, duplicate, unsafe, or unexpected entries');
}
export function fileHash(path) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }
export function checksumText(directory,version) {
  const names=candidateNames(version);
  return [names.setup,names.portable].map(name=>`${fileHash(join(directory,name))}  ${name}`).join('\n')+'\n';
}
export function verifyCandidate(directory,version) {
  verifyCandidateFiles(readdirSync(directory),version);
  const names=candidateNames(version);
  if(readFileSync(join(directory,names.checksums),'utf8')!==checksumText(directory,version)) throw new Error('Candidate checksum mismatch');
  const entries=execFileSync('tar',['-tf',join(directory,names.portable)],{encoding:'utf8'}).trim().split(/\r?\n/);
  verifyArchiveEntries(entries);
  if(readFileSync(join(directory,names.setup)).subarray(0,2).toString()!=='MZ') throw new Error('Installer is not a Windows executable');
  console.log('Candidate names, checksums, and portable contents verified');
}
