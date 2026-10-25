// @vitest-environment node
import { it, expect } from 'vitest';
import { generateKeyPairSync, sign, createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyCandidate, checksumText } from './archive.mjs';
import { candidateNames, validateEvidence, requiredChecks } from './release-policy.mjs';
import { updaterManifest, verifyUpdaterSignature, releaseBuildMode } from './updater-release.mjs';

export function fixture(version='1.1.0',signedVersion=version) {
  const directory=mkdtempSync(join(tmpdir(),'daq-signed-'));
  const names=candidateNames(version),bytes=Buffer.from('MZsigned fixture');
  const {publicKey,privateKey}=generateKeyPairSync('ed25519');
  const id=Buffer.from('0102030405060708','hex');
  const key=Buffer.concat([Buffer.from('Ed'),id,publicKey.export({type:'spki',format:'der'}).subarray(-32)]);
  const pubkey=Buffer.from(`untrusted comment: fixture\n${key.toString('base64')}\n`).toString('base64');
  const signature=sign(null,createHash('blake2b512').update(bytes).digest(),privateKey);
  const trusted='timestamp:123'+(signedVersion===null?'':`\tversion:${signedVersion}`);
  const packet=Buffer.concat([Buffer.from('ED'),id,signature]);
  const global=sign(null,Buffer.concat([signature,Buffer.from(trusted)]),privateKey);
  const encoded=Buffer.from(`untrusted comment: signature\n${packet.toString('base64')}\ntrusted comment: ${trusted}\n${global.toString('base64')}\n`).toString('base64');
  writeFileSync(join(directory,names.setup),bytes);
  writeFileSync(join(directory,names.portable),readFileSync(new URL('./fixtures/portable.zip',import.meta.url)));
  writeFileSync(join(directory,names.signature),encoded+'\n');
  writeFileSync(join(directory,names.manifest),JSON.stringify(updaterManifest(version,encoded,'Release notes','2026-10-24T00:00:00Z'))+'\n');
  writeFileSync(join(directory,names.checksums),checksumText(directory,version));
  return {directory,names,pubkey,bytes,encoded};
}

it('verifies the signed installer, manifest signature binding, and all four checksums',()=>{
  const f=fixture();
  expect(()=>verifyCandidate(f.directory,'1.1.0',{pubkey:f.pubkey})).not.toThrow();
  expect(readFileSync(join(f.directory,f.names.checksums),'utf8').trim().split('\n')).toHaveLength(4);
  writeFileSync(join(f.directory,f.names.setup),'MZtampered');
  writeFileSync(join(f.directory,f.names.checksums),checksumText(f.directory,'1.1.0'));
  expect(()=>verifyCandidate(f.directory,'1.1.0',{pubkey:f.pubkey})).toThrow(/signature/i);
});

it('rejects a validly checksummed manifest redirected to a different release or version',()=>{
  for(const mutation of ['url','version','signature','platform']) {
    const f=fixture(),manifest=JSON.parse(readFileSync(join(f.directory,f.names.manifest),'utf8'));
    if(mutation==='version') manifest.version='1.0.0';
    if(mutation==='url') manifest.platforms['windows-x86_64'].url='https://example.com/setup.exe';
    if(mutation==='signature') manifest.platforms['windows-x86_64'].signature='forged';
    if(mutation==='platform') manifest.platforms['linux-x86_64']=manifest.platforms['windows-x86_64'];
    writeFileSync(join(f.directory,f.names.manifest),JSON.stringify(manifest));
    writeFileSync(join(f.directory,f.names.checksums),checksumText(f.directory,'1.1.0'));
    expect(()=>verifyCandidate(f.directory,'1.1.0',{pubkey:f.pubkey})).toThrow(/manifest/i);
  }
});

it('rejects corrupted trusted comments and keys even when installer bytes match',()=>{
  const f=fixture();
  expect(()=>verifyUpdaterSignature(f.bytes,f.encoded,f.pubkey,'1.1.0')).not.toThrow();
  const altered=Buffer.from(Buffer.from(f.encoded,'base64').toString().replace('timestamp:123','timestamp:124')).toString('base64');
  expect(()=>verifyUpdaterSignature(f.bytes,altered,f.pubkey,'1.1.0')).toThrow(/signature/i);
  expect(()=>verifyUpdaterSignature(f.bytes,f.encoded,fixture().pubkey,'1.1.0')).toThrow(/signature/i);
});

it('rejects a valid older signature relabeled as a newer manifest release',()=>{
  const f=fixture('1.3.0','1.2.0');
  expect(()=>verifyCandidate(f.directory,'1.3.0',{pubkey:f.pubkey})).toThrow(/signed version/i);
});

it('rejects validation content even with matching checksums and a valid installer signature',()=>{
  const f=fixture('1.2.1');
  expect(()=>verifyCandidate(f.directory,'1.2.1',{pubkey:f.pubkey})).toThrow(/content identity/i);
});

it('matches Tauri signed-version normalization without confusing build metadata',()=>{
  const f=fixture('1.1.0','v1.1.0');
  expect(()=>verifyUpdaterSignature(f.bytes,f.encoded,f.pubkey,'1.1.0')).not.toThrow();
  const build=fixture('1.1.0+build.2','1.1.0+build.1');
  expect(()=>verifyUpdaterSignature(build.bytes,build.encoded,build.pubkey,'1.1.0+build.2')).toThrow(/signed version/i);
  const legacy=fixture('1.1.0',null);
  expect(()=>verifyUpdaterSignature(legacy.bytes,legacy.encoded,legacy.pubkey,'1.1.0',{requireSignedVersion:false})).not.toThrow();
  expect(()=>verifyUpdaterSignature(legacy.bytes,legacy.encoded,legacy.pubkey,'1.1.0')).toThrow(/missing.*signed version/i);
});

it('verifies a real installed Tauri CLI signature and rejects a relabeled version',()=>{
  const f=JSON.parse(readFileSync(new URL('./fixtures/updater-tauri-cli.json',import.meta.url),'utf8'));
  const bytes=Buffer.from(f.bytes,'base64');
  expect(()=>verifyUpdaterSignature(bytes,f.signature,f.pubkey,'1.1.0')).not.toThrow();
  expect(()=>verifyUpdaterSignature(bytes,f.signature,f.pubkey,'1.3.0')).toThrow(/signed version/i);
});

it('requires production signing only for trusted stable tag builds and isolates validation',()=>{
  expect(releaseBuildMode({GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/tags/v1.1.0',GITHUB_REPOSITORY:'edisonmalasan/discord-auto-quest'},'1.1.0')).toBe('production');
  expect(releaseBuildMode({GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/tags/v1.1.0+build-beta.1',GITHUB_REPOSITORY:'edisonmalasan/discord-auto-quest'},'1.1.0+build-beta.1')).toBe('production');
  for(const env of [{},{GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'pull_request',GITHUB_REF:'refs/pull/1/merge'},{GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/heads/main'}]) expect(releaseBuildMode(env,'1.1.0')).toBe('validation');
  expect(()=>releaseBuildMode({GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/tags/v1.1.0-rc.1',GITHUB_REPOSITORY:'edisonmalasan/discord-auto-quest'},'1.1.0-rc.1')).toThrow();
});

it('requires acceptance evidence to bind all five exact assets and updater scenarios',()=>{
  const names=candidateNames('1.1.0');
  const evidence={version:'1.1.0',commit:'a'.repeat(40),windows:'Windows 11 x64',discord:'stable',hashes:Object.fromEntries(Object.values(names).map(n=>[n,'b'.repeat(64)])),checks:Object.fromEntries(requiredChecks.map(n=>[n,'pass']))};
  expect(requiredChecks).toContain('confirmedUpdate');
  expect(validateEvidence(evidence)).toBe(true);
  delete evidence.hashes[names.manifest];
  expect(()=>validateEvidence(evidence)).toThrow(/hash/);
});
it('keeps GitHub draft lifecycle fields out of stable update notes',()=>{
 const notes='## Overview\nA new workspace.\n**Status:** Draft\n**Release Date:** TBD\n## New Features\n- Pending cards.';
 const manifest=updaterManifest('1.3.0','signature',notes);
 expect(manifest.notes).toContain('Pending cards.');expect(manifest.notes).toContain('A new workspace.');
 expect(manifest.notes).not.toContain('Draft');expect(manifest.notes).not.toContain('TBD');
});
