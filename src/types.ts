export type TrailNumber = 1 | 2 | 3 | 4 | 5;

export interface Point {
  id: number;
  label: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
}

export interface PatientInfo {
  name: string;
  gender: 'male' | 'female' | '';
  dob: string;
  testDate: string;
  referral: string;
  examiner: string;
}

export interface TrailResult {
  trailNumber: TrailNumber;
  rawScore: number; // seconds
  errors: number;
  tScore: number;
  percentile: number;
  rating: string;
  diffFromMean?: number;
  isSignificant05?: boolean;
  isSignificant01?: boolean;
}

export type AppState = 'welcome' | 'patient-info' | 'instructions' | 'testing' | 'results';
