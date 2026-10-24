// @vitest-environment node
import {it,expect} from 'vitest';
import {verifyArchiveEntries,distributionFiles,checksumText,verifyCandidate,zipEntries} from './archive.mjs';
import {mkdtempSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {candidateNames} from './release-policy.mjs';
it('rejects missing notices, duplicated files, and path traversal in portable content',()=>{
 expect(()=>verifyArchiveEntries(distributionFiles)).not.toThrow();
 expect(()=>verifyArchiveEntries(distributionFiles.slice(1))).toThrow();
 expect(()=>verifyArchiveEntries([...distributionFiles,'../extra'])).toThrow();
 expect(()=>verifyArchiveEntries([...distributionFiles.slice(1),distributionFiles[1]])).toThrow();
});
it('rejects candidate tampering before opening the archive',()=>{
 const dir=mkdtempSync(join(tmpdir(),'daq-candidate-')), names=candidateNames('0.2.0-beta.1');
 writeFileSync(join(dir,names.setup),'MZfixture');writeFileSync(join(dir,names.portable),'fixture');
 writeFileSync(join(dir,names.signature),'signature');writeFileSync(join(dir,names.manifest),'{}');
 writeFileSync(join(dir,names.checksums),checksumText(dir,'0.2.0-beta.1'));
 expect(readFileSync(join(dir,names.checksums),'utf8')).toMatch(/^[a-f0-9]{64}  /);
 writeFileSync(join(dir,names.setup),'MZchanged');
 expect(()=>verifyCandidate(dir,'0.2.0-beta.1')).toThrow('checksum mismatch');
});

it('reads ZIP contents without a platform-specific archive utility and rejects corruption',()=>{
 const zip=readFileSync(new URL('./fixtures/portable.zip',import.meta.url));
 expect(zipEntries(zip)).toEqual(distributionFiles);
 expect(()=>zipEntries(zip.subarray(0,zip.length-8))).toThrow();
 const corrupt=Buffer.from(zip);corrupt.writeUInt32LE(0,corrupt.length-6);
 expect(()=>zipEntries(corrupt)).toThrow();
});

it('retains the complete upstream MIT notice in distributed attribution',()=>{
 const license=readFileSync(new URL('../LICENSE',import.meta.url),'utf8')
  .replace('Copyright (c) 2026 Edison Malasan','Copyright (c) 2025 Mark Terence Tiglao').trim();
 const notice=readFileSync(new URL('../NOTICE',import.meta.url),'utf8');
 expect(notice).toContain(license);
});
