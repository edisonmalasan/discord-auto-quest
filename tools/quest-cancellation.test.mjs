// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createDecipheriv } from 'node:crypto';
import vm from 'node:vm';
import { afterEach, expect, it, vi } from 'vitest';

function operation() {
  const bytes = readFileSync(new URL('../src-tauri/payload/auto-quest.bin', import.meta.url));
  const key = Buffer.from(readFileSync(new URL('../src-tauri/payload/secret.key', import.meta.url), 'utf8').trim(), 'hex');
  const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0,12));
  cipher.setAuthTag(bytes.subarray(-16));
  return Buffer.concat([cipher.update(bytes.subarray(12,-16)),cipher.final()]).toString();
}
function client(kind, pendingGet = false, pendingPost = false, setupFailure = false) {
  vi.useFakeTimers();
  let resolveGet, resolvePost;
  const get = vi.fn(() => pendingGet ? new Promise(resolve => { resolveGet = resolve; }) : Promise.resolve({body:[{id:'game',name:'Example',executables:[{os:'win32',name:'example.exe'}]}]}));
  const post = vi.fn(() => pendingPost ? new Promise(resolve => { resolvePost=resolve; }) : Promise.resolve({body:{quest_id:'123',progress:{[kind]:{value:100}},completed_at:null}}));
  const world = vm.createContext({kind,get,post,setupFailure,setTimeout,clearTimeout,console:{log(){}},DiscordNative:{},window:{__daqRequest:{questId:'123',taskKind:kind},failCleanup:setupFailure}});
  vm.runInContext(`
    const quest={id:'123',config:{application:{id:'game'},messages:{questName:'Example'},expiresAt:'2099-01-01',taskConfigV2:{tasks:{[kind]:{target:100}}}},userStatus:{enrolledAt:'2026-10-01',progress:{[kind]:{value:0}}}};
    class Quests { getQuest(id){return this.quests.get(id);} } const store=new Quests();store.quests=new Map([['123',quest]]);
    class Streaming { getStreamerActiveStreamMetadata(){return 'original';} } const streaming=new Streaming(); const originalStream=streaming.getStreamerActiveStreamMetadata;
    const games={getRunningGames:()=>[],getGameForPID(){}};const originalGames=games.getRunningGames;
    class Channels { getAllThreadsForParent(){} getSortedPrivateChannels(){return [{id:'local'}];} }
    const callbacks=new Set();class Dispatcher { flushWaitQueue(){} dispatch(){} subscribe(type,fn){callbacks.add(fn);if(setupFailure)throw new Error('setup failure');} unsubscribe(type,fn){if(window.failCleanup)throw new Error('cleanup failure');callbacks.delete(fn);} }
    const api={get,post}; const modules={quests:{exports:{A:store}},stream:{exports:{A:streaming}},games:{exports:{Ay:games}},channels:{exports:{A:new Channels()}},guilds:{exports:{Ay:{getSFWDefaultChannel(){}}}},dispatcher:{exports:{h:new Dispatcher()}},api:{exports:{Bo:api}}};
    const webpackChunkdiscord_app={push:a=>a[2]({c:modules}),pop(){}};
  `,world);
  vm.runInContext(`(function(){${operation()}})()`,world);
  return {world,get,post,resolvePost:()=>resolvePost({body:{quest_id:'123',completed_at:'2026-10-24T01:00:00Z',progress:{[kind]:{value:100}}}}),resolveGet:()=>resolveGet({body:[{id:'game',name:'Example'}]}),stop:()=>vm.runInContext('window.__daq.stop()',world),value:code=>vm.runInContext(code,world)};
}
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();});
it.each(['WATCH_VIDEO','WATCH_VIDEO_ON_MOBILE','PLAY_ACTIVITY'])('Stop cancels %s loops before another request', async kind=>{
  const c=client(kind);await Promise.resolve();await c.stop();const requests=c.post.mock.calls.length;
  await vi.advanceTimersByTimeAsync(120000);expect(c.post).toHaveBeenCalledTimes(requests);expect(vi.getTimerCount()).toBe(0);
});
it('Stop waits for a pending application read and its late callback cannot install a fake game',async()=>{
  const c=client('PLAY_ON_DESKTOP',true);await Promise.resolve();let stopped=false;const stop=c.stop().then(()=>{stopped=true;});await Promise.resolve();expect(stopped).toBe(false);
  c.resolveGet();await stop;expect(c.value('games.getRunningGames===originalGames')).toBe(true);expect(c.value('callbacks.size')).toBe(0);
});
it.each(['PLAY_ON_DESKTOP','STREAM_ON_DESKTOP'])('Stop removes %s listeners and restores owned methods',async kind=>{
 const c=client(kind);await vi.advanceTimersByTimeAsync(0);expect(c.value('callbacks.size')).toBe(1);await c.stop();
 expect(c.value('callbacks.size')).toBe(0);expect(c.value('games.getRunningGames===originalGames')).toBe(true);expect(c.value('streaming.getStreamerActiveStreamMetadata===originalStream')).toBe(true);
});
it('matching progress reaching the target does not complete or launch a second job without a completion timestamp',async()=>{
 const c=client('WATCH_VIDEO');await vi.advanceTimersByTimeAsync(140000);expect(c.value('window.__daq.phase')).toBe('working');expect(c.value('quest.userStatus.completedAt')).toBeUndefined();await c.stop();
});
it('a second dispatch is rejected while a job still owns the controller',async()=>{
 const c=client('WATCH_VIDEO');expect(()=>vm.runInContext(`(function(){${operation()}})()`,c.world)).toThrow();await c.stop();
});

it('a saved heartbeat callback cannot mutate a stopped or replacement job',async()=>{
 const c=client('STREAM_ON_DESKTOP');await vi.advanceTimersByTimeAsync(0);c.value('const lateCallback=[...callbacks][0]');
 await c.stop();vm.runInContext(`(function(){${operation()}})()`,c.world);
 c.value(`lateCallback({userStatus:{questId:'123',completedAt:'2026-10-24',progress:{STREAM_ON_DESKTOP:{value:100}}}})`);
 expect(c.value('quest.userStatus.completedAt')).toBeUndefined();expect(c.value('callbacks.size')).toBe(1);await c.stop();
});

it('Stop waits for an outstanding progress request and ignores its late completion response',async()=>{
 const c=client('WATCH_VIDEO',false,true);await vi.advanceTimersByTimeAsync(7000);expect(c.post).toHaveBeenCalledTimes(1);
 let confirmed=false;const stopped=c.stop().then(()=>{confirmed=true;});await Promise.resolve();expect(confirmed).toBe(false);
 c.resolvePost();await stopped;expect(c.value('quest.userStatus.completedAt')).toBeUndefined();
 await vi.advanceTimersByTimeAsync(120000);expect(c.post).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
});

it('a setup failure retains failed cleanup actions and Stop cannot falsely confirm cancellation',async()=>{
 const c=client('STREAM_ON_DESKTOP',false,false,true);await vi.advanceTimersByTimeAsync(0);
 expect(c.value('window.__daq.phase')).toBe('paused');expect(c.value('callbacks.size')).toBe(1);
 await expect(c.stop()).rejects.toThrow('cleanup failure');expect(c.value('window.__daq.phase')).toBe('paused');
 c.value('window.failCleanup=false');await c.stop();expect(c.value('callbacks.size')).toBe(0);expect(c.value('window.__daq.phase')).toBe('stopped');
});
it('Stop treats a falsy thrown cleanup value as a failure',async()=>{
 const c=client('STREAM_ON_DESKTOP',false,false,true);await vi.advanceTimersByTimeAsync(0);
 c.value('Dispatcher.prototype.unsubscribe=()=>{throw undefined}');
 await expect(c.stop()).rejects.toBeDefined();expect(c.value('window.__daq.phase')).toBe('paused');
});
