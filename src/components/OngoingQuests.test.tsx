import {render, screen, within} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {OngoingQuests} from './OngoingQuests';
import {buildQuestViews} from '../lib/quest-view';
import {makeFeed,makeQuest} from '../test/fixtures/quests';
import {stoppedWork} from '../types/work';
vi.mock('@tauri-apps/plugin-opener',()=>({openUrl:vi.fn()}));
it('renders regular Active and Pending cards with Up next and Queued and preserves Active during search',()=>{
  const cards=buildQuestViews(makeFeed({claimed:['active','next','later','manual'].map(id=>makeQuest({id,name:id,state:'claimed'}))}),Date.now()).ongoing;
  const work={...stoppedWork(),phase:'working' as const,activeQuestId:'active',pendingQuestIds:['next','later'],skippedQuests:[{questId:'manual',reason:'manual_play' as const}]};
  const props={cards,work,query:'',stale:false,openMenuQuestId:null,onMenuChange:vi.fn()};
  const view=render(<OngoingQuests {...props}/>);
  expect(within(screen.getByRole('region',{name:'Active now'})).getByRole('article')).toHaveAttribute('class','quest-card');
  const pending=screen.getByRole('region',{name:'Pending'});expect(within(pending).getByText('Up next')).toBeInTheDocument();expect(within(pending).getByText('Queued')).toBeInTheDocument();expect(screen.queryByText('Queue 2')).toBeNull();
  expect(screen.getByRole('region',{name:'Needs manual play'})).toHaveTextContent('Automatically skipped');
  view.rerender(<OngoingQuests {...props} query="manual"/>);expect(screen.getByRole('region',{name:'Active now'})).toBeInTheDocument();expect(screen.queryByRole('region',{name:'Pending'})).toBeNull();
});
