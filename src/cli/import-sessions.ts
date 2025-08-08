#!/usr/bin/env -S node --experimental-strip-types --no-warnings
/*
  Script: Import F1 sessions for a given year into SQLite using Drizzle ORM.
  Usage:
    - Set DATABASE_FILE (optional, defaults to ./db.sqlite)
    - Run: npm run import:sessions -- --year 2025
*/

import "dotenv/config";
import { db } from "../db/index.js";
import { sessions } from "../db/schema.js";
import { fetchJson } from "../lib/http.js";

type F1Session = {
  meeting_key: number;
  session_key: number;
  location: string;
  date_start: string;
  date_end: string;
  session_type: "Race" | "Sprint" | string;
  session_name: string;
  country_key: number;
  country_code: string;
  country_name: string;
  circuit_key: number;
  circuit_short_name: string;
  gmt_offset: string;
  year: number;
};

function getArg(flag: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

async function main() {
  const yearStr = getArg("--year") ?? process.env.YEAR;
  if (!yearStr) {
    console.error("Missing --year. Example: pnpm tsx src/cli/import-sessions.ts --year 2025");
    process.exit(1);
  }
  const year = Number(yearStr);
  if (!Number.isInteger(year) || year < 1950) {
    console.error("Invalid year provided.");
    process.exit(1);
  }

  const url = `https://api.openf1.org/v1/sessions?year=${year}`;
  console.log(`Fetching sessions for ${year} ...`);
  const data = await fetchJson<F1Session[]>(url);

  const filtered = data.filter((s) => s.session_type === "Race" || s.session_type === "Sprint");
  console.log(`Fetched ${data.length} sessions; importing ${filtered.length} (Race/Sprint).`);

  let inserted = 0;
  for (const s of filtered) {
    const payload = {
      sessionKey: s.session_key,
      meetingKey: s.meeting_key,
      location: s.location,
      // Store as ISO strings in SQLite
      dateStart: s.date_start,
      dateEnd: s.date_end,
      sessionType: s.session_type,
      sessionName: s.session_name,
      countryKey: s.country_key,
      countryCode: s.country_code,
      countryName: s.country_name,
      circuitKey: s.circuit_key,
      circuitShortName: s.circuit_short_name,
      gmtOffset: s.gmt_offset,
      year: s.year,
    };

    try {
      await db
        .insert(sessions)
        .values(payload)
        .onConflictDoUpdate({
          target: sessions.sessionKey,
          set: payload,
        });
      inserted += 1;
    } catch (err) {
      console.error(`Failed to upsert session ${s.session_key}:`, err);
    }
  }

  console.log(`Done. Upserted ${inserted} sessions.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
