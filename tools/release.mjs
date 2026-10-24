import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { root, readVersion, checkVersion } from './version.mjs';
import { checkPayload } from './check-payload.mjs';
import { candidateNames } from './release-policy.mjs';
import { distributionFiles, checksumText, verifyCandidate, verifyArchiveEntries, zipEntries, fileHash } from './archive.mjs';
import { checkTerms } from './terms.mjs';
import { readFileSync } from 'node:fs';
import { releaseBuildMode, updaterManifest } from './updater-release.mjs';
if(process.platform!=='win32' || process.arch!=='x64') throw new Error('Release packaging requires Windows x64');
checkVersion(); checkTerms();
const version=readVersion(), names=candidateNames(version),mode=releaseBuildMode(process.env,version);
const production=mode==='production';
if(production && !process.env.TAURI_SIGNING_PRIVATE_KEY) throw new Error('Trusted release requires the production updater signing key');
// Validation builds never receive signing credentials or updater artifacts.
const buildEnv={...process.env};
if(!production) {delete buildEnv.TAURI_SIGNING_PRIVATE_KEY;delete buildEnv.TAURI_SIGNING_PRIVATE_KEY_PASSWORD;}
const target=resolve(process.env.CARGO_TARGET_DIR ?? join(root,'src-tauri/target'));
const build=join(target,'release'), output=join(root,production?'target/release':'target/validation',version);
const directory=resolve(process.env.RELEASE_OUTPUT ?? output);
if(existsSync(directory)) throw new Error('Refusing to replace an existing candidate');
execFileSync(process.execPath,[join(root,'node_modules/@tauri-apps/cli/tauri.js'),'build','--bundles','nsis',...(!production?['--config',JSON.stringify({bundle:{createUpdaterArtifacts:false}})]:[])],{cwd:root,stdio:'inherit',env:buildEnv});
const app=join(build,'discord-auto-quest.exe'); checkPayload(app);
const installers=readdirSync(join(build,'bundle/nsis')).filter(name=>name.endsWith('.exe') && name.includes(version));
if(installers.length!==1) throw new Error('Expected exactly one installer for this version');
const stage=join(root,'target/release',`stage-${version}-${Date.now()}`); mkdirSync(stage,{recursive:true});
cpSync(app,join(stage,'discord-auto-quest.exe'));
for(const file of ['LICENSE','NOTICE','THIRD_PARTY_NOTICES.txt','README.md']) cpSync(join(root,file),join(stage,file));
writeFileSync(join(stage,'RELEASE.txt'),`Discord Auto Quest ${version}\nWindows 10/11 x64, stable Discord desktop\n${production?'Updater signatures authenticate app updates; this is not a Windows Authenticode signature.':'Validation build only; not a publishable release.'}\nPortable use requires Microsoft Edge WebView2 Runtime.\nExtract this entire folder before opening the application.\nPortable builds download newer releases manually.\n`);
mkdirSync(directory,{recursive:true});
cpSync(join(build,'bundle/nsis',installers[0]),join(directory,names.setup));
execFileSync('tar',['-a','-cf',join(directory,names.portable),'-C',stage,...distributionFiles],{stdio:'inherit'});
if(production) {
 cpSync(join(build,'bundle/nsis',installers[0]+'.sig'),join(directory,names.signature));
 const signature=readFileSync(join(directory,names.signature),'utf8').trim();
 writeFileSync(join(directory,names.manifest),JSON.stringify(updaterManifest(version,signature,readFileSync(join(root,'tools/release-notes.md'),'utf8')),null,2)+'\n');
 writeFileSync(join(directory,names.checksums),checksumText(directory,version));
 verifyCandidate(directory,version);
} else {
 writeFileSync(join(directory,'VALIDATION-ONLY.txt'),'Unsigned validation build. Never upload these assets to a release. No updater manifest or signature is included.\n');
 writeFileSync(join(directory,names.checksums),[names.setup,names.portable].map(name=>`${fileHash(join(directory,name))}  ${name}`).join('\n')+'\n');
 verifyArchiveEntries(zipEntries(readFileSync(join(directory,names.portable))));
}
console.log(`Verified Windows ${mode} assets: ${directory}`);
