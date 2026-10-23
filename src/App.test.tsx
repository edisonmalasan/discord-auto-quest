import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeQuest, makeFeed } from './test/fixtures/quests';
import type { DiscordStatus, QuestFeed } from './types/quests';
const status = vi.fn<() => Promise<DiscordStatus>>();
const list = vi.fn<() => Promise<QuestFeed>>();
const work = vi.fn(); const stop = vi.fn(); const restart = vi.fn();
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }));
vi.mock('./lib/ipc', () => ({
 discordStatus: () => status(), listDiscordQuests: () => list(),
 startQuestWork: () => work(), stopQuestWork: () => stop(), relaunchDiscord: () => restart(),
 appVersion: () => Promise.resolve('0.1.0'),
 toAppError: (v: unknown) => typeof v === 'object' && v && 'message' in v ? v : { code: 'UNKNOWN', message: String(v), retryable: true },
}));
const { default: App } = await import('./App');
const feed = makeFeed({
 claimed: [makeQuest({ id: '1', name: 'Active Quest', state: 'claimed' }),
   makeQuest({ id: '3', name: 'Finished Quest', state: 'completed', rewardClaimState: 'claimed' })],
 available: [makeQuest({ id: '2', name: 'Offered Quest' })],
});
describe('the quest workspace', () => {
 afterEach(()=>vi.useRealTimers());
 beforeEach(() => {
  vi.clearAllMocks(); status.mockResolvedValue({ installed: true, ready: true, action: null, profile: null });
  list.mockResolvedValue(feed); work.mockResolvedValue(true); stop.mockResolvedValue(undefined); restart.mockResolvedValue(undefined);
 });
 it('starts in Ongoing and navigates to distinct live views', async () => {
  render(<App />); await screen.findByText('Active Quest');
  const nav = screen.getByRole('navigation', { name: 'Your quests' });
  expect(within(nav).getByRole('button', { name: /Ongoing.*1/ })).toHaveAttribute('aria-current', 'page');
  expect(screen.queryByText('Offered Quest')).not.toBeInTheDocument();
  await userEvent.click(within(nav).getByRole('button', { name: /Available/ }));
  expect(await screen.findByText('Offered Quest')).toBeInTheDocument();
  await userEvent.click(within(nav).getByRole('button', { name: /Completed/ }));
  expect(await screen.findByText('Finished Quest')).toBeInTheDocument();
 });
 it('retains a separate search per view and keeps counts independent of results', async () => {
  render(<App />); await screen.findByText('Active Quest');
  await userEvent.type(screen.getByRole('searchbox'), 'missing');
  expect(screen.getByText('No matching quests')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Ongoing.*1/ })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /Available.*1/ }));
  expect(screen.getByRole('searchbox')).toHaveValue('');
  await userEvent.click(screen.getByRole('button', { name: /Ongoing.*1/ }));
  expect(screen.getByRole('searchbox')).toHaveValue('missing');
  await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
  expect(screen.getByText('Active Quest')).toBeInTheDocument();
 });
 it('shows loading instead of zero counts before the first feed', async () => {
  list.mockReturnValue(new Promise(() => {})); render(<App />);
  expect(screen.getByRole('status', { name: 'Loading quests' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Ongoing.*0/ })).not.toBeInTheDocument();
 });
 it('shows the brand and backend version with independent-project notices in About', async () => {
  render(<App />); await screen.findByText('Active Quest');
  expect(screen.getAllByText('Discord Auto Quest').length).toBeGreaterThan(0);
  await userEvent.click(screen.getByRole('button', { name: 'About Discord Auto Quest' }));
  expect(await screen.findByText('0.1.0')).toBeInTheDocument();
  expect(screen.getByText(/not affiliated with, endorsed by/i)).toBeInTheDocument();
 });
 it('keeps one global work control and changes it to Stop after a successful run', async () => {
  render(<App />); await screen.findByText('Active Quest');
  expect(screen.getAllByRole('button', { name: 'Work my quests' })).toHaveLength(1);
  await userEvent.click(screen.getByRole('button', { name: 'Work my quests' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Stop' }));
  await waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
 });
 it('refreshes the percentage ring during Work and keeps completion tied to Discord', async () => {
  vi.useFakeTimers();
  const video = makeQuest({ id: 'video', name: 'Video Quest', state: 'claimed',
   taskDetails: [{ kind: 'WATCH_VIDEO', value: 0, target: 100, unit: 'seconds', platform: null }] });
  list.mockResolvedValue(makeFeed({ claimed: [video] }));
  render(<App />); await act(async()=>{});
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow','0');
  await act(async()=>{screen.getByRole('button',{name:'Work my quests'}).click();});
  for (const value of [5, 25, 99]) {
   list.mockResolvedValue(makeFeed({ claimed: [{ ...video, taskDetails: [{ ...video.taskDetails![0], value }] }] }));
   await act(async()=>{await vi.advanceTimersByTimeAsync(4000);});
   expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow',String(value));
   expect(screen.getByRole('button',{name:'Stop'})).toBeEnabled();
   expect(screen.getByRole('button',{name:/Completed.*0/})).toBeInTheDocument();
  }
  list.mockResolvedValue(makeFeed({ claimed: [{ ...video, state:'completed', completedAt:'2026-10-24' }] }));
  await act(async()=>{await vi.advanceTimersByTimeAsync(4000);});
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:/Completed.*1/})).toBeInTheDocument();
 });
 it('never restarts Discord unless the user clicks the deliberate action', async () => {
  status.mockResolvedValue({ installed: true, ready: false, action: 'Restarting Discord interrupts your activity.', profile: null });
  render(<App />); const button = await screen.findByRole('button', { name: 'Restart Discord' });
  expect(restart).not.toHaveBeenCalled(); await userEvent.click(button);
  await waitFor(() => expect(restart).toHaveBeenCalledTimes(1));
 });
 it('reports a operation failure without pretending it started', async () => {
  work.mockRejectedValue({ code: 'NOT_SUPPORTED', message: 'The quest operation did not attach.', retryable: false });
  render(<App />); await screen.findByText('Active Quest');
  await userEvent.click(screen.getByRole('button', { name: 'Work my quests' }));
  expect(await screen.findByText('The quest operation did not attach.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument();
 });
 it('keeps last data visible but disables live actions until a failed poll recovers',async()=>{
  vi.useFakeTimers();render(<App/>);await act(async()=>{});
  list.mockRejectedValueOnce({code:'IO_ERROR',message:'Temporary reader failure',retryable:true});
  await act(async()=>{await vi.advanceTimersByTimeAsync(4000)});
  expect(screen.getByText('Active Quest')).toBeInTheDocument();
  expect(screen.getByText(/last successful read/)).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Work my quests'})).toBeDisabled();
  await act(async()=>{await vi.advanceTimersByTimeAsync(4000)});
  expect(screen.queryByText('Temporary reader failure')).not.toBeInTheDocument();
  expect(screen.queryByText(/last successful read/)).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Work my quests'})).toBeEnabled();
 });
 it('explains why a non-desktop feed cannot be worked',async()=>{
  list.mockResolvedValue({...feed,desktopApp:false});render(<App/>);
  await screen.findByText('Active Quest');
  expect(screen.getByRole('button',{name:'Work my quests'})).toBeDisabled();
  expect(screen.getByText('Working quests requires the Discord desktop client.')).toBeInTheDocument();
 });
});
