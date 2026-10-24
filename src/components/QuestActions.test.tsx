import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuestWorkspace } from './QuestWorkspace';
import { makeQuest, makeFeed } from '../test/fixtures/quests';
import { buildQuestViews } from '../lib/quest-view';
import { EnrollmentProvider } from './Enrollment';
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn().mockResolvedValue(undefined) }));
const q1=makeQuest({id:'111',state:'claimed',name:'First Quest'});
const q2=makeQuest({id:'222',state:'claimed',name:'Second Quest'});
function tree(quests=[q1,q2]) { return <QuestWorkspace views={buildQuestViews(makeFeed({claimed:quests}),Date.now())} loading={false} stale={false} controls={null} connection={null}/>; }
describe('quest menus',()=>{
 it('offers Desktop selection separately from enrollment and warns when continuous Work is on',async()=>{
  const select=vi.fn().mockResolvedValue({status:'selected',id:'111',platform:'desktop'}),run=vi.fn();
  const q=makeQuest({id:'111',state:'claimed',tasks:['PLAY_ON_DESKTOP','PLAY_ON_XBOX'],nativePlatform:null,desktopSelectionSupported:true,selectedTaskKind:'PLAY_ON_DESKTOP'});
  render(<EnrollmentProvider run={run} selectDesktop={select} refresh={()=>{}} disabled={false} continuousWork onActiveChange={()=>{}}>{tree([q])}</EnrollmentProvider>);
  expect(screen.getByText(/Choosing Desktop adds this quest to the queue/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button',{name:'Use Desktop'}));
  expect(select).toHaveBeenCalledExactlyOnceWith('111');expect(run).not.toHaveBeenCalled();
  expect(await screen.findByText(/Desktop selected\. Work starts only/)).toBeInTheDocument();
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow','0');
 });
 it('does not change the active job or override a console-selected quest',()=>{
  const select=vi.fn();const q=makeQuest({id:'111',state:'claimed',tasks:['PLAY_ON_DESKTOP','PLAY_ON_XBOX'],desktopSelectionSupported:true});
  const content=(quest= q)=><EnrollmentProvider run={vi.fn()} selectDesktop={select} activeQuestId="111" refresh={()=>{}} disabled={false} onActiveChange={()=>{}}>{tree([quest])}</EnrollmentProvider>;
  const view=render(content());expect(screen.getByRole('button',{name:'Use Desktop'})).toBeDisabled();
  view.rerender(content({...q,nativePlatform:'console'}));expect(screen.queryByRole('button',{name:'Use Desktop'})).not.toBeInTheDocument();
  expect(screen.getByText(/Console is selected/)).toBeInTheDocument();expect(select).not.toHaveBeenCalled();
 });
 it('shows an Orbs-only Available count and empty state without dropping accepted rewards',async()=>{
  const views=buildQuestViews(makeFeed({available:[makeQuest({id:'hidden',hasOrbReward:false,rewardName:'Any other game reward'})],claimed:[makeQuest({id:'kept',state:'claimed',hasOrbReward:false})]}),Date.now());
  render(<QuestWorkspace views={views} loading={false} stale={false} controls={null} connection={null}/>);
  expect(screen.getByRole('button',{name:'Ongoing1'})).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button',{name:'Available0'}));
  expect(screen.getByRole('heading',{name:'No available Orbs quests'})).toBeInTheDocument();expect(screen.queryByText('Any other game reward')).not.toBeInTheDocument();
 });
 it('keeps the video footer handoff without a second preview play control',()=>{
  render(tree([makeQuest({id:'111',name:'Video Quest',state:'claimed',heroVideo:'https://example.com/preview.mp4',tasks:['WATCH_VIDEO'],ctaLink:null,taskDetails:[{kind:'WATCH_VIDEO',value:0,target:60,unit:'seconds',platform:null}]})]));
  expect(screen.getByRole('button',{name:'Watch 60s in Discord'})).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:/Watch preview/})).not.toBeInTheDocument();
 });
 it('does not announce historical completions arriving after an initially empty read',()=>{
  const {rerender}=render(tree([]));
  rerender(tree([{...q1,state:'completed',completedAt:'2026-10-23T00:00:00Z'},q2]));
  expect(screen.queryByText(/First Quest completed\./)).not.toBeInTheDocument();
 });
 it('does not infer a managed completion from quest list changes',()=>{
  const {rerender}=render(tree());
  rerender(tree([{...q1,state:'completed',completedAt:'2026-10-23T00:00:00Z'},q2]));
  expect(screen.queryByText(/First Quest completed\./)).not.toBeInTheDocument();
 });
 it('shows a backend session completion and routes to Completed',async()=>{
  const dismiss=vi.fn();
  render(<QuestWorkspace views={buildQuestViews(makeFeed({claimed:[{...q1,state:'completed',completedAt:'2026-10-23T00:00:00Z'}]}),Date.now())} loading={false} stale={false} controls={null} connection={null} completion={{questId:q1.id,name:q1.name}} onDismissCompletion={dismiss}/>);
  expect(screen.getByText('First Quest completed. Claim your reward in Discord.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button',{name:'View completed'}));
  expect(screen.getByRole('heading',{name:'Completed quests'})).toBeInTheDocument();
  expect(dismiss).toHaveBeenCalledOnce();
 });
 it('opens one menu, supports arrows and Escape, and preserves same-ID refresh',async()=>{
  const user=userEvent.setup(); const {rerender}=render(tree());
  const first=screen.getByRole('button',{name:'Quest actions for First Quest'});
  await user.click(first);
  expect(screen.getAllByRole('menu')).toHaveLength(1);
  expect(screen.getByRole('menuitem',{name:'Get Game'})).toHaveFocus();
  await user.keyboard('{ArrowDown}'); expect(screen.getByRole('menuitem',{name:'Copy quest link'})).toHaveFocus();
  rerender(tree([{...q1},q2])); expect(screen.getByRole('menu')).toBeInTheDocument();
  await user.keyboard('{Escape}'); expect(screen.queryByRole('menu')).not.toBeInTheDocument(); expect(first).toHaveFocus();
  await user.click(first); await user.click(screen.getByRole('button',{name:'Quest actions for Second Quest'}));
  expect(screen.getAllByRole('menu')).toHaveLength(1);
 });
 it('closes a vanished quest menu and moves focus to the view heading',async()=>{
  const {rerender}=render(tree()); await userEvent.click(screen.getByRole('button',{name:'Quest actions for First Quest'}));
  rerender(tree([q2])); await waitFor(()=>expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  expect(screen.getByRole('heading',{name:'Ongoing quests'})).toHaveFocus();
 });
 it('copies with confirmation only after fulfillment and reports a failed copy',async()=>{
  const user=userEvent.setup(); const clipboard=vi.spyOn(navigator.clipboard,'writeText').mockRejectedValueOnce(Error('Clipboard denied'));
  render(tree()); await user.click(screen.getByRole('button',{name:'Quest actions for First Quest'}));
  await user.click(screen.getByRole('menuitem',{name:'Copy quest link'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Clipboard denied');
  expect(screen.queryByText('Quest link copied')).not.toBeInTheDocument();
  clipboard.mockResolvedValue(undefined);
  await user.click(screen.getByRole('button',{name:'Quest actions for First Quest'})); await user.click(screen.getByRole('menuitem',{name:'Copy quest link'}));
  expect(await screen.findByText('Quest link copied')).toBeInTheDocument();
 });
 it('closes on an outside pointer action',async()=>{
  render(tree());await userEvent.click(screen.getByRole('button',{name:'Quest actions for First Quest'}));
  expect(screen.getByRole('menu')).toBeInTheDocument();
  fireEvent.pointerDown(screen.getByRole('heading',{name:'Ongoing quests'}));
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Quest actions for First Quest'})).toHaveFocus();
 });

 it('preserves the clicked outside control focus',async()=>{
  render(tree()); await userEvent.click(screen.getByRole('button',{name:'Quest actions for First Quest'}));
  const search=screen.getByRole('searchbox'); await userEvent.click(search);
  expect(search).toHaveFocus(); expect(screen.queryByRole('menu')).not.toBeInTheDocument();
 });
});
