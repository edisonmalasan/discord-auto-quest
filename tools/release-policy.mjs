import { validVersion, verifyTag } from './version.mjs';
export function candidateNames(version) {
  if (!validVersion(version)) throw new Error('Invalid candidate version');
  const prefix=`Discord-Auto-Quest-${version}-windows-x64`;
  return {setup:`${prefix}-setup.exe`,portable:`${prefix}-portable.zip`,checksums:'SHA256SUMS'};
}
export function verifyCandidateFiles(files,version) {
  const expected=Object.values(candidateNames(version)).sort();
  if (JSON.stringify([...files].sort())!==JSON.stringify(expected)) throw new Error('Candidate files are missing, duplicated, or unexpected');
}
export function publicationOptions(tag,version,exists) {
  verifyTag(tag,version);
  if(exists) throw new Error('This version already exists; choose a new version');
  return {draft:true,prerelease:isPrerelease(version),latest:false};
}
function isPrerelease(version) {
  if(!validVersion(version)) throw new Error('Invalid release version');
  return version.split('+')[0].includes('-');
}
export function promotionOptions(tag,version,release) {
  verifyTag(tag,version);
  const prerelease=isPrerelease(version);
  if(release?.isDraft!==true || release.isPrerelease!==prerelease) throw new Error('Expected a draft with the correct release channel');
  return {draft:false,prerelease,latest:!prerelease};
}
export function releaseFlags(options) {
  return ['draft','prerelease','latest'].map(name=>`--${name}=${options[name]}`);
}
export const requiredChecks=['installation','launch','upgrade','uninstall','portable','webviewProvisioning','liveViews','recoveryAndHandoffs','acceptedQuestWorkflow'];
export function validateEvidence(evidence) {
  if(!/^[a-f0-9]{40}$/.test(evidence.commit??'') || !evidence.windows || !evidence.discord) throw new Error('Missing tested environment');
  for(const check of requiredChecks) if(evidence.checks?.[check]!=='pass') throw new Error(`Unverified acceptance: ${check}`);
  const names=candidateNames(evidence.version);
  for(const file of [names.setup,names.portable]) if(!/^[a-f0-9]{64}$/.test(evidence.hashes?.[file]??'')) throw new Error('Missing tested artifact hash');
  return true;
}
