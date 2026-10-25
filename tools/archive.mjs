import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { verifyCandidateFiles, candidateNames } from './release-policy.mjs';
import { productionPublicKey, verifyUpdaterManifest, verifyUpdaterSignature } from './updater-release.mjs';
import { inflateRawSync } from 'node:zlib';
import { verifyContentIdentity, auditDistribution } from './content-audit.mjs';
import { root, compareVersions } from './version.mjs';
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
  return [names.setup,names.portable,names.signature,names.manifest].map(name=>`${fileHash(join(directory,name))}  ${name}`).join('\n')+'\n';
}
export function verifyCandidate(directory,version,{pubkey=productionPublicKey(),auditOptions={}}={}) {
  verifyCandidateFiles(readdirSync(directory),version);
  const names=candidateNames(version);
  if(readFileSync(join(directory,names.checksums),'utf8')!==checksumText(directory,version)) throw new Error('Candidate checksum mismatch');
  const entries=zipEntries(readFileSync(join(directory,names.portable)));
  verifyArchiveEntries(entries);
  if(readFileSync(join(directory,names.setup)).subarray(0,2).toString()!=='MZ') throw new Error('Installer is not a Windows executable');
  const signature=readFileSync(join(directory,names.signature),'utf8').trim();
  verifyUpdaterManifest(JSON.parse(readFileSync(join(directory,names.manifest),'utf8')),version,signature);
  verifyUpdaterSignature(readFileSync(join(directory,names.setup)),signature,pubkey,version);
  if(compareVersions(version,'1.2.1')>=0) {
    const files=portableFiles(readFileSync(join(directory,names.portable)));
    verifyContentIdentity(files.get('discord-auto-quest.exe'),root,version);
    verifyInstallerContent(join(directory,names.setup),version,auditOptions);
  }
  console.log('Candidate names, checksums, updater signature/manifest, and portable contents verified');
}

export function verifyInstallerContent(path, version, auditOptions = {}, production = true) {
  const directory=mkdtempSync(join(tmpdir(),'daq-installer-audit-'));
  try {
    try {execFileSync('7z',['x','-y',`-o${directory}`,path],{stdio:'pipe'});}
    catch {throw new Error('Installer inspection requires 7-Zip and a valid NSIS candidate');}
    const applications=[];
    function walk(folder) {
      for(const entry of readdirSync(folder,{withFileTypes:true})) {
        const file=join(folder,entry.name);
        if(entry.isDirectory()) walk(file);
        else if(entry.name==='discord-auto-quest.exe') applications.push(file);
      }
    }
    walk(directory);
    if(applications.length!==1) throw new Error('Installer must contain exactly one application');
    auditDistribution(directory, auditOptions);
    verifyContentIdentity(readFileSync(applications[0]),root,version,production);
  } finally {
    if(dirname(directory)===tmpdir() && basename(directory).startsWith('daq-installer-audit-')) rmSync(directory,{recursive:true,force:true});
  }
}

export function portableFiles(bytes) {
  // Validate central-directory bounds/names before reading compressed data.
  const entries=zipEntries(bytes);
  let end=bytes.length-22;
  while(bytes.readUInt32LE(end)!==0x06054b50 || end+22+bytes.readUInt16LE(end+20)!==bytes.length) end--;
  let offset=bytes.readUInt32LE(end+16);
  const files=new Map();
  for(const name of entries) {
    const method=bytes.readUInt16LE(offset+10),size=bytes.readUInt32LE(offset+24),length=bytes.readUInt32LE(offset+20);
    if(size>64*1024*1024 || ![0,8].includes(method)) throw new Error('Unsupported portable content encoding');
    const local=bytes.readUInt32LE(offset+42),start=local+30+bytes.readUInt16LE(local+26)+bytes.readUInt16LE(local+28);
    const data=bytes.subarray(start,start+length),content=method===0?data:inflateRawSync(data,{maxOutputLength:64*1024*1024});
    if(content.length!==size) throw new Error('Portable content length mismatch');
    files.set(name,content);
    offset+=46+bytes.readUInt16LE(offset+28)+bytes.readUInt16LE(offset+30)+bytes.readUInt16LE(offset+32);
  }
  return files;
}
