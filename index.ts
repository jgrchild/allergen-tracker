export type AllergenStatus =
  | "active exposure"
  | "avoid"
  | "paused"
  | "not introduced";

export type ReactionSeverity = "none" | "mild" | "moderate" | "severe";

export interface ChildProfile {
  id: string;
  name: string;
  birthMonth?: string;
  allergistName?: string;
  emergencyPlanLocation?: string;
}

export interface Allergen {
  id: string;
  name: string;
  status: AllergenStatus;
  targetFrequencyPerWeek: number;
  allergistNotes: string;
  safeForms: string;
  servingExamples: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExposureLog {
  id: string;
  allergenId: string;
  occurredAt: string;
  foodFormGiven: string;
  amount: string;
  givenBy: string;
  reaction: ReactionSeverity;
  symptomsNotes: string;
  photoAttachmentUrl?: string;
  notes: string;
}

export interface Caregiver {
  id: string;
  name: string;
  relationship: string;
  phone?: string;
  notes?: string;
}

export interface WeeklyExposureTarget {
  allergenId: string;
  weekStart: string;
  targetCount: number;
  completedCount: number;
  remainingCount: number;
}
