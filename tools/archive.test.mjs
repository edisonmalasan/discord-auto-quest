// @vitest-environment node
import {it,expect} from 'vitest';
import {verifyArchiveEntries,distributionFiles,checksumText,verifyCandidate} from './archive.mjs';
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
 writeFileSync(join(dir,names.checksums),checksumText(dir,'0.2.0-beta.1'));
 expect(readFileSync(join(dir,names.checksums),'utf8')).toMatch(/^[a-f0-9]{64}  /);
 writeFileSync(join(dir,names.setup),'MZchanged');
 expect(()=>verifyCandidate(dir,'0.2.0-beta.1')).toThrow('checksum mismatch');
});
