#!/usr/bin/env -S node --experimental-strip-types --no-warnings
/*
  Script: Import F1 drivers for a given session_key into SQLite using Drizzle ORM.
  Usage:
    - Set DATABASE_FILE (optional, defaults to ./db.sqlite)
    - Run: npm run import:drivers -- --session-key 9928
*/

import "dotenv/config";
import { db } from "../db/index.js";
import { drivers } from "../db/schema.js";
import { fetchJson } from "../lib/http.js";

type F1Driver = {
  meeting_key: number;
  session_key: number;
  driver_number: number;
  broadcast_name: string;
  full_name: string;
  name_acronym: string;
  team_name: string;
  team_colour: string;
  first_name: string;
  last_name: string;
  headshot_url: string | null;
  country_code: string | null;
};

function getArg(flag: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

async function main() {
  const sessionKeyStr =
    getArg("--session-key") ?? getArg("--session_key") ?? process.env.SESSION_KEY;
  if (!sessionKeyStr) {
    console.error(
      "Missing --session-key. Example: pnpm tsx src/cli/import-drivers.ts --session-key 9928",
    );
    process.exit(1);
  }

  const sessionKey = Number(sessionKeyStr);
  if (!Number.isInteger(sessionKey) || sessionKey <= 0) {
    console.error("Invalid session key provided.");
    process.exit(1);
  }

  const url = `https://api.openf1.org/v1/drivers?session_key=${sessionKey}`;
  console.log(`Fetching drivers for session_key=${sessionKey} ...`);
  const data = await fetchJson<F1Driver[]>(url);

  console.log(`Fetched ${data.length} drivers; upserting ...`);

  let upserted = 0;
  for (const d of data) {
    // country_code may be null in API; our schema requires a non-null string
    const countryCode = d.country_code ?? "UNK";
    const payload = {
      sessionKey: d.session_key,
      meetingKey: d.meeting_key,
      driverNumber: d.driver_number,
      broadcastName: d.broadcast_name,
      countryCode,
      firstName: d.first_name,
      fullName: d.full_name,
      headshotUrl: d.headshot_url ?? undefined,
      lastName: d.last_name,
      nameAcronym: d.name_acronym,
      teamColour: d.team_colour,
      teamName: d.team_name,
    };

    try {
      await db
        .insert(drivers)
        .values(payload)
        .onConflictDoUpdate({
          target: [drivers.sessionKey, drivers.driverNumber],
          set: payload,
        });
      upserted += 1;
    } catch (err) {
      console.error(
        `Failed to upsert driver ${d.driver_number} for session ${d.session_key}:`,
        err,
      );
    }
  }

  console.log(`Done. Upserted ${upserted} drivers.`);
  console.log(
    "Note: If you see foreign key errors, import sessions first for the given session_key.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


