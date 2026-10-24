export interface OfferReview {
  status: 'review';
  id: string;
  name: string;
  reward: string;
  expiresAt: string;
  requirements: { kind: string; target: number }[];
  revision: string;
  platform?: 'desktop';
  requiresDesktopSelection?: boolean;
}
export type EnrollmentResult = OfferReview
  | { status: 'accepted'; id: string; desktopSelection?: 'selected' | 'not-required' | 'unconfirmed'; message?: string }
  | { status: 'unsupported' | 'blocked' | 'expired' | 'changed' | 'pending' | 'uncertain'; message: string };
export type EnrollmentRun = (id: string, revision?: string) => Promise<EnrollmentResult>;
export type DesktopSelectionResult = {status: 'selected'; id: string; platform: 'desktop'}
  | {status: 'unsupported' | 'blocked' | 'uncertain'; message: string};
export type DesktopSelectionRun = (id: string) => Promise<DesktopSelectionResult>;
