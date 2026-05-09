import { Allergen, ExposureLog, WeeklyExposureTarget } from "@/types";
import { isWithinCurrentWeek, startOfWeek } from "./dates";

export function activeAllergens(allergens: Allergen[]) {
  return allergens.filter((allergen) => allergen.status === "active exposure");
}

export function blockedAllergens(allergens: Allergen[]) {
  return allergens.filter(
    (allergen) => allergen.status === "avoid" || allergen.status === "paused",
  );
}

export function logsForAllergen(logs: ExposureLog[], allergenId: string) {
  return logs
    .filter((log) => log.allergenId === allergenId)
    .sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );
}

export function weeklyTargetFor(
  allergen: Allergen,
  logs: ExposureLog[],
): WeeklyExposureTarget {
  const completedCount = logsForAllergen(logs, allergen.id).filter((log) =>
    isWithinCurrentWeek(log.occurredAt),
  ).length;

  return {
    allergenId: allergen.id,
    weekStart: startOfWeek().toISOString(),
    targetCount: allergen.targetFrequencyPerWeek,
    completedCount,
    remainingCount: Math.max(allergen.targetFrequencyPerWeek - completedCount, 0),
  };
}
