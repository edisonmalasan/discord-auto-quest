import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { EnrollmentProvider, useEnrollment } from './Enrollment';
const offer={status:'review' as const,id:'123',name:'Example',reward:'200 Orbs',expiresAt:'2099-01-01',requirements:[{kind:'PLAY_ON_DESKTOP',target:900}],revision:'revision'};
function Button(){const enrollment=useEnrollment(); return <button onClick={()=>enrollment?.review('123')}>Review offer</button>}
function show(run=vi.fn().mockResolvedValue(offer)) {
 const refresh=vi.fn();
 const active=()=>{};
 const content=(button:boolean)=><EnrollmentProvider run={run} refresh={refresh} disabled={false} onActiveChange={active}><h1 id="view-title" tabIndex={-1}>Available quests</h1>{button&&<Button/>}</EnrollmentProvider>;
 const view=render(content(true));
 return {run,refresh,removeTrigger:()=>view.rerender(content(false))};
}
it('requires confirmation and cancellation makes no acceptance call',async()=>{
 const {run}=show(); fireEvent.click(screen.getByText('Review offer'));
 const cancel=await screen.findByRole('button',{name:'Cancel'}); await waitFor(()=>expect(cancel).toHaveFocus());
 expect(screen.getByRole('dialog')).toHaveTextContent('Example'); expect(run).toHaveBeenCalledTimes(1);
 fireEvent.click(cancel); expect(screen.queryByRole('dialog')).toBeNull(); expect(run).toHaveBeenCalledTimes(1);
});
it('confirms once and refreshes without starting Work',async()=>{
 const run=vi.fn().mockResolvedValueOnce(offer).mockResolvedValueOnce({status:'accepted',id:'123'});
 const {refresh}=show(run); fireEvent.click(screen.getByText('Review offer'));
 const accept=await screen.findByRole('button',{name:'Confirm acceptance'});
 fireEvent.click(accept); fireEvent.click(accept);
 await waitFor(()=>expect(refresh).toHaveBeenCalled()); expect(run.mock.calls).toEqual([['123'],['123','revision']]);
 expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.getByText(/confirmed acceptance/)).toBeInTheDocument();
 expect(screen.getByRole('heading',{name:'Available quests'})).toHaveFocus();
});
it('keeps uncertainty visible and prevents automatic retries',async()=>{
 const run=vi.fn().mockResolvedValueOnce(offer).mockResolvedValueOnce({status:'uncertain',message:'Check Discord before trying again.'});
 show(run); fireEvent.click(screen.getByText('Review offer')); fireEvent.click(await screen.findByRole('button',{name:'Confirm acceptance'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Check Discord');
 expect(run).toHaveBeenCalledTimes(2); expect(screen.queryByRole('button',{name:'Confirm acceptance'})).toBeNull();
 expect(screen.getByRole('button',{name:'Open in Discord'})).toBeInTheDocument();
});
it('Escape cancels a review without accepting',async()=>{
 const {run}=show(); fireEvent.click(screen.getByText('Review offer')); await screen.findByRole('dialog');
 fireEvent.keyDown(screen.getByRole('dialog'),{key:'Escape'}); expect(screen.queryByRole('dialog')).toBeNull(); expect(run).toHaveBeenCalledTimes(1);
});
it.each(['Cancel','Escape'])('restores useful focus when the source card disappears: %s',async(action)=>{
 const {removeTrigger}=show(); const trigger=screen.getByText('Review offer'); trigger.focus(); fireEvent.click(trigger); await screen.findByRole('button',{name:'Cancel'});
 removeTrigger();
 if(action==='Cancel')fireEvent.click(screen.getByRole('button',{name:'Cancel'}));else fireEvent.keyDown(screen.getByRole('dialog'),{key:'Escape'});
 expect(screen.getByRole('heading',{name:'Available quests'})).toHaveFocus();
});
it('describes desktop and mobile video tasks as alternatives',async()=>{
 show(vi.fn().mockResolvedValue({...offer,requirements:[{kind:'WATCH_VIDEO',target:30},{kind:'WATCH_VIDEO_ON_MOBILE',target:30}]}));
 fireEvent.click(screen.getByText('Review offer')); await screen.findByRole('button',{name:'Confirm acceptance'});
 expect(screen.getByText('Choose one task:')).toBeInTheDocument();
});
it('shows Desktop intent and keeps accepted-but-unconfirmed selection recoverable without reenrolling',async()=>{
 const run=vi.fn().mockResolvedValueOnce({...offer,platform:'desktop',requiresDesktopSelection:true}).mockResolvedValueOnce({status:'accepted',id:'123',desktopSelection:'unconfirmed',message:'Quest accepted, but Desktop selection is unconfirmed. Find it in Ongoing.'});
 show(run);fireEvent.click(screen.getByText('Review offer'));await screen.findByRole('button',{name:'Confirm acceptance'});
 expect(screen.getByText('Desktop')).toBeInTheDocument();
 fireEvent.click(screen.getByText('Confirm acceptance'));
 expect(await screen.findByText(/Quest accepted, but Desktop selection is unconfirmed/)).toBeInTheDocument();
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(run).toHaveBeenCalledTimes(2);
});

it('dismisses acceptance feedback after five seconds without moving focus',async()=>{
 const run=vi.fn().mockResolvedValueOnce(offer).mockResolvedValueOnce({status:'accepted',id:'123'});
 show(run);fireEvent.click(screen.getByText('Review offer'));
 const confirm=await screen.findByRole('button',{name:'Confirm acceptance'});
 vi.useFakeTimers();
 try {
  await act(async()=>{fireEvent.click(confirm);});
  expect(screen.getByText(/confirmed acceptance/)).toBeInTheDocument();
  const trigger=screen.getByText('Review offer');trigger.focus();
  act(()=>{vi.advanceTimersByTime(4999);});expect(screen.getByText(/confirmed acceptance/)).toBeInTheDocument();
  act(()=>{vi.advanceTimersByTime(1);});expect(screen.queryByText(/confirmed acceptance/)).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();expect(run).toHaveBeenCalledTimes(2);
 } finally {vi.useRealTimers();}
});

it('gives a later acceptance its own full feedback lifetime',async()=>{
 const run=vi.fn().mockResolvedValueOnce(offer).mockResolvedValueOnce({status:'accepted',id:'123'})
  .mockResolvedValueOnce(offer).mockResolvedValueOnce({status:'accepted',id:'123'});
 show(run);fireEvent.click(screen.getByText('Review offer'));
 const confirm=await screen.findByRole('button',{name:'Confirm acceptance'});
 vi.useFakeTimers();
 try {
  await act(async()=>{fireEvent.click(confirm);});act(()=>{vi.advanceTimersByTime(4000);});
  await act(async()=>{fireEvent.click(screen.getByText('Review offer'));});
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Confirm acceptance'}));});
  act(()=>{vi.advanceTimersByTime(1000);});expect(screen.getByText(/confirmed acceptance/)).toBeInTheDocument();
  act(()=>{vi.advanceTimersByTime(4000);});expect(screen.queryByText(/confirmed acceptance/)).not.toBeInTheDocument();
 } finally {vi.useRealTimers();}
});

it('keeps uncertain acceptance errors available after success feedback would expire',async()=>{
 const run=vi.fn().mockResolvedValueOnce(offer).mockResolvedValueOnce({status:'uncertain',message:'Check Discord before retrying.'});
 show(run);fireEvent.click(screen.getByText('Review offer'));
 const confirm=await screen.findByRole('button',{name:'Confirm acceptance'});
 vi.useFakeTimers();
 try {
  await act(async()=>{fireEvent.click(confirm);});act(()=>{vi.advanceTimersByTime(10000);});
  expect(screen.getByRole('alert')).toHaveTextContent('Check Discord before retrying.');
  expect(screen.getByRole('button',{name:'Open in Discord'})).toBeInTheDocument();expect(run).toHaveBeenCalledTimes(2);
 } finally {vi.useRealTimers();}
});
