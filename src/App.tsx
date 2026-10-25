import { QuestWorkspace } from './components/QuestWorkspace';
import { useDiscord } from './hooks/useDiscord';
import { buildQuestViews } from './lib/quest-view';
import { ConnectionStatus } from './components/ConnectionStatus';
import { useState } from 'react';
import { EnrollmentProvider } from './components/Enrollment';
import { UpdateCenter, UpdateProvider, useUpdateContext } from './components/UpdateCenter';
import { useCompletions } from './hooks/useCompletions';
import { NotificationProvider } from './components/Notifications';
export default function App() {
  const discord = useDiscord();
  return <NotificationProvider><UpdateProvider working={discord.working}><Workspace discord={discord}/></UpdateProvider></NotificationProvider>;
}
function Workspace({discord}: {discord: ReturnType<typeof useDiscord>}) {
  const [reviewing, setReviewing] = useState(false);
  const updates = useUpdateContext();
  const {completion, closeError, dismissCompletion} = useCompletions();
  const views = discord.feed ? buildQuestViews(discord.feed, Date.now()) : { ongoing: [], available: [], completed: [] };
  const acceptanceBlocked = ['starting', 'stopping', 'paused'].includes(discord.workState.phase);
  return <EnrollmentProvider run={discord.enrollment} refresh={discord.refresh} continuousWork={discord.working} selectDesktop={discord.selectDesktop} activeQuestId={discord.workState.activeQuestId} disabled={discord.busy || updates?.installing || discord.stale || discord.connectionState !== 'connected' || acceptanceBlocked} onActiveChange={setReviewing}><QuestWorkspace views={views} workState={discord.workState} loading={!discord.feed} stale={discord.stale} notices={<><UpdateCenter/>{(discord.operationError || closeError && discord.working || discord.workState.phase === 'paused') && <p className="work-recovery" role="alert">{discord.operationError?.message ?? closeError ?? discord.workState.message ?? 'Work paused. Reconnect and confirm Stop before continuing.'}</p>}</>} completion={completion} onDismissCompletion={dismissCompletion}
    controls={<div className="global-controls">
      {discord.feed?.desktopApp === false && <p className="desktop-notice">Working quests requires the Discord desktop client.</p>}
      <button className={`button ${discord.working ? 'secondary' : 'primary'}`} disabled={reviewing || updates?.installing || discord.busy || (!discord.working && (discord.connectionState !== 'connected' || !discord.feed?.desktopApp))}
        onClick={discord.working ? discord.stop : discord.work}>{discord.pendingAction === 'restart' ? 'Restarting Discord…' : discord.pendingAction === 'work' ? 'Starting…' : discord.pendingAction === 'stop' ? 'Stopping…' : discord.working ? 'Stop' : 'Work my quests'}</button></div>}
    connection={<ConnectionStatus state={discord.connectionState} status={discord.status} error={discord.error} busy={reviewing || discord.busy} onRestart={discord.restart} onRetry={discord.refresh}/>} /></EnrollmentProvider>;
}
