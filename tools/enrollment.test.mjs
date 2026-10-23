// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createDecipheriv } from 'node:crypto';
import vm from 'node:vm';
import { expect, it } from 'vitest';
const asset = new URL('../src-tauri/payload/enrollment.bin', import.meta.url);
function bridge() {
 const bytes=readFileSync(asset), key=Buffer.from(readFileSync(new URL('../src-tauri/payload/secret.key',import.meta.url),'utf8').trim(),'hex');
 const cipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12)); cipher.setAuthTag(bytes.subarray(-16));
 return Buffer.concat([cipher.update(bytes.subarray(12,-16)),cipher.final()]).toString();
}
function client(overrides={}) {
 const q={id:'123',config:{messages:{questName:'Example',gameTitle:'Game'},expiresAt:'2099-01-01',features:[],taskConfigV2:{tasks:{PLAY_ON_DESKTOP:{target:900}}},rewardsConfig:{rewards:[{type:4,orbQuantity:200}]}},...overrides};
 const store={quests:new Map([['123',q]]),getQuest:id=>store.quests.get(id),isEnrolling:()=>false,questEnrollmentBlockedUntil:null,questAccessSuspendedUntil:null};
 let calls=0, context;
 async function enroll(id,options) {
  // Shape markers are how the adapter recognizes this client action.
  const markers=['QUESTS_ENROLL_BEGIN','QUESTS_ENROLL_SUCCESS','previous_in_flight_request'];
  if(!markers.length) return; calls++; context=options;
  q.userStatus={enrolledAt:'2026-10-23'}; return {type:'success'};
 }
 const modules={one:{exports:{store}},two:{exports:{renamed:enroll}},three:{exports:{enum:{THIRD_PARTY_APP:14}}}};
 const world=vm.createContext({Date,Map,Set,Promise,DiscordNative:{},window:{},webpackChunkdiscord_app:{push:a=>a[2]({c:modules}),pop(){}}});
 const execute=(mode,revision)=>vm.runInContext(`(${bridge()})(${JSON.stringify({id:'123',mode,revision})})`,world);
 return {q,store,modules,execute,get calls(){return calls},get context(){return context}};
}
it('prepares without accepting and confirms only a live enrolled record',async()=>{
 const c=client(), offer=await c.execute('prepare'); expect(offer.status).toBe('review'); expect(c.calls).toBe(0);
 expect(offer.requirements).toEqual([{kind:'PLAY_ON_DESKTOP',target:900}]);
 const result=await c.execute('confirm',offer.revision); expect(result.status).toBe('accepted'); expect(c.calls).toBe(1);
 expect(c.context).toEqual({questContent:14,sourceQuestContent:14});
 expect((await c.execute('confirm',offer.revision)).status).toBe('accepted'); expect(c.calls).toBe(1);
});
it.each(['expired','blocked','special','changed','missing-action'])('does not dispatch for %s offers',async(kind)=>{
 const c=client(), offer=await c.execute('prepare');
 if(kind==='expired')c.q.config.expiresAt='2000-01-01';
 if(kind==='blocked')c.store.questEnrollmentBlockedUntil='2099-01-01';
 if(kind==='special')c.q.config.features=['SPECIAL'];
 if(kind==='changed')c.q.config.taskConfigV2.tasks.PLAY_ON_DESKTOP.target=1800;
 if(kind==='missing-action')delete c.modules.two;
 expect((await c.execute('confirm',offer.revision)).status).not.toBe('accepted'); expect(c.calls).toBe(0);
});
it('requires review and does not trust a success response without enrollment',async()=>{
 const c=client(); expect((await c.execute('confirm')).status).not.toBe('accepted'); expect(c.calls).toBe(0);
 c.modules.two.exports.renamed=async function(){ const markers=['QUESTS_ENROLL_BEGIN','QUESTS_ENROLL_SUCCESS','previous_in_flight_request']; return {type:markers.length?'success':'unknown_error'}; };
 const offer=await c.execute('prepare'); expect((await c.execute('confirm',offer.revision)).status).toBe('uncertain');
});
it('rejects malformed offers and unsupported tasks instead of guessing',async()=>{
 const c=client(); c.q.config.taskConfigV2.tasks={ACHIEVEMENT_IN_ACTIVITY:{target:1}};
 expect((await c.execute('prepare')).status).toBe('unsupported'); expect(c.calls).toBe(0);
 c.q.config.taskConfigV2.tasks={PLAY_ON_DESKTOP:{target:NaN}};
 expect((await c.execute('prepare')).status).toBe('unsupported');
});
it('permits the observed artwork-host feature but rejects unrecognized feature values',async()=>{
 const c=client(); c.modules.three.exports.features={QUESTS_CDN:15,EXTERNAL_DIALOG:22}; c.q.config.features=[15];
 expect((await c.execute('prepare')).status).toBe('review');
 c.q.config.features=[22]; expect((await c.execute('prepare')).status).toBe('unsupported');
 expect(c.calls).toBe(0);
});
it('serializes two confirmation calls while the client response is pending',async()=>{
 const c=client(); let finish;
 c.modules.two.exports.renamed=async function(){
  const markers=['QUESTS_ENROLL_BEGIN','QUESTS_ENROLL_SUCCESS','previous_in_flight_request'];
  await new Promise(resolve=>{finish=resolve;}); return {type:markers.length?'success':'unknown_error'};
 };
 const offer=await c.execute('prepare'); const first=c.execute('confirm',offer.revision);
 expect((await c.execute('confirm',offer.revision)).status).toBe('pending');
 finish(); expect((await first).status).toBe('uncertain');
});
it('rejects unfamiliar or combined task operators',async()=>{
 const c=client(); c.q.config.taskConfigV2.joinOperator='AND';
 expect((await c.execute('prepare')).status).toBe('unsupported');
});
