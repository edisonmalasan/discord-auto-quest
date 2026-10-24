import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Colophon } from './Colophon';

const appVersion = vi.fn<() => Promise<string>>();

vi.mock('../lib/ipc', () => ({
  appVersion: () => appVersion(),
}));

describe('Colophon', () => {
  it('states the version the backend reports', async () => {
    appVersion.mockResolvedValue('1.2.3');

    render(<Colophon />);

    await waitFor(() => expect(screen.getByText('1.2.3')).toBeInTheDocument());
  });

  it('states the licence and that this is nobody else’s project', () => {
    appVersion.mockResolvedValue('1.2.3');

    render(<Colophon />);

    expect(screen.getByRole('heading', { name: 'About Discord Auto Quest' })).toBeInTheDocument();
    expect(screen.getByText('MIT')).toBeInTheDocument();
    expect(
      screen.getByText(/not affiliated with, endorsed by, or connected to Discord Inc\./i),
    ).toBeInTheDocument();
  });

  it('shows no version rather than a made-up one when the backend cannot say', () => {
    appVersion.mockRejectedValue(new Error('no backend'));

    render(<Colophon />);

    // The em dash, not a number: a version the application did not confirm is
    // not one the interface may print.
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
