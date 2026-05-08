"use client";

import { Allergen, Caregiver, ChildProfile, ExposureLog } from "@/types";
import { seedAllergens, seedCaregivers, seedChild, seedLogs } from "./seed";

export interface TrackerState {
  child: ChildProfile;
  allergens: Allergen[];
  logs: ExposureLog[];
  caregivers: Caregiver[];
}

const storageKey = "family-allergen-tracker-v1";

export const defaultState: TrackerState = {
  child: seedChild,
  allergens: seedAllergens,
  logs: seedLogs,
  caregivers: seedCaregivers,
};

export function loadTrackerState(): TrackerState {
  if (typeof window === "undefined") return defaultState;
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return defaultState;

  try {
    return { ...defaultState, ...JSON.parse(stored) };
  } catch {
    return defaultState;
  }
}

export function saveTrackerState(state: TrackerState) {
  window.localStorage.setItem(storageKey, JSON.stringify(state));
}

export function resetTrackerState() {
  window.localStorage.removeItem(storageKey);
}
