import {expect, it} from 'vitest';
import {makeQuest, makeFeed} from '../test/fixtures/quests';
import {buildQuestViews} from './quest-view';
import {workOverview} from './work-overview';
import {stoppedWork} from '../types/work';

it('uses the backend order and active ID, never progress or expiry order', () => {
  const cards = buildQuestViews(makeFeed({claimed: ['first','second','manual','unknown','active'].map((id, index) => makeQuest({id, state:'claimed', progressSeconds:index === 0 ? 90 : 0}))}), Date.now()).ongoing;
  const groups = workOverview(cards, {...stoppedWork(),phase:'working',activeQuestId:'active',pendingQuestIds:['second','first','second','missing'],skippedQuests:[{questId:'manual',reason:'manual_play'}]});
  expect(groups.active.map(c=>c.quest.id)).toEqual(['active']);
  expect(groups.pending.map(c=>c.quest.id)).toEqual(['second','first']);
  expect(groups.manual.map(c=>c.quest.id)).toEqual(['manual']);
  expect(groups.attention.map(c=>c.quest.id)).toEqual(['unknown']);
});
