import { QuestWorkspace } from './components/QuestWorkspace';
import { useDiscord } from './hooks/useDiscord';
import { buildQuestViews } from './lib/quest-view';
import { ConnectionStatus } from './components/ConnectionStatus';
export default function App() {
  const discord = useDiscord();
  const views = discord.feed ? buildQuestViews(discord.feed, Date.now()) : { ongoing: [], available: [], completed: [] };
  const eligible = views.ongoing.some(card => !card.expired);
  return <QuestWorkspace views={views} loading={!discord.feed} stale={discord.stale}
    controls={<div className="global-controls">{discord.operationError && <p role="alert">{discord.operationError.message}</p>}
      {discord.feed?.desktopApp === false && <p className="desktop-notice">Working quests requires the Discord desktop client.</p>}
      <button className={`button ${discord.working ? 'secondary' : 'primary'}`} disabled={discord.busy || (!discord.working && (discord.connectionState !== 'connected' || !eligible || !discord.feed?.desktopApp))}
        onClick={discord.working ? discord.stop : discord.work}>{discord.pendingAction === 'restart' ? 'Restarting Discord…' : discord.pendingAction === 'work' ? 'Starting…' : discord.pendingAction === 'stop' ? 'Stopping…' : discord.working ? 'Stop' : 'Work my quests'}</button></div>}
    connection={<ConnectionStatus state={discord.connectionState} status={discord.status} error={discord.error} busy={discord.busy} onRestart={discord.restart} onRetry={discord.refresh}/>} />;
}
