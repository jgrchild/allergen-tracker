"use client";

import { SupabaseClient } from "@supabase/supabase-js";
import { TrackerState } from "./storage";

const tableName = "tracker_states";

export async function loadCloudTrackerState(
  supabase: SupabaseClient,
  userId: string,
): Promise<TrackerState | null> {
  const { data, error } = await supabase
    .from(tableName)
    .select("payload")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data?.payload as TrackerState | undefined) ?? null;
}

export async function saveCloudTrackerState(
  supabase: SupabaseClient,
  userId: string,
  state: TrackerState,
) {
  const { error } = await supabase.from(tableName).upsert(
    {
      user_id: userId,
      payload: state,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
}
