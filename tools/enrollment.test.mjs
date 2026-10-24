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
 const q={id:'123',config:{id:'123',configVersion:2,messages:{questName:'Example',gameTitle:'Game'},expiresAt:'2099-01-01',features:[],taskConfigV2:{joinOperator:'or',tasks:{PLAY_ON_DESKTOP:{type:'PLAY_ON_DESKTOP',target:900}}},rewardsConfig:{rewards:[{type:4,orbQuantity:200}]}},...overrides};
 const store={quests:new Map([['123',q]]),getQuest:id=>store.quests.get(id),isEnrolling:()=>false,questEnrollmentBlockedUntil:null,questAccessSuspendedUntil:null};
 let calls=0, context;
 async function enroll(id,options) {
  // Shape markers are how the adapter recognizes this client action.
  const markers=['QUESTS_ENROLL_BEGIN','QUESTS_ENROLL_SUCCESS','previous_in_flight_request'];
  if(!markers.length) return; calls++; context=options;
  q.userStatus={questId:id,enrolledAt:'2026-10-23T00:00:00Z'}; return {type:'success'};
 }
 const modules={one:{exports:{store}},two:{exports:{renamed:enroll}},three:{exports:{enum:{THIRD_PARTY_APP:14}}}};
 const world=vm.createContext({Date,Map,Set,Promise,DiscordNative:{},window:{},webpackChunkdiscord_app:{push:a=>a[2]({c:modules}),pop(){}}});
 const execute=(mode,revision)=>vm.runInContext(`(${bridge()})(${JSON.stringify({id:'123',mode,revision})})`,world);
 return {q,store,modules,execute,world,get calls(){return calls},get context(){return context}};
}
function multiPlatform(c,initial=null) {
 let selected=initial,calls=0;
 c.q.config.taskConfigV2.tasks.PLAY_ON_XBOX={type:'PLAY_ON_XBOX',target:900,applications:[],externalIds:[]};
 c.q.config.taskConfigV2.tasks.PLAY_ON_PLAYSTATION={type:'PLAY_ON_PLAYSTATION',target:900,applications:[],externalIds:[]};
 c.store.selectedTaskPlatform=()=>selected;
 function select(id,platform) { const marker='QUESTS_SELECT_TASK_PLATFORM'; if(marker&&id==='123'){calls++;selected=platform;} }
 c.modules.platform={exports:{select,platforms:{DESKTOP:'DESKTOP',CONSOLE:'CONSOLE'}}};
 return {get calls(){return calls},get selected(){return selected},set selected(value){selected=value}};
}
it('reviews multi-platform Orbs offers as Desktop without enrollment or selection',async()=>{
 const c=client(),p=multiPlatform(c);c.q.config.rewardsConfig.rewards[0].orbQuantity=731;
 const review=await c.execute('prepare');
 expect(review).toMatchObject({status:'review',platform:'desktop',requiresDesktopSelection:true,reward:'731 Orbs',requirements:[{kind:'PLAY_ON_DESKTOP',target:900}]});
 expect(c.calls).toBe(0);expect(p.calls).toBe(0);
 const result=await c.execute('confirm',review.revision);
 expect(result).toMatchObject({status:'accepted',desktopSelection:'selected'});
 expect(c.calls).toBe(1);expect(p.calls).toBe(1);expect(p.selected).toBe('DESKTOP');
 await c.execute('confirm',review.revision);expect(c.calls).toBe(1);expect(p.calls).toBe(1);
});
it('selects Desktop only on an accepted eligible quest without enrolling',async()=>{
 const c=client(),p=multiPlatform(c);
 expect((await c.execute('select-desktop')).status).toBe('blocked');expect(p.calls).toBe(0);
 c.q.userStatus={questId:'123',enrolledAt:'2026-10-23T00:00:00Z'};
 expect((await c.execute('select-desktop')).status).toBe('selected');expect(c.calls).toBe(0);expect(p.calls).toBe(1);
 expect((await c.execute('select-desktop')).status).toBe('selected');expect(p.calls).toBe(1);
 p.selected='CONSOLE';expect((await c.execute('select-desktop')).status).toBe('blocked');expect(p.selected).toBe('CONSOLE');
});
it('reports confirmed acceptance separately from failed Desktop selection',async()=>{
 const c=client();multiPlatform(c);
 c.modules.platform.exports.select=function(id,platform){const marker='QUESTS_SELECT_TASK_PLATFORM';if(marker&&id&&platform)throw Error('selection failed')};
 const review=await c.execute('prepare');const result=await c.execute('confirm',review.revision);
 expect(result).toMatchObject({status:'accepted',desktopSelection:'unconfirmed'});expect(result.message).toMatch(/accepted/i);
 await c.execute('confirm',review.revision);expect(c.calls).toBe(1);
});
it('keeps selection inspection read-only and rejects unknown console schema',async()=>{
 const c=client(),p=multiPlatform(c);
 const inspection=await c.execute('inspect');
 expect(inspection.quests[0]).toMatchObject({id:'123',nativePlatform:null,desktopSelectionSupported:true});expect(c.calls+p.calls).toBe(0);
 c.q.config.taskConfigV2.tasks.PLAY_ON_XBOX.futureRequirement=true;
 expect((await c.execute('prepare')).status).toBe('unsupported');expect(c.calls+p.calls).toBe(0);
});
it.each(['missing-action','ambiguous-action','missing-reader'])('requires unambiguous native selection before offering acceptance: %s',async(kind)=>{
 const c=client(),p=multiPlatform(c);
 if(kind==='missing-action')delete c.modules.platform.exports.select;
 if(kind==='ambiguous-action')c.modules.duplicate={exports:{second:function(id,platform){const marker='QUESTS_SELECT_TASK_PLATFORM';return [marker,id,platform]}}};
 if(kind==='missing-reader')delete c.store.selectedTaskPlatform;
 expect((await c.execute('prepare')).status).toBe('unsupported');expect(c.calls+p.calls).toBe(0);
});
it('does not change an actively worked platform or infer success without native readback',async()=>{
 const c=client(),p=multiPlatform(c);c.q.userStatus={questId:'123',enrolledAt:'2026-10-23T00:00:00Z'};
 vm.runInContext('window.__daq={phase:"working",questId:"123"}',c.world);
 expect((await c.execute('select-desktop')).status).toBe('blocked');expect(p.calls).toBe(0);
 vm.runInContext('window.__daq=null',c.world);
 c.modules.platform.exports.select=function(id,platform){const marker='QUESTS_SELECT_TASK_PLATFORM';return [marker,id,platform]};
 expect((await c.execute('select-desktop')).status).toBe('uncertain');expect(c.calls).toBe(0);
});
it('keeps mixed Orbs rewards visible to the reader but outside standard acceptance',async()=>{
 const c=client();c.q.config.rewardsConfig.rewards.push({type:3,name:'Other item'});
 expect((await c.execute('prepare')).message).toMatch(/standard Orbs rewards/);expect(c.calls).toBe(0);
});
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
it.each(['version','consent','task-type','task-extra','config-extra'])('never dispatches unreviewed schema changes: %s',async(kind)=>{
 const c=client();
 if(kind==='version')c.q.config.configVersion=3;
 if(kind==='consent')c.q.config.consent={required:true,text:'Additional agreement'};
 if(kind==='config-extra')c.q.config.futureBehavior=true;
 if(kind==='task-type')c.q.config.taskConfigV2.tasks.PLAY_ON_DESKTOP.type='ACHIEVEMENT_IN_GAME';
 if(kind==='task-extra')c.q.config.taskConfigV2.tasks.PLAY_ON_DESKTOP.consent={required:true};
 const offer=await c.execute('prepare');
 await c.execute('confirm',offer.revision); expect(c.calls).toBe(0); expect(offer.status).toBe('unsupported');
});
it.each([{questId:'123',enrolledAt:{pending:true}},{questId:'123',enrolledAt:'not-a-date'},{questId:'456',enrolledAt:'2026-10-23'}])('never reports malformed enrollment as accepted',async(userStatus)=>{
 const c=client({userStatus}); expect((await c.execute('prepare')).status).not.toBe('accepted'); expect(c.calls).toBe(0);
});
it('requires valid matching enrollment evidence after dispatch',async()=>{
 const c=client(); c.modules.two.exports.renamed=async function(){
  const markers=['QUESTS_ENROLL_BEGIN','QUESTS_ENROLL_SUCCESS','previous_in_flight_request'];
  c.q.userStatus={questId:'123',enrolledAt:{pending:!!markers.length}};return {type:'success'};
 };
 const offer=await c.execute('prepare'); expect((await c.execute('confirm',offer.revision)).status).toBe('uncertain');
});

it.each(['unexpected','unreadable'])('does not change an unknown native platform: %s',async(kind)=>{
 const c=client(),p=multiPlatform(c);c.q.userStatus={questId:'123',enrolledAt:'2026-10-23T00:00:00Z'};
 c.store.selectedTaskPlatform=()=>{if(kind==='unreadable')throw Error('unreadable');return 'FUTURE_PLATFORM'};
 expect((await c.execute('inspect')).quests[0].desktopSelectionSupported).toBe(false);
 expect((await c.execute('select-desktop')).status).toBe('unsupported');expect(c.calls+p.calls).toBe(0);
});

it('retains accepted-state diagnostics without inventing Desktop selection for an expired video',async()=>{
 const c=client();c.q.config.taskConfigV2.tasks={WATCH_VIDEO:{type:'WATCH_VIDEO',target:9}};
 c.q.config.expiresAt='2000-01-01';c.q.userStatus={questId:'123',enrolledAt:'2026-10-23T00:00:00Z'};
 const result=await c.execute('prepare');expect(result).toMatchObject({status:'accepted',desktopSelection:'not-required'});
 expect(result.message).toMatch(/already accepted.*ended/i);expect(c.calls).toBe(0);
});
