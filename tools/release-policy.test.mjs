// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { candidateNames, verifyCandidateFiles, publicationOptions, validateEvidence } from './release-policy.mjs';
import { readFileSync } from 'node:fs';
describe('release gates', () => {
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
      hashes:{[names.setup]:'b'.repeat(64),[names.portable]:'c'.repeat(64)},
      checks:Object.fromEntries(['installation','launch','upgrade','uninstall','portable','webviewProvisioning','liveViews','recoveryAndHandoffs','acceptedQuestWorkflow'].map(name=>[name,'pass']))};
    expect(validateEvidence(evidence)).toBe(true);
    expect(()=>validateEvidence({...evidence,checks:{...evidence.checks,upgrade:'unavailable'}})).toThrow('upgrade');
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
