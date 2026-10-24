import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeFeed, makeQuest } from '../test/fixtures/quests';
import { buildQuestViews } from '../lib/quest-view';
import { QuestCard } from './QuestCard';
import type { QuestSummary } from '../types/quests';
function show(overrides: Partial<QuestSummary>) {
 const q=makeQuest(overrides); const views=buildQuestViews(makeFeed({claimed:q.state==='available'?[]:[q],available:q.state==='available'?[q]:[]}),Date.parse('2026-10-23'));
 const card=[...views.ongoing,...views.available,...views.completed][0];
 return render(<QuestCard card={card} stale={false} menuOpen={false} onMenuChange={()=>{}}/>);
}
describe('native quest card variants',()=>{
 it('keeps the external game action on an available multi-platform quest',()=>{
  show({state:'available',ctaLabel:'Get Game',taskDetails:[
   {kind:'PLAY_ON_DESKTOP',value:0,target:900,unit:'seconds',platform:'Desktop'},
   {kind:'PLAY_ON_XBOX',value:0,target:900,unit:'seconds',platform:'Xbox'},
  ]});
  expect(screen.getByRole('button',{name:'Get Game'})).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Accept in Discord'})).toBeInTheDocument();
 });
 it('resolves root-relative Discord artwork against the CDN rather than the app',()=>{
  show({rewardImage:'/quests/reward.png'});
  expect(screen.getByAltText('700 Orbs')).toHaveAttribute('src','https://cdn.discordapp.com/quests/reward.png');
 });
 it('preserves the streaming voice-channel requirement',()=>{
  show({state:'claimed',tasks:['STREAM_ON_DESKTOP'],taskDetails:[{kind:'STREAM_ON_DESKTOP',value:0,target:900,unit:'seconds',platform:'Desktop'}]});
  expect(screen.getByText(/voice channel with somebody/)).toBeInTheDocument();
 });
 it('shows zero progress and reward art without using the game tile',()=>{
  show({state:'claimed',rewardImage:'quests/reward.png',tile:'quests/game.png'});
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow','0');
  expect(screen.getByAltText('700 Orbs')).toHaveAttribute('src','https://cdn.discordapp.com/quests/reward.png');
  expect(document.querySelector('img[src*=game]')).toBeNull();
 });
 it('names unavailable progress instead of leaving an unexplained empty ring',()=>{
  show({state:'claimed',taskDetails:[]});
  expect(screen.getByText('Progress unavailable.')).toBeInTheDocument();
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
 });
 it('shows confirmed claimed reward quantity and date',()=>{
  show({state:'completed',rewardClaimState:'claimed',rewardClaimedAt:'2026-10-22T12:00:00Z',claimedRewardOrbs:840});
  expect(screen.getByText('840 Orbs')).toBeInTheDocument();
  expect(screen.getByAltText('840 Orbs')).toBeInTheDocument();
  expect(screen.getByText(/claimed this reward on 10\/22\/26/)).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'View reward in Discord'})).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Claim in Discord'})).not.toBeInTheDocument();
 });
 it.each([['unknown',null,'Check in Discord'],['unclaimed',true,'Claim in Discord']] as const)('uses %s claim evidence honestly',(rewardClaimState,rewardClaimable,label)=>{
  show({state:'completed',rewardClaimState,rewardClaimable});
  expect(screen.getByRole('button',{name:label})).toBeInTheDocument();
 });
 it('preserves non-Orbs reward text, count units, and unknown verification',()=>{
  show({state:'claimed',rewardType:'3',rewardOrbs:null,rewardName:'Acolyte Decoration',taskDetails:[{kind:'ACHIEVEMENT_IN_ACTIVITY',value:1,target:3,unit:'count',platform:null}]});
  expect(screen.getByText('Acolyte Decoration')).toBeInTheDocument();
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext','1 of 3 achievements');
  expect(screen.queryByLabelText('Verified publisher')).not.toBeInTheDocument();
 });
 it('keeps content readable when artwork fails and titles are long',()=>{
  const title='A very long quest name that must remain available to everyone';
  show({name:title,banner:'quests/banner.jpg',logotype:'quests/logo.png'});
  fireEvent.error(document.querySelector('.quest-hero img')!);
  expect(screen.getByRole('heading',{name:/A very long quest name/})).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Accept in Discord'})).toBeInTheDocument();
 });
 it('keeps the offer CTA for a video with desktop and mobile alternatives',()=>{
  show({state:'claimed',tasks:['WATCH_VIDEO','WATCH_VIDEO_ON_MOBILE'],ctaLabel:'Get Offer',taskDetails:[
   {kind:'WATCH_VIDEO',value:0,target:9,unit:'seconds',platform:'Desktop'},
   {kind:'WATCH_VIDEO_ON_MOBILE',value:0,target:9,unit:'seconds',platform:'Mobile'},
  ]});
  expect(screen.getByRole('button',{name:'Get Offer'})).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Watch 9s in Discord'})).toBeInTheDocument();
 });
});
