import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdateCenter, UpdateProvider } from './UpdateCenter';
import { AboutPopover } from './AboutPopover';
import type { UpdateState } from '../types/updates';

const { invoke, openUrl, listen } = vi.hoisted(() => ({ invoke: vi.fn(), openUrl: vi.fn(), listen: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke }));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl }));
vi.mock('@tauri-apps/api/event', () => ({ listen }));

const available: UpdateState = { status: 'available', installed: true, currentVersion: '1.1.0', version: '1.2.0', notes: 'Fixes and improvements.', progress: null, message: null };
let preferences = { enabled: false, installed: true };
let updateEvent: (event: { payload: UpdateState }) => void;

function tree(working = false) {
  return <UpdateProvider working={working}><AboutPopover /><UpdateCenter /></UpdateProvider>;
}
async function about() { await userEvent.click(screen.getByRole('button', { name: 'About Discord Auto Quest' })); }

beforeEach(() => {
  preferences = { enabled: false, installed: true };
  invoke.mockReset().mockImplementation(async (command, args) => {
    if (command === 'check_for_updates' || command === 'update_status') return available;
    if (command === 'notification_preferences') return preferences;
    if (command === 'set_notification_preferences') return { ...preferences, enabled: args.enabled };
    if (command === 'app_version') return '1.1.0';
    if (command === 'install_update') return undefined;
    throw Error(`Unexpected command: ${command}`);
  });
  listen.mockReset().mockImplementation(async (_name, handler) => { updateEvent = handler; return () => {}; });
  openUrl.mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe('update controls', () => {
  it('checks on mount and opens a cancel-focused confirmation before installing', async () => {
    render(tree());
    await userEvent.click(await screen.findByRole('button', { name: 'Review update' }));
    const dialog = screen.getByRole('dialog', { name: 'Update to 1.2.0?' });
    expect(within(dialog).getByText('Fixes and improvements.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(invoke).not.toHaveBeenCalledWith('install_update');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Update now' }));
    expect(invoke).toHaveBeenCalledWith('install_update');
  });

  it('names the Work interruption in confirmation and preserves cancellation', async () => {
    render(tree(true));
    await userEvent.click(await screen.findByRole('button', { name: 'Review update' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Stop Work and update' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review update' })).toHaveFocus();
    expect(invoke).not.toHaveBeenCalledWith('install_update');
  });

  it('shows a safe portable release download without an installer or notification opt-in', async () => {
    preferences.installed = false;
    invoke.mockImplementation(async command => command === 'app_version' ? '1.1.0' : command === 'notification_preferences' ? preferences : { ...available, installed: false });
    render(tree());
    await userEvent.click(await screen.findByRole('button', { name: 'Download new ZIP' }));
    expect(openUrl).toHaveBeenCalledWith('https://github.com/edisonmalasan/discord-auto-quest/releases/tag/v1.2.0');
    expect(screen.queryByRole('button', { name: 'Review update' })).not.toBeInTheDocument();
    await about();
    expect(screen.queryByRole('checkbox', { name: /Windows notifications/ })).not.toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalledWith('install_update');
  });

  it('keeps automatic check failures quiet and reports a manual check failure', async () => {
    invoke.mockImplementation(async command => {
      if (command === 'check_for_updates') throw Error('Update server unavailable. Try again later.');
      return command === 'app_version' ? '1.1.0' : preferences;
    });
    render(tree());
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('check_for_updates'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await about();
    await userEvent.click(screen.getByRole('button', { name: 'Check for updates' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Update server unavailable');
  });

  it('checks again after twelve hours', async () => {
    vi.useFakeTimers();
    render(tree());
    await act(async () => { await Promise.resolve(); });
    expect(invoke.mock.calls.filter(call => call[0] === 'check_for_updates')).toHaveLength(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(12 * 60 * 60 * 1000); });
    expect(invoke.mock.calls.filter(call => call[0] === 'check_for_updates')).toHaveLength(2);
  });

  it('shows download progress from the backend without interpreting notes as HTML', async () => {
    render(tree());
    await screen.findByRole('button', { name: 'Review update' });
    act(() => updateEvent({ payload: { ...available, status: 'downloading', progress: 42, notes: '<img src=x onerror=alert(1)>' } }));
    expect(screen.getByRole('progressbar', { name: 'Update download' })).toHaveAttribute('value', '42');
    expect(screen.getByText(/Downloading 1.2.0/)).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('requests notification opt-in only after the user enables it', async () => {
    render(tree());
    await about();
    const checkbox = await screen.findByRole('checkbox', { name: 'Windows notifications' });
    expect(checkbox).not.toBeChecked();
    expect(invoke.mock.calls.some(call => call[0] === 'set_notification_preferences')).toBe(false);
    await userEvent.click(checkbox);
    await waitFor(() => expect(checkbox).toBeChecked());
    expect(invoke).toHaveBeenCalledWith('set_notification_preferences', { enabled: true });
  });

  it('keeps notifications off and explains a denied opt-in', async () => {
    invoke.mockImplementation(async command => {
      if (command === 'set_notification_preferences') throw Error('Notifications are blocked in Windows settings.');
      return command === 'app_version' ? '1.1.0' : command === 'notification_preferences' ? preferences : available;
    });
    render(tree()); await about();
    const checkbox = await screen.findByRole('checkbox', { name: 'Windows notifications' });
    fireEvent.click(checkbox);
    expect(await screen.findByRole('alert')).toHaveTextContent('Notifications are blocked');
    expect(checkbox).not.toBeChecked();
  });

  it('reports installer failure while allowing cancellation and retry', async () => {
    invoke.mockImplementation(async command => {
      if (command === 'install_update') throw Error('Could not stop Work. Try Stop first.');
      return command === 'app_version' ? '1.1.0' : command === 'notification_preferences' ? preferences : available;
    });
    render(tree(true));
    await userEvent.click(await screen.findByRole('button', { name: 'Review update' }));
    await userEvent.click(screen.getByRole('button', { name: 'Stop Work and update' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not stop Work');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  });

  it('does not launch a portable link from an invalid release version', async () => {
    invoke.mockImplementation(async command => command === 'app_version' ? '1.1.0' : command === 'notification_preferences' ? preferences : { ...available, installed: false, version: '../malicious?url=https://example.com' });
    render(tree());
    await userEvent.click(await screen.findByRole('button', { name: 'Download new ZIP' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('release version is unavailable');
    expect(openUrl).not.toHaveBeenCalled();
  });

  it('holds the confirmation during download and enables retry after a failed transfer', async () => {
    let rejectInstall: (reason: Error) => void = () => {};
    invoke.mockImplementation(async command => {
      if (command === 'install_update') return new Promise<void>((_resolve, reject) => { rejectInstall = reject; });
      return command === 'app_version' ? '1.1.0' : command === 'notification_preferences' ? preferences : available;
    });
    render(tree());
    await userEvent.click(await screen.findByRole('button', { name: 'Review update' }));
    await userEvent.click(screen.getByRole('button', { name: 'Update now' }));
    act(() => updateEvent({ payload: { ...available, status: 'downloading', progress: 145 } }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('progressbar', { name: 'Update download progress' })).toHaveAttribute('value', '100');
    expect(within(dialog).getByText(/Downloading the update.*100%/)).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    act(() => rejectInstall(Error('Download interrupted. Try again.')));
    expect(await screen.findByRole('alert')).toHaveTextContent('Download interrupted');
    expect(screen.getByRole('button', { name: 'Update now' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  });
});
