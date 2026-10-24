// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { candidateNames, verifyCandidateFiles, publicationOptions, promotionOptions, releaseFlags, validateEvidence, requiredChecks } from './release-policy.mjs';
import { readFileSync } from 'node:fs';
describe('release gates', () => {
  it('prepares stable drafts without marking drafts latest',()=>{
    expect(publicationOptions('v1.0.0','1.0.0',false)).toEqual({draft:true,prerelease:false,latest:false});
    expect(releaseFlags(publicationOptions('v1.0.0','1.0.0',false))).toEqual(['--draft=true','--prerelease=false','--latest=false']);
    expect(candidateNames('1.0.0').setup).toBe('Discord-Auto-Quest-1.0.0-windows-x64-setup.exe');
    expect(()=>publicationOptions('v1.0.0','1.0.0',true)).toThrow();
  });
  it('promotes stable to latest while keeping preview releases off latest',()=>{
    expect(releaseFlags(promotionOptions('v1.0.0','1.0.0',{isDraft:true,isPrerelease:false}))).toEqual(['--draft=false','--prerelease=false','--latest=true']);
    expect(promotionOptions('v1.1.0-rc.1','1.1.0-rc.1',{isDraft:true,isPrerelease:true})).toEqual({draft:false,prerelease:true,latest:false});
  });
  it('rejects published or incorrectly labelled drafts and tag mismatches',()=>{
    expect(()=>promotionOptions('v1.0.0','1.0.0',{isDraft:false,isPrerelease:false})).toThrow();
    expect(()=>promotionOptions('v1.0.0','1.0.0',{isDraft:true,isPrerelease:true})).toThrow();
    expect(()=>promotionOptions('v1.0.0','1.0.0-beta.1',{isDraft:true,isPrerelease:true})).toThrow();
    expect(()=>promotionOptions('v1.0.0-beta.1','1.0.0-beta.1',{isDraft:true,isPrerelease:false})).toThrow();
  });
  it('does not mistake build metadata for a prerelease',()=>{
    expect(publicationOptions('v1.0.0+build-beta.1','1.0.0+build-beta.1',false).prerelease).toBe(false);
    expect(publicationOptions('v1.0.0-rc.1+build-beta.1','1.0.0-rc.1+build-beta.1',false).prerelease).toBe(true);
  });
  it('requires exact unambiguous candidate assets', () => {
    const names=candidateNames('0.2.0-beta.1');
    expect(names.setup).toBe('Discord-Auto-Quest-0.2.0-beta.1-windows-x64-setup.exe');
    expect(names.portable).toBe('Discord-Auto-Quest-0.2.0-beta.1-windows-x64-portable.zip');
    expect(()=>verifyCandidateFiles(Object.values(names),'0.2.0-beta.1')).not.toThrow();
    expect(()=>verifyCandidateFiles([names.setup,names.setup,names.checksums],'0.2.0-beta.1')).toThrow();
    expect(()=>verifyCandidateFiles([...Object.values(names),'discord-auto-quest'],'0.2.0-beta.1')).toThrow();
  });
  it('never publishes an existing version or promotes a beta to stable', () => {
    expect(publicationOptions('v0.2.0-beta.1','0.2.0-beta.1',false)).toEqual({draft:true,prerelease:true,latest:false});
    expect(()=>publicationOptions('v0.2.0','0.2.0-beta.1',false)).toThrow();
    expect(()=>publicationOptions('v0.2.0-beta.1','0.2.0-beta.1',true)).toThrow();
  });
  it('keeps publication blocked when any packaged acceptance result is missing', () => {
    expect(()=>validateEvidence({})).toThrow();
    expect(()=>validateEvidence({installation:'unavailable'})).toThrow();
    const names=candidateNames('0.2.0-beta.1');
    const evidence={version:'0.2.0-beta.1',commit:'a'.repeat(40),windows:'Windows 11 x64',discord:'stable',
      hashes:Object.fromEntries(Object.values(names).map(name=>[name,'b'.repeat(64)])),
      checks:Object.fromEntries(requiredChecks.map(name=>[name,'pass']))};
    expect(validateEvidence(evidence)).toBe(true);
    expect(()=>validateEvidence({...evidence,checks:{...evidence.checks,upgrade:'unavailable'}})).toThrow('upgrade');
  });
  it('keeps every acceptance gate for stable releases and rejects the example record',()=>{
    const example=JSON.parse(readFileSync(new URL('../docs/release-evidence.example.json',import.meta.url),'utf8'));
    expect(()=>validateEvidence(example)).toThrow();
    const names=candidateNames('1.0.0');
    const checks=requiredChecks;
    const evidence={version:'1.0.0',commit:'a'.repeat(40),windows:'Windows 11 x64',discord:'stable',
      hashes:Object.fromEntries(Object.values(names).map(name=>[name,'b'.repeat(64)])),
      checks:Object.fromEntries(checks.map(name=>[name,'pass']))};
    expect(validateEvidence(evidence)).toBe(true);
    for(const name of checks) expect(()=>validateEvidence({...evidence,checks:{...evidence.checks,[name]:'unavailable'}})).toThrow(name);
  });
  it('permits both supported Discord media hosts in native policies',()=>{
    const config=JSON.parse(readFileSync(new URL('../src-tauri/tauri.conf.json',import.meta.url),'utf8'));
    for(const policy of [config.app.security.csp,config.app.security.devCsp]) {
      const images=policy.split(';').find(value=>value.trim().startsWith('img-src'));
      expect(images).toContain('https://cdn.discordapp.com');
      expect(images).toContain('https://media.discordapp.net');
    }
  });
});
