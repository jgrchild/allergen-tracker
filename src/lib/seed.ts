import { Allergen, Caregiver, ChildProfile, ExposureLog } from "@/types";

const now = new Date().toISOString();

export const seedChild: ChildProfile = {
  id: "child-1",
  name: "Your child",
  allergistName: "Family allergist",
  emergencyPlanLocation: "Kitchen binder",
};

export const seedCaregivers: Caregiver[] = [
  { id: "caregiver-1", name: "Parent", relationship: "Parent" },
  { id: "caregiver-2", name: "Nanny", relationship: "Caregiver" },
];

export const seedAllergens: Allergen[] = [
  {
    id: "baked-egg",
    name: "Baked egg",
    status: "active exposure",
    targetFrequencyPerWeek: 2,
    allergistNotes: "Use only the form already cleared in the plan.",
    safeForms: "Baked into muffin or waffle",
    servingExamples: "Small allergist-approved serving",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "coconut",
    name: "Coconut",
    status: "active exposure",
    targetFrequencyPerWeek: 1,
    allergistNotes: "Track brand and amount.",
    safeForms: "Coconut yogurt or baked item",
    servingExamples: "Small spoonful or serving already used at home",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "almond",
    name: "Almond",
    status: "active exposure",
    targetFrequencyPerWeek: 1,
    allergistNotes: "Keep form consistent with the written plan.",
    safeForms: "Thin almond butter mixed into food",
    servingExamples: "Measured amount from family plan",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "sesame",
    name: "Sesame",
    status: "avoid",
    targetFrequencyPerWeek: 0,
    allergistNotes: "Do not give unless allergist changes the plan.",
    safeForms: "",
    servingExamples: "",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "shellfish",
    name: "Shellfish",
    status: "paused",
    targetFrequencyPerWeek: 0,
    allergistNotes: "Paused / not introduced.",
    safeForms: "",
    servingExamples: "",
    createdAt: now,
    updatedAt: now,
  },
];

export const seedLogs: ExposureLog[] = [];
