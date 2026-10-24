import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { readVersion, verifyTag, root } from './version.mjs';
import { publicationOptions, promotionOptions, releaseFlags, validateEvidence, candidateNames } from './release-policy.mjs';
import { verifyCandidate, fileHash } from './archive.mjs';
const mode=process.argv[2], version=readVersion(),tag=`v${version}`;
const gh=(args)=>execFileSync('gh',args,{cwd:root,encoding:'utf8'}).trim();
const commit=gh(['api',`repos/{owner}/{repo}/commits/${tag}`,'--jq','.sha']);
verifyTag(process.env.GITHUB_REF_NAME??tag,version);
let release;
try {release=JSON.parse(gh(['release','view',tag,'--json','isDraft,isPrerelease,assets,targetCommitish']));}
catch(error) {if(!String(error.stderr??'').includes('release not found')) throw error;}
if(mode==='draft') {
 if(process.env.GITHUB_ACTIONS!=='true' || process.env.GITHUB_EVENT_NAME!=='push' || process.env.GITHUB_REF!==`refs/tags/${tag}` || process.env.GITHUB_REPOSITORY!=='edisonmalasan/discord-auto-quest') throw new Error('Draft creation requires trusted tag CI');
 const options=publicationOptions(tag,version,Boolean(release));
 const directory=resolve(process.argv[3]??join(root,'target/release',version));verifyCandidate(directory,version);
 const assets=Object.values(candidateNames(version)).map(name=>join(directory,name));
 gh(['release','create',tag,'--verify-tag','--target',commit,...releaseFlags(options),'--title',`Discord Auto Quest ${version}`,'--notes-file',join(root,'tools/release-notes.md'),...assets]);
 console.log('Draft release created. Acceptance evidence is required before publication.');
} else if(mode==='promote') {
 const options=promotionOptions(tag,version,release);
 const evidence=JSON.parse(readFileSync(process.argv[3]??'','utf8'));validateEvidence(evidence);
 if(evidence.version!==version || evidence.commit!==commit) throw new Error('Evidence does not match this release commit');
 const expectedAssets=Object.values(candidateNames(version));
 if(release.assets.length!==expectedAssets.length || release.assets.some(asset=>!expectedAssets.includes(asset.name)) || new Set(release.assets.map(asset=>asset.name)).size!==expectedAssets.length) throw new Error('Draft assets are missing, duplicate, or unexpected');
 const directory=mkdtempSync(join(tmpdir(),'daq-publish-'));
 gh(['release','download',tag,'--dir',directory]);verifyCandidate(directory,version);
 for(const [name,hash] of Object.entries(evidence.hashes)) if(fileHash(join(directory,name))!==hash) throw new Error('Tested artifact differs from draft');
 gh(['release','edit',tag,...releaseFlags(options)]);
 console.log('Verified release published');
} else throw new Error('Expected draft or promote');
