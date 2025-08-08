#!/usr/bin/env -S node --experimental-strip-types --no-warnings
/*
  Script: Import F1 session results for every session in the local DB.
  Usage:
    - Set DATABASE_FILE (optional, defaults to ./db.sqlite)
    - Run: npm run import:session-results
    - Optional limiter: --year 2025 (filters sessions in DB by year)
*/

import "dotenv/config";
import { db } from "../db/index.js";
import { sessions, sessionResults } from "../db/schema.js";
import { fetchJson } from "../lib/http.js";

type F1SessionResult = {
  position: number;
  driver_number: number;
  number_of_laps: number;
  dnf: boolean;
  dns: boolean;
  dsq: boolean;
  duration: number | null;
  gap_to_leader: number | null;
  meeting_key: number;
  session_key: number;
};

function getArg(flag: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

async function main() {
  const yearStr = getArg("--year") ?? process.env.YEAR;

  console.log("Loading sessions from DB ...");
  const allSessions = await db.select().from(sessions);
  const filteredSessions = yearStr
    ? allSessions.filter((s) => String(s.year) === String(yearStr))
    : allSessions;

  if (filteredSessions.length === 0) {
    console.log(
      yearStr
        ? `No sessions found in DB for year ${yearStr}.` 
        : "No sessions found in DB. Have you run import:sessions?",
    );
    return;
  }

  console.log(`Found ${filteredSessions.length} sessions. Importing results ...`);

  let totalUpserts = 0;
  for (const s of filteredSessions) {
    const url = `https://api.openf1.org/v1/session_result?session_key=${s.sessionKey}`;
    console.log(`→ Session ${s.sessionKey} (${s.sessionName})`);

    let data: F1SessionResult[] = [];
    try {
      data = await fetchJson<F1SessionResult[]>(url);
    } catch (err) {
      console.error(`Failed fetching results for session ${s.sessionKey}:`, err);
      continue;
    }

    if (!Array.isArray(data) || data.length === 0) {
      console.log("  No results");
      continue;
    }

    let upsertedForSession = 0;
    for (const r of data) {
      const payload = {
        sessionKey: r.session_key,
        driverNumber: r.driver_number,
        position: r.position,
        numberOfLaps: r.number_of_laps,
        dnf: Boolean(r.dnf),
        dns: Boolean(r.dns),
        dsq: Boolean(r.dsq),
        duration: r.duration ?? undefined,
        gapToLeader: r.gap_to_leader ?? undefined,
        meetingKey: r.meeting_key,
      };

      try {
        await db
          .insert(sessionResults)
          .values(payload)
          .onConflictDoUpdate({
            target: [sessionResults.sessionKey, sessionResults.driverNumber],
            set: payload,
          });
        upsertedForSession += 1;
      } catch (err) {
        console.error(
          `  Failed to upsert result for driver ${r.driver_number} in session ${r.session_key}:`,
          err,
        );
      }
    }

    totalUpserts += upsertedForSession;
    console.log(`  Upserted ${upsertedForSession} results.`);
    console.log("waiting 4 seconds...");
    await new Promise(resolve => setTimeout(resolve, 4000));
  }

  console.log(`Done. Upserted ${totalUpserts} session results in total.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


