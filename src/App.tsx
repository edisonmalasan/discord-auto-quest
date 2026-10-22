import { QuestWorkspace } from './components/QuestWorkspace';
import { useDiscord } from './hooks/useDiscord';
import { buildQuestViews } from './lib/quest-view';
export default function App() {
  const discord = useDiscord();
  const views = discord.feed ? buildQuestViews(discord.feed, Date.now()) : { ongoing: [], available: [], completed: [] };
  const stale = discord.feed !== null && (discord.phase !== 'ready' || discord.error !== null);
  return <QuestWorkspace views={views} loading={!discord.feed} stale={stale}
    controls={<div className="global-controls">{discord.error && <p role="alert">{discord.error.message}</p>}
      <button className={`button ${discord.working ? 'secondary' : 'primary'}`} disabled={discord.busy || (!discord.working && (discord.phase !== 'ready' || stale || !discord.feed?.desktopApp))}
        onClick={discord.working ? discord.stop : discord.work}>{discord.busy ? 'Please wait…' : discord.working ? 'Stop' : 'Work my quests'}</button></div>}
    connection={<div className="connection"><p><span className={`status-dot ${discord.phase === 'ready' && !stale ? 'connected' : ''}`}/>{discord.phase === 'ready' && !stale ? 'Discord connected' : discord.phase === 'loading' ? 'Connecting to Discord…' : 'Discord needs attention'}</p>
      {discord.status?.action && <><p className="connection-detail">{discord.status.action}</p><button className="button secondary" disabled={discord.busy} onClick={discord.restart}>Restart Discord</button></>}
    </div>} />;
}
