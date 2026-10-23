export interface OfferReview {
  status: 'review';
  id: string;
  name: string;
  reward: string;
  expiresAt: string;
  requirements: { kind: string; target: number }[];
  revision: string;
}
export type EnrollmentResult = OfferReview
  | { status: 'accepted'; id: string }
  | { status: 'unsupported' | 'blocked' | 'expired' | 'changed' | 'pending' | 'uncertain'; message: string };
export type EnrollmentRun = (id: string, revision?: string) => Promise<EnrollmentResult>;
