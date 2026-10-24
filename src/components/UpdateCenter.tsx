import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useUpdates } from '../hooks/useUpdates';

const UpdateContext = createContext<(ReturnType<typeof useUpdates> & { working: boolean }) | null>(null);
export const useUpdateContext = () => useContext(UpdateContext);

export function UpdateProvider({ working, children }: { working: boolean; children: ReactNode }) {
  const updates = useUpdates();
  return <UpdateContext value={{ ...updates, working }}>{children}</UpdateContext>;
}

export function UpdateSettings() {
  const updates = useUpdateContext();
  if (!updates) return null;
  return <div className="update-settings">
    <button className="button secondary" disabled={updates.checking || updates.installing} onClick={() => void updates.check(true)}>{updates.checking ? 'Checking for updates…' : 'Check for updates'}</button>
    {updates.checkMessage && <p role="status">{updates.checkMessage}</p>}
    {updates.error && <p role="alert">{updates.error}</p>}
    {updates.preferences?.installed && <div className="notification-setting">
      <label><input type="checkbox" checked={updates.preferences.enabled} disabled={updates.savingPreferences} onChange={event => void updates.setNotifications(event.target.checked)} />Windows notifications</label>
      <p>Notify when a quest finishes.</p>
      {updates.preferenceError && <p role="alert">{updates.preferenceError}</p>}
    </div>}
  </div>;
}

export function UpdateCenter() {
  const updates = useUpdateContext();
  const [confirming, setConfirming] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null), cancel = useRef<HTMLButtonElement>(null), origin = useRef<HTMLButtonElement>(null);
  const pending = updates?.installing ?? false;
  useEffect(() => {
    const element = dialog.current;
    if (!confirming || !element) return;
    if (!element.open) { if (element.showModal) element.showModal(); else element.setAttribute('open', ''); }
    if (!pending) cancel.current?.focus();
  }, [confirming, pending]);
  if (!updates) return null;
  const { state, error } = updates;
  if (!state?.version) return null;
  const transferring = pending || state.status === 'downloading' || state.status === 'installing';
  const progress = state.progress !== null && Number.isFinite(state.progress) ? Math.max(0, Math.min(100, state.progress)) : undefined;
  function close() {
    if (pending) return;
    dialog.current?.close?.(); setConfirming(false); origin.current?.focus();
  }
  async function confirm() { if (await updates!.install()) { dialog.current?.close?.(); setConfirming(false); } }
  return <>
    <aside className="update-banner" aria-label="Application update">
      <div><p className="update-summary" role="status">{state.status === 'downloading' ? `Downloading ${state.version}${progress === undefined ? '…' : ` · ${Math.round(progress)}%`}` : transferring ? `Installing ${state.version}…` : `Discord Auto Quest ${state.version} is available`}</p>
        {state.notes && !transferring && <details className="update-notes"><summary>Release notes</summary><p>{state.notes}</p></details>}
        {!state.installed && <p className="update-detail">Portable version: download the new ZIP and replace the app after closing it.</p>}
        {state.status === 'downloading' && <progress aria-label="Update download" max={100} value={progress} />}
        {error && !confirming && <p className="update-error" role="alert">{error}</p>}
      </div>
      {state.installed ? <button ref={origin} className="button secondary" disabled={transferring} onClick={() => setConfirming(true)}>Review update</button>
        : <button className="button secondary" onClick={() => void updates.download()}>Download new ZIP</button>}
    </aside>
    {confirming && <dialog ref={dialog} className="update-dialog" aria-modal="true" aria-labelledby="update-title" aria-describedby="update-description" onCancel={event => { event.preventDefault(); close(); }} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); close(); } }}>
      <h2 id="update-title">Update to {state.version}?</h2>
      <p id="update-description">{updates.working ? 'Work will stop before the update installs. ' : ''}Discord Auto Quest will close and restart to finish updating.</p>
      {state.notes && <div className="update-release-notes"><h3>Release notes</h3><p>{state.notes}</p></div>}
      {pending && (state.status === 'downloading' ? <div className="update-download-progress">
        <p role="status">Downloading the update{progress === undefined ? '…' : ` · ${Math.round(progress)}%`}</p>
        <progress aria-label="Update download progress" max={100} value={progress} />
      </div> : <p role="status">Preparing the update…</p>)}
      {error && <p role="alert">{error}</p>}
      <div className="update-buttons"><button ref={cancel} className="button secondary" disabled={pending} onClick={close}>Cancel</button><button className="button primary" disabled={transferring} onClick={() => void confirm()}>{updates.working ? 'Stop Work and update' : 'Update now'}</button></div>
    </dialog>}
  </>;
}
