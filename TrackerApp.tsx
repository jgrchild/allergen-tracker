"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { User } from "@supabase/supabase-js";
import { Allergen, AllergenStatus, ExposureLog, ReactionSeverity } from "@/types";
import { formatDay, formatShortDate, startOfWeek, toDateInputValue } from "@/lib/dates";
import {
  loadCloudTrackerState,
  saveCloudTrackerState,
} from "@/lib/cloudStorage";
import {
  defaultState,
  loadTrackerState,
  resetTrackerState,
  saveTrackerState,
  TrackerState,
} from "@/lib/storage";
import {
  activeAllergens,
  blockedAllergens,
  logsForAllergen,
  weeklyTargetFor,
} from "@/lib/selectors";
import {
  createSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

type Tab = "week" | "log" | "care" | "foods" | "history" | "settings";

const tabs: { value: Tab; label: string; shortLabel: string }[] = [
  { value: "week", label: "This week", shortLabel: "Week" },
  { value: "log", label: "Log exposure", shortLabel: "Log" },
  { value: "care", label: "Caregiver", shortLabel: "Care" },
  { value: "foods", label: "Foods", shortLabel: "Foods" },
  { value: "history", label: "History", shortLabel: "History" },
  { value: "settings", label: "Settings", shortLabel: "Settings" },
];

const disclaimer =
  "This app is a tracking tool only and does not provide medical advice. Follow your child’s allergist/pediatrician’s guidance and emergency action plan.";

const statuses: AllergenStatus[] = [
  "active exposure",
  "avoid",
  "paused",
  "not introduced",
];

const reactions: ReactionSeverity[] = ["none", "mild", "moderate", "severe"];

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export default function TrackerApp() {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const [state, setState] = useState<TrackerState>(defaultState);
  const [isReady, setIsReady] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudStatus, setCloudStatus] = useState(
    isSupabaseConfigured()
      ? "Cloud sync ready to connect"
      : "Local only until Supabase is configured",
  );
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>("week");

  useEffect(() => {
    let isMounted = true;
    const localState = loadTrackerState();
    setState(localState);

    async function initializeCloud() {
      if (!supabase) {
        if (!isMounted) return;
        setCloudReady(true);
        setIsReady(true);
        return;
      }

      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();
        if (!isMounted) return;
        setUser(currentUser);

        if (currentUser) {
          setCloudStatus("Loading shared family data...");
          const cloudState = await loadCloudTrackerState(supabase, currentUser.id);
          if (!isMounted) return;
          if (cloudState) {
            setState(cloudState);
            setCloudStatus("Cloud sync connected");
          } else {
            await saveCloudTrackerState(supabase, currentUser.id, localState);
            setCloudStatus("Cloud sync connected");
          }
        } else {
          setCloudStatus("Sign in to sync across phones");
        }
      } catch (error) {
        setCloudStatus(cloudErrorMessage(error));
      } finally {
        if (isMounted) {
          setCloudReady(true);
          setIsReady(true);
        }
      }
    }

    initializeCloud();

    const subscription = supabase?.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      setUser(session?.user ?? null);
      if (!session?.user) {
        setCloudStatus("Signed out. This device is using local storage.");
        return;
      }

      try {
        setCloudStatus("Loading shared family data...");
        const cloudState = await loadCloudTrackerState(supabase, session.user.id);
        if (cloudState) setState(cloudState);
        setCloudStatus("Cloud sync connected");
      } catch (error) {
        setCloudStatus(cloudErrorMessage(error));
      }
    });

    return () => {
      isMounted = false;
      subscription?.data.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (isReady) saveTrackerState(state);
  }, [isReady, state]);

  useEffect(() => {
    if (!isReady || !cloudReady || !supabase || !user) return;

    setCloudStatus("Saving to cloud...");
    const timeout = window.setTimeout(async () => {
      try {
        await saveCloudTrackerState(supabase, user.id, state);
        setCloudStatus("Cloud sync connected");
      } catch (error) {
        setCloudStatus(cloudErrorMessage(error));
      }
    }, 600);

    return () => window.clearTimeout(timeout);
  }, [cloudReady, isReady, state, supabase, user]);

  async function signInWithEmail(email: string) {
    if (!supabase) {
      setCloudStatus("Add Supabase environment variables to enable sign in.");
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });

    if (error) {
      setCloudStatus(cloudErrorMessage(error));
      return;
    }

    setCloudStatus("Check your email for the sign-in link.");
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setCloudStatus(cloudErrorMessage(error));
      return;
    }
    setUser(null);
    setCloudStatus("Signed out. This device is using local storage.");
  }

  const active = useMemo(() => activeAllergens(state.allergens), [state.allergens]);
  const blocked = useMemo(() => blockedAllergens(state.allergens), [state.allergens]);
  const weekStart = startOfWeek();
  const weekDays = [...Array(7)].map((_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  });

  function upsertAllergen(next: Allergen) {
    setState((current) => ({
      ...current,
      allergens: current.allergens.some((item) => item.id === next.id)
        ? current.allergens.map((item) => (item.id === next.id ? next : item))
        : [next, ...current.allergens],
    }));
  }

  function addExposure(log: ExposureLog) {
    setState((current) => ({ ...current, logs: [log, ...current.logs] }));
    setTab("week");
  }

  return (
    <main className="min-h-screen bg-calm pb-28 sm:pb-0">
      <section className="border-b border-ink/10 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-3 py-4 sm:gap-5 sm:px-6 sm:py-5 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold leading-tight tracking-normal text-ink sm:text-3xl">
                Family allergen exposure tracker
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/70">
                Track the weekly plan your family enters, with avoid and paused
                foods kept clearly separate.
              </p>
            </div>
            <div className="rounded-md border border-honey/50 bg-honey/15 px-3 py-3 text-xs leading-5 text-ink sm:px-4 sm:text-sm">
              {disclaimer}
            </div>
          </div>

          <nav className="no-print hidden gap-2 overflow-x-auto pb-1 sm:flex">
            {tabs.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                className={`shrink-0 rounded-md border px-4 py-2 text-sm font-medium transition ${
                  tab === value
                    ? "border-moss bg-moss text-white"
                    : "border-ink/10 bg-white text-ink hover:border-moss/40"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        {tab === "week" && (
          <WeeklyDashboard
            active={active}
            blocked={blocked}
            logs={state.logs}
            weekDays={weekDays}
            onLog={() => setTab("log")}
          />
        )}
        {tab === "log" && (
          <ExposureForm
            allergens={state.allergens}
            caregivers={state.caregivers.map((caregiver) => caregiver.name)}
            onAdd={addExposure}
          />
        )}
        {tab === "care" && (
          <CaregiverView
            active={active}
            blocked={blocked}
            logs={state.logs}
            childName={state.child.name}
          />
        )}
        {tab === "foods" && (
          <AllergenSetup allergens={state.allergens} onSave={upsertAllergen} />
        )}
        {tab === "history" && (
          <HistoryView allergens={state.allergens} logs={state.logs} />
        )}
        {tab === "settings" && (
          <SettingsView
            childName={state.child.name}
            cloudStatus={cloudStatus}
            disclaimer={disclaimer}
            isCloudConfigured={Boolean(supabase)}
            userEmail={user?.email ?? null}
            onChildNameChange={(name) =>
              setState((current) => ({
                ...current,
                child: { ...current.child, name },
              }))
            }
            onSignIn={signInWithEmail}
            onSignOut={signOut}
            onReset={() => {
              resetTrackerState();
              setState(defaultState);
            }}
          />
        )}
      </section>

      <footer className="border-t border-ink/10 px-4 py-6 text-center text-xs leading-5 text-ink/60">
        {disclaimer}
      </footer>
      <nav className="mobile-tabbar no-print fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-white/95 px-2 py-2 shadow-[0_-10px_30px_rgba(39,50,47,0.12)] backdrop-blur sm:hidden">
        <div className="grid grid-cols-6 gap-1">
          {tabs.map(({ value, shortLabel }) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`min-h-12 rounded-md px-1 text-[11px] font-semibold leading-tight transition ${
                tab === value
                  ? "bg-moss text-white"
                  : "bg-transparent text-ink/65 active:bg-calm"
              }`}
            >
              {shortLabel}
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}

function WeeklyDashboard({
  active,
  blocked,
  logs,
  weekDays,
  onLog,
}: {
  active: Allergen[];
  blocked: Allergen[];
  logs: ExposureLog[];
  weekDays: Date[];
  onLog: () => void;
}) {
  const remainingTotal = active.reduce(
    (sum, allergen) => sum + weeklyTargetFor(allergen, logs).remainingCount,
    0,
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px] lg:gap-5">
      <section className="rounded-md border border-ink/10 bg-white p-3 shadow-soft sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-ink">Monday to Sunday</h2>
            <p className="mt-1 text-sm text-ink/65">
              {formatDay(weekDays[0])} through {formatDay(weekDays[6])}
            </p>
          </div>
          <button
            onClick={onLog}
            className="min-h-12 rounded-md bg-moss px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-ink sm:min-h-0"
          >
            Add exposure
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          <Metric label="Active foods" value={active.length.toString()} />
          <Metric label="Remaining this week" value={remainingTotal.toString()} />
          <Metric label="Logged this week" value={logsThisWeek(logs).toString()} />
        </div>

        <div className="mt-5 grid gap-3 sm:mt-6">
          {active.map((allergen) => {
            const target = weeklyTargetFor(allergen, logs);
            const latest = logsForAllergen(logs, allergen.id)[0];
            const done = target.remainingCount === 0;

            return (
              <article
                key={allergen.id}
                className={`rounded-md border p-3 sm:p-4 ${
                  done ? "border-leaf/30 bg-leaf/10" : "border-honey/50 bg-honey/10"
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-ink">
                        {allergen.name}
                      </h3>
                      <StatusBadge status={allergen.status} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-ink/70">
                      {allergen.safeForms || "Use only the form in your family plan."}
                    </p>
                    {allergen.allergistNotes && (
                      <p className="mt-1 text-sm leading-6 text-ink/70">
                        Note: {allergen.allergistNotes}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center sm:w-64">
                    <MiniCount label="Target" value={target.targetCount} />
                    <MiniCount label="Done" value={target.completedCount} />
                    <MiniCount label="Left" value={target.remainingCount} strong />
                  </div>
                </div>
                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-ink/50">
                  Last given: {formatShortDate(latest?.occurredAt)}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <aside className="rounded-md border border-rose/25 bg-white p-3 shadow-soft sm:p-6">
        <h2 className="text-lg font-semibold text-ink">Do not give list</h2>
        <p className="mt-1 text-sm leading-6 text-ink/65">
          Avoid and paused foods are shown here only. They are never included in
          remaining weekly exposure counts.
        </p>
        <div className="mt-4 grid gap-3">
          {blocked.map((allergen) => (
            <div
              key={allergen.id}
              className="rounded-md border border-rose/30 bg-rose/10 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-ink">{allergen.name}</h3>
                <StatusBadge status={allergen.status} />
              </div>
              <p className="mt-2 text-sm text-ink/70">
                Do not give. {allergen.allergistNotes}
              </p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function ExposureForm({
  allergens,
  caregivers,
  onAdd,
}: {
  allergens: Allergen[];
  caregivers: string[];
  onAdd: (log: ExposureLog) => void;
}) {
  const allowed = allergens.filter((allergen) => allergen.status === "active exposure");
  const [reaction, setReaction] = useState<ReactionSeverity>("none");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    allergenId: allowed[0]?.id ?? "",
    occurredAt: toDateInputValue(new Date()),
    foodFormGiven: "",
    amount: "",
    givenBy: caregivers[0] ?? "",
    symptomsNotes: "",
    notes: "",
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.allergenId || !form.foodFormGiven.trim() || !form.amount.trim()) {
      setError("Choose an active food, food/form, and amount before saving.");
      return;
    }
    setError("");
    onAdd({
      id: makeId("log"),
      allergenId: form.allergenId,
      occurredAt: new Date(form.occurredAt).toISOString(),
      foodFormGiven: form.foodFormGiven.trim(),
      amount: form.amount.trim(),
      givenBy: form.givenBy.trim() || "Caregiver",
      reaction,
      symptomsNotes: form.symptomsNotes.trim(),
      notes: form.notes.trim(),
      photoAttachmentUrl: "",
    });
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto max-w-3xl rounded-md border border-ink/10 bg-white p-3 shadow-soft sm:p-6"
    >
      <h2 className="text-xl font-semibold text-ink">Log exposure</h2>
      <p className="mt-1 text-sm leading-6 text-ink/65">
        Only active exposure foods are available here.
      </p>
      {error && <p className="mt-4 rounded-md bg-rose/10 p-3 text-sm text-rose">{error}</p>}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Date and time">
          <input
            type="datetime-local"
            value={form.occurredAt}
            onChange={(event) => setForm({ ...form, occurredAt: event.target.value })}
            className="input"
          />
        </Field>
        <Field label="Allergen">
          <select
            value={form.allergenId}
            onChange={(event) => setForm({ ...form, allergenId: event.target.value })}
            className="input"
          >
            {allowed.map((allergen) => (
              <option key={allergen.id} value={allergen.id}>
                {allergen.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Food/form given">
          <input
            value={form.foodFormGiven}
            onChange={(event) => setForm({ ...form, foodFormGiven: event.target.value })}
            className="input"
            placeholder="Muffin, yogurt, thin butter"
          />
        </Field>
        <Field label="Amount">
          <input
            value={form.amount}
            onChange={(event) => setForm({ ...form, amount: event.target.value })}
            className="input"
            placeholder="Amount from your plan"
          />
        </Field>
        <Field label="Who gave it">
          <input
            value={form.givenBy}
            onChange={(event) => setForm({ ...form, givenBy: event.target.value })}
            className="input"
          />
        </Field>
        <Field label="Reaction">
          <select
            value={reaction}
            onChange={(event) => setReaction(event.target.value as ReactionSeverity)}
            className="input"
          >
            {reactions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {reaction !== "none" && (
        <div className="mt-5 rounded-md border border-rose/30 bg-rose/10 p-4 text-sm font-medium leading-6 text-ink">
          Follow your allergist’s action plan. This app does not provide
          emergency guidance.
        </div>
      )}

      <div className="mt-4 grid gap-4">
        <Field label="Symptoms notes">
          <textarea
            value={form.symptomsNotes}
            onChange={(event) => setForm({ ...form, symptomsNotes: event.target.value })}
            className="input min-h-24"
            placeholder="Optional"
          />
        </Field>
        <Field label="Photo upload">
          <div className="rounded-md border border-dashed border-ink/20 bg-calm p-4 text-sm text-ink/60">
            Future photo attachment field
          </div>
        </Field>
        <Field label="Notes">
          <textarea
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
            className="input min-h-24"
            placeholder="Optional family notes"
          />
        </Field>
      </div>
      <button className="mt-5 min-h-12 w-full rounded-md bg-moss px-4 py-3 text-sm font-semibold text-white hover:bg-ink">
        Save exposure
      </button>
    </form>
  );
}

function CaregiverView({
  active,
  blocked,
  logs,
  childName,
}: {
  active: Allergen[];
  blocked: Allergen[];
  logs: ExposureLog[];
  childName: string;
}) {
  return (
    <section className="print-surface rounded-md border border-ink/10 bg-white p-3 shadow-soft sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-ink">
            Today / this week for {childName}
          </h2>
          <p className="mt-1 text-sm text-ink/65">
            A simple handoff summary for parents and caregivers.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="no-print min-h-12 rounded-md border border-ink/15 px-4 py-3 text-sm font-semibold text-ink hover:border-moss sm:min-h-0"
        >
          Print summary
        </button>
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="font-semibold text-ink">Foods allowed to give</h3>
          <div className="mt-3 grid gap-3">
            {active.map((allergen) => {
              const target = weeklyTargetFor(allergen, logs);
              return (
                <div key={allergen.id} className="rounded-md border border-leaf/25 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <strong>{allergen.name}</strong>
                    <span className="text-sm font-semibold text-moss">
                      {target.remainingCount} left
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-ink/70">
                    {allergen.safeForms || allergen.servingExamples}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-ink/70">
                    {allergen.allergistNotes}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <h3 className="font-semibold text-ink">Foods to avoid or pause</h3>
          <div className="mt-3 grid gap-3">
            {blocked.map((allergen) => (
              <div key={allergen.id} className="rounded-md border border-rose/30 bg-rose/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <strong>{allergen.name}</strong>
                  <StatusBadge status={allergen.status} />
                </div>
                <p className="mt-2 text-sm leading-6 text-ink/75">
                  Do not give. {allergen.allergistNotes}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function AllergenSetup({
  allergens,
  onSave,
}: {
  allergens: Allergen[];
  onSave: (allergen: Allergen) => void;
}) {
  const makeEmptyAllergen = (): Allergen => ({
    id: "",
    name: "",
    status: "active exposure",
    targetFrequencyPerWeek: 1,
    allergistNotes: "",
    safeForms: "",
    servingExamples: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const formRef = useRef<HTMLFormElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<Allergen>(makeEmptyAllergen);
  const [error, setError] = useState("");
  const isEditingExisting = Boolean(editing.id);
  const isBlocked = editing.status === "avoid" || editing.status === "paused";

  function startEdit(allergen: Allergen) {
    setEditing({ ...allergen });
    setError("");
    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      nameInputRef.current?.focus();
    });
  }

  function clearForm() {
    setEditing(makeEmptyAllergen());
    setError("");
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!editing.name.trim()) {
      setError("Food name is required.");
      return;
    }
    setError("");
    onSave({
      ...editing,
      id: editing.id || makeId("allergen"),
      name: editing.name.trim(),
      targetFrequencyPerWeek: isBlocked ? 0 : Number(editing.targetFrequencyPerWeek),
      updatedAt: new Date().toISOString(),
    });
    clearForm();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr] lg:gap-5">
      <form
        ref={formRef}
        onSubmit={save}
        className={`rounded-md border bg-white p-3 shadow-soft sm:p-6 ${
          isEditingExisting ? "border-moss/50 ring-2 ring-moss/10" : "border-ink/10"
        }`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-ink">
              {isEditingExisting ? `Editing ${editing.name}` : "Food setup"}
            </h2>
            <p className="mt-1 text-sm leading-6 text-ink/65">
              {isEditingExisting
                ? "Update this food, then save changes."
                : "Add a food from the plan your family enters."}
            </p>
          </div>
          {isEditingExisting && (
            <button
              type="button"
              onClick={clearForm}
              className="min-h-11 rounded-md border border-ink/15 px-3 py-2 text-sm font-semibold text-ink hover:border-moss sm:min-h-0"
            >
              Cancel
            </button>
          )}
        </div>
        {error && <p className="mt-3 rounded-md bg-rose/10 p-3 text-sm text-rose">{error}</p>}
        <div className="mt-4 grid gap-4">
          <Field label="Food name">
            <input
              ref={nameInputRef}
              className="input"
              value={editing.name}
              onChange={(event) => setEditing({ ...editing, name: event.target.value })}
            />
          </Field>
          <Field label="Status">
            <select
              className="input"
              value={editing.status}
              onChange={(event) => {
                const status = event.target.value as AllergenStatus;
                setEditing({
                  ...editing,
                  status,
                  targetFrequencyPerWeek:
                    status === "avoid" || status === "paused"
                      ? 0
                      : Math.max(editing.targetFrequencyPerWeek, 1),
                });
              }}
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Target frequency per week">
            <input
              className="input disabled:bg-ink/5 disabled:text-ink/45"
              disabled={isBlocked}
              min="0"
              type="number"
              value={editing.targetFrequencyPerWeek}
              onChange={(event) =>
                setEditing({
                  ...editing,
                  targetFrequencyPerWeek: Math.max(Number(event.target.value), 0),
                })
              }
            />
          </Field>
          <Field label="Notes from allergist">
            <textarea className="input min-h-24" value={editing.allergistNotes} onChange={(event) => setEditing({ ...editing, allergistNotes: event.target.value })} />
          </Field>
          <Field label="Safe forms / serving examples">
            <textarea className="input min-h-24" value={editing.safeForms} onChange={(event) => setEditing({ ...editing, safeForms: event.target.value })} />
          </Field>
          <Field label="Additional serving details">
            <textarea className="input min-h-20" value={editing.servingExamples} onChange={(event) => setEditing({ ...editing, servingExamples: event.target.value })} />
          </Field>
        </div>
        {(editing.status === "avoid" || editing.status === "paused") && (
          <p className="mt-4 rounded-md border border-rose/30 bg-rose/10 p-3 text-sm font-medium text-ink">
            Do not give warning will show for this food.
          </p>
        )}
        <button className="mt-5 min-h-12 w-full rounded-md bg-moss px-4 py-3 text-sm font-semibold text-white hover:bg-ink">
          {isEditingExisting ? "Save changes" : "Add food"}
        </button>
      </form>

      <section className="rounded-md border border-ink/10 bg-white p-3 shadow-soft sm:p-6">
        <h2 className="text-xl font-semibold text-ink">Current foods</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {allergens.map((allergen) => (
            <article key={allergen.id} className="rounded-md border border-ink/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-ink">{allergen.name}</h3>
                  <p className="mt-1 text-sm text-ink/60">
                    {allergen.targetFrequencyPerWeek}x/week
                  </p>
                </div>
                <StatusBadge status={allergen.status} />
              </div>
              {(allergen.status === "avoid" || allergen.status === "paused") && (
                <p className="mt-3 rounded-md bg-rose/10 p-2 text-sm font-medium text-rose">
                  Do not give
                </p>
              )}
              <p className="mt-3 text-sm leading-6 text-ink/70">
                {allergen.allergistNotes || "No notes yet."}
              </p>
              <button
                type="button"
                onClick={() => startEdit(allergen)}
                className="mt-4 min-h-11 w-full rounded-md border border-ink/15 px-3 py-2 text-sm font-semibold text-ink hover:border-moss sm:w-auto sm:min-h-0"
              >
                Edit
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function HistoryView({ allergens, logs }: { allergens: Allergen[]; logs: ExposureLog[] }) {
  const [allergenId, setAllergenId] = useState("all");
  const [reaction, setReaction] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = logs.filter((log) => {
    const time = new Date(log.occurredAt).getTime();
    const afterFrom = from ? time >= new Date(from).getTime() : true;
    const beforeTo = to ? time <= new Date(`${to}T23:59:59`).getTime() : true;
    return (
      (allergenId === "all" || log.allergenId === allergenId) &&
      (reaction === "all" || log.reaction === reaction) &&
      afterFrom &&
      beforeTo
    );
  });

  return (
    <section className="rounded-md border border-ink/10 bg-white p-3 shadow-soft sm:p-6">
      <h2 className="text-xl font-semibold text-ink">History</h2>
      <p className="mt-1 text-sm leading-6 text-ink/65">
        A gentle consistency view, focused on what happened rather than judging
        gaps.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <select className="input" value={allergenId} onChange={(event) => setAllergenId(event.target.value)}>
          <option value="all">All foods</option>
          {allergens.map((allergen) => (
            <option key={allergen.id} value={allergen.id}>{allergen.name}</option>
          ))}
        </select>
        <select className="input" value={reaction} onChange={(event) => setReaction(event.target.value)}>
          <option value="all">All reactions</option>
          {reactions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <input className="input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <input className="input" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
      </div>
      <div className="mt-6 grid gap-3">
        {filtered.length === 0 && (
          <p className="rounded-md bg-calm p-4 text-sm text-ink/65">
            No exposure logs match these filters yet.
          </p>
        )}
        {filtered.map((log) => {
          const allergen = allergens.find((item) => item.id === log.allergenId);
          return (
            <article key={log.id} className="rounded-md border border-ink/10 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-ink">{allergen?.name ?? "Food"}</h3>
                  <p className="text-sm text-ink/60">{formatShortDate(log.occurredAt)}</p>
                </div>
                <ReactionBadge reaction={log.reaction} />
              </div>
              <p className="mt-3 text-sm leading-6 text-ink/75">
                {log.foodFormGiven}, {log.amount}. Given by {log.givenBy}.
              </p>
              {log.reaction !== "none" && (
                <p className="mt-2 rounded-md bg-rose/10 p-3 text-sm font-medium text-ink">
                  Follow your allergist’s action plan. This app does not provide
                  emergency guidance.
                </p>
              )}
              {(log.symptomsNotes || log.notes) && (
                <p className="mt-2 text-sm leading-6 text-ink/70">
                  {[log.symptomsNotes, log.notes].filter(Boolean).join(" ")}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function SettingsView({
  childName,
  cloudStatus,
  disclaimer,
  isCloudConfigured,
  userEmail,
  onChildNameChange,
  onSignIn,
  onSignOut,
  onReset,
}: {
  childName: string;
  cloudStatus: string;
  disclaimer: string;
  isCloudConfigured: boolean;
  userEmail: string | null;
  onChildNameChange: (name: string) => void;
  onSignIn: (email: string) => Promise<void>;
  onSignOut: () => Promise<void>;
  onReset: () => void;
}) {
  const [email, setEmail] = useState("");

  async function submitSignIn(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    await onSignIn(email.trim());
  }

  return (
    <section className="mx-auto max-w-3xl rounded-md border border-ink/10 bg-white p-3 shadow-soft sm:p-6">
      <h2 className="text-xl font-semibold text-ink">Settings</h2>
      <div className="mt-5 grid gap-4">
        <div className="rounded-md border border-leaf/30 bg-leaf/10 p-4">
          <h3 className="font-semibold text-ink">Cloud sync</h3>
          <p className="mt-1 text-sm leading-6 text-ink/70">{cloudStatus}</p>
          {!isCloudConfigured && (
            <p className="mt-2 text-sm leading-6 text-ink/70">
              Add the Supabase values from `.env.example` to enable free shared
              phone sync.
            </p>
          )}
          {isCloudConfigured && userEmail && (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-ink">Signed in as {userEmail}</p>
              <button
                type="button"
                onClick={onSignOut}
                className="min-h-12 rounded-md border border-ink/15 px-4 py-3 text-sm font-semibold text-ink hover:border-moss sm:min-h-0"
              >
                Sign out
              </button>
            </div>
          )}
          {isCloudConfigured && !userEmail && (
            <form onSubmit={submitSignIn} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                className="input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="family email"
              />
              <button className="min-h-12 rounded-md bg-moss px-4 py-3 text-sm font-semibold text-white hover:bg-ink sm:min-h-0">
                Send sign-in link
              </button>
            </form>
          )}
        </div>
        <Field label="Child name">
          <input className="input" value={childName} onChange={(event) => onChildNameChange(event.target.value)} />
        </Field>
        <div className="rounded-md border border-honey/50 bg-honey/15 p-4 text-sm leading-6 text-ink">
          {disclaimer}
        </div>
        <div className="rounded-md bg-calm p-4">
          <h3 className="font-semibold text-ink">Future TODOs</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-ink/70">
            <li>Authentication</li>
            <li>Shared caregiver access</li>
            <li>Doctor export PDF</li>
            <li>Reminders</li>
            <li>Multi-account family permissions</li>
            <li>Photo attachments</li>
          </ul>
        </div>
        <button
          onClick={onReset}
          className="min-h-12 rounded-md border border-rose/30 px-4 py-3 text-sm font-semibold text-rose hover:bg-rose/10 sm:min-h-0"
        >
          Reset sample data
        </button>
      </div>
    </section>
  );
}

function cloudErrorMessage(error: unknown) {
  if (error instanceof Error) return `Cloud sync issue: ${error.message}`;
  return "Cloud sync issue. Check your Supabase setup.";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-ink">
      {label}
      {children}
    </label>
  );
}

function logsThisWeek(logs: ExposureLog[]) {
  const weekStart = startOfWeek();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  return logs.filter((log) => {
    const occurredAt = new Date(log.occurredAt);
    return occurredAt >= weekStart && occurredAt < weekEnd;
  }).length;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-ink/10 bg-calm p-2 sm:p-4">
      <p className="min-h-8 text-[11px] font-semibold leading-4 text-ink/60 sm:min-h-0 sm:text-sm sm:font-normal sm:leading-5">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-ink sm:text-3xl">{value}</p>
    </div>
  );
}

function MiniCount({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className={`rounded-md p-2 sm:p-3 ${strong ? "bg-white" : "bg-white/70"}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink/50 sm:text-xs">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-ink sm:text-xl">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: AllergenStatus }) {
  const tone =
    status === "active exposure"
      ? "bg-leaf/15 text-moss border-leaf/30"
      : status === "avoid"
        ? "bg-rose/15 text-rose border-rose/30"
        : "bg-honey/20 text-ink border-honey/40";
  return (
    <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${tone}`}>
      {status}
    </span>
  );
}

function ReactionBadge({ reaction }: { reaction: ReactionSeverity }) {
  const tone =
    reaction === "none"
      ? "bg-leaf/15 text-moss border-leaf/30"
      : "bg-rose/15 text-rose border-rose/30";
  return (
    <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${tone}`}>
      reaction: {reaction}
    </span>
  );
}
