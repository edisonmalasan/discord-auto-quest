import { createHash, createPublicKey, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { validVersion, verifyTag } from './version.mjs';
import { candidateNames } from './release-policy.mjs';

export const releaseBase='https://github.com/edisonmalasan/discord-auto-quest/releases';
export function updaterManifest(version,signature,notes,pub_date=new Date().toISOString()) {
  if(!validVersion(version)) throw new Error('Invalid updater version');
  return {version,notes,pub_date,platforms:{'windows-x86_64':{signature:signature.trim(),url:`${releaseBase}/download/v${version}/${candidateNames(version).setup}`}}};
}
export function productionPublicKey() {
  return JSON.parse(readFileSync(new URL('../src-tauri/tauri.conf.json',import.meta.url),'utf8')).plugins.updater.pubkey;
}
export function verifyUpdaterManifest(manifest,version,signature) {
  const platforms=manifest?.platforms;
  const expected=updaterManifest(version,signature,manifest?.notes,manifest?.pub_date);
  const platform=platforms?.['windows-x86_64'],want=expected.platforms['windows-x86_64'];
  if(manifest?.version!==version || typeof manifest.notes!=='string' || !Number.isFinite(Date.parse(manifest.pub_date)) || !platforms || Object.keys(platforms).length!==1 || !platform || Object.keys(platform).length!==2 || platform.signature!==want.signature || platform.url!==want.url) throw new Error('Updater manifest does not match the exact Windows x64 release');
}
function decode(value) {
  if(typeof value!=='string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(value.trim())) throw new Error('Invalid updater signature encoding');
  return Buffer.from(value.trim(),'base64');
}
export function verifyUpdaterSignature(bytes,signature,pubkey,expectedVersion,{requireSignedVersion=true}={}) {
  if(typeof expectedVersion!=='string' || !validVersion(expectedVersion.replace(/^v+/,''))) throw new Error('Invalid expected signed version');
  const keyLines=decode(pubkey).toString('utf8').trim().split(/\r?\n/);
  const lines=decode(signature).toString('utf8').trim().split(/\r?\n/);
  const key=decode(keyLines[1]), packet=decode(lines[1]);
  if(key.length!==42 || key.subarray(0,2).toString()!=='Ed' || packet.length!==74 || !['Ed','ED'].includes(packet.subarray(0,2).toString()) || !packet.subarray(2,10).equals(key.subarray(2,10)) || lines.length!==4 || !lines[2].startsWith('trusted comment: ')) throw new Error('Invalid updater signature or public key');
  const publicKey=createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),key.subarray(10)]),format:'der',type:'spki'});
  const sig=packet.subarray(10),data=packet.subarray(0,2).toString()==='ED'?createHash('blake2b512').update(bytes).digest():bytes;
  if(!verify(null,data,publicKey,sig) || !verify(null,Buffer.concat([sig,Buffer.from(lines[2].slice(17))]),publicKey,decode(lines[3]))) throw new Error('Updater signature verification failed');
  // Match Tauri 2.14: the authenticated comment uses tab-separated key:value
  // fields. This app requires the version; the optional legacy mode mirrors
  // Tauri's compatibility behavior for signatures made by older CLIs.
  const signedVersion=lines[2].slice(17).split('\t').find(field=>field.startsWith('version:'))?.slice(8);
  if(signedVersion===undefined && requireSignedVersion) throw new Error('Updater signature is missing its signed version');
  if(signedVersion!==undefined) {
    const signed=signedVersion.replace(/^v+/,''),expected=expectedVersion.replace(/^v+/,'');
    const matches=validVersion(signed)&&validVersion(expected)?signed===expected:signedVersion===expectedVersion;
    if(!matches) throw new Error('Updater signed version does not match candidate version');
  }
}
export function releaseBuildMode(env,version) {
  if(env.GITHUB_ACTIONS==='true' && env.GITHUB_EVENT_NAME==='push' && env.GITHUB_REF?.startsWith('refs/tags/')) {
    verifyTag(env.GITHUB_REF.slice(10),version);
    if(version.split('+')[0].includes('-') || env.GITHUB_REPOSITORY!=='edisonmalasan/discord-auto-quest') throw new Error('Production release requires a trusted stable tag');
    return 'production';
  }
  return 'validation';
}
