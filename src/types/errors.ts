/**
 * The error shape every backend command returns on failure.
 *
 * The backend is structured about its failures, so the interface never has to
 * parse a message to decide whether to offer a retry.
 */
export interface AppErrorShape {
  /** A machine-readable code. */
  code: string;
  /** What happened, in words. */
  message: string;
  /** Whether repeating the operation could plausibly succeed. */
  retryable: boolean;
}
