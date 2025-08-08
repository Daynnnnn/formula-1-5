"use server";

import { unstable_cache, revalidateTag } from "next/cache";
import { db, sessions, sessionResults, drivers } from "@/db";
import { inArray, and, eq } from "drizzle-orm";

// Unused filter kept here for reference; standings include all drivers
// const top4TeamDriverNumbers = [1, 4, 12, 16, 44, 63, 81];

export type DriverStanding = {
  position: number;
  driver: string;
  nationality: string;
  team: string;
  points: number;
  wins: number; // Grand Prix wins
  sprintWins: number; // Sprint wins
  podiums: number;
};

const f1PointsByPosition: { [position: number]: number } = {
  1: 25,
  2: 18,
  3: 15,
  4: 12,
  5: 10,
  6: 8,
  7: 6,
  8: 4,
  9: 2,
  10: 1,
};

const sprintPointsByPosition: { [position: number]: number } = {
  1: 8,
  2: 7,
  3: 6,
  4: 5,
  5: 4,
  6: 3,
  7: 2,
  8: 1,
};

type FilterOptions = {
  excludeTeams?: string[];
  excludeDriverNumbers?: number[];
  year?: number;
};

const buildStandings = async (opts: FilterOptions = {}): Promise<DriverStanding[]> => {
  const { excludeTeams = [], excludeDriverNumbers = [], year } = opts;
  const excludeTeamTokens = excludeTeams.map((t) => t.trim().toLowerCase()).filter(Boolean);
  const excludeDriverSet = new Set(excludeDriverNumbers);
  // Determine latest season available in DB
  const allYearsRows = await db.select({ year: sessions.year }).from(sessions);
  if (allYearsRows.length === 0) {
    throw new Error("No sessions found in DB. Run the import scripts first.");
  }
  const latestYear = year ?? Math.max(...allYearsRows.map((r) => r.year));

  // Fetch all race/sprint sessions for that year
  const seasonSessions = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.year, latestYear), inArray(sessions.sessionName, ["Race", "Sprint"])));

  if (seasonSessions.length === 0) {
    throw new Error(`No race/sprint sessions found for year ${latestYear}.`);
  }

  // Map session_key -> session meta
  const sessionByKey = new Map(seasonSessions.map((s) => [s.sessionKey, s]));
  const sessionKeys = seasonSessions.map((s) => s.sessionKey);

  // Load all results for the season
  const results = await db
    .select()
    .from(sessionResults)
    .where(inArray(sessionResults.sessionKey, sessionKeys));

  // Load driver metadata for the season
  const driverRows = await db
    .select()
    .from(drivers)
    .where(inArray(drivers.sessionKey, sessionKeys));

  // Build helper index: sessionKey -> (driverNumber -> driver row)
  const driverIndexBySession: Map<number, Map<number, typeof driverRows[number]>> = new Map();
  for (const d of driverRows) {
    if (!driverIndexBySession.has(d.sessionKey)) {
      driverIndexBySession.set(d.sessionKey, new Map());
    }
    driverIndexBySession.get(d.sessionKey)!.set(d.driverNumber, d);
  }

  // Sort sessions by date_start to pick the latest known team/metadata per driver
  const sessionsSortedAsc = [...seasonSessions].sort((a, b) => a.dateStart.localeCompare(b.dateStart));
  const latestMetaByDriver: Map<number, typeof driverRows[number]> = new Map();
  for (let i = 0; i < sessionsSortedAsc.length; i += 1) {
    const s = sessionsSortedAsc[i];
    const idx = driverIndexBySession.get(s.sessionKey);
    if (!idx) continue;
    for (const [driverNumber, meta] of idx.entries()) {
      latestMetaByDriver.set(driverNumber, meta);
    }
  }

  // Group results by session and recompute ranks after exclusions
  const resultsBySession = new Map<number, typeof results>();
  for (const r of results) {
    if (!resultsBySession.has(r.sessionKey)) resultsBySession.set(r.sessionKey, []);
    resultsBySession.get(r.sessionKey)!.push(r);
  }

  const driverToAgg: Map<number, { points: number; wins: number; sprintWins: number; podiums: number }> = new Map();
  for (const s of seasonSessions) {
    const sessionRs = (resultsBySession.get(s.sessionKey) ?? [])
      .filter((r) => r.dns === false && r.dsq === false && (r.position ?? 0) > 0);

    const idx = driverIndexBySession.get(s.sessionKey);
    const enriched = sessionRs
      .map((r) => ({ r, meta: idx?.get(r.driverNumber) ?? latestMetaByDriver.get(r.driverNumber) }))
      .filter(({ r, meta }) => {
        if (excludeDriverSet.has(r.driverNumber)) return false;
        const teamLower = meta?.teamName?.toLowerCase() ?? "";
        // Contains match to support inputs like "red bull" vs DB "Red Bull Racing"
        if (excludeTeamTokens.some((token) => token && teamLower.includes(token))) return false;
        return true;
      })
      .sort((a, b) => (a.r.position ?? 9999) - (b.r.position ?? 9999));

    const pointsMap = s.sessionName === "Sprint" ? sprintPointsByPosition : f1PointsByPosition;
    for (let idxPos = 0; idxPos < enriched.length; idxPos += 1) {
      const { r } = enriched[idxPos];
      const rank = idxPos + 1; // position after filtering
      const add = pointsMap[rank] ?? 0;
      const prev = driverToAgg.get(r.driverNumber) ?? { points: 0, wins: 0, sprintWins: 0, podiums: 0 };
      const isSprint = s.sessionName === "Sprint";
      const wins = prev.wins + (rank === 1 && !isSprint ? 1 : 0);
      const sprintWins = prev.sprintWins + (rank === 1 && isSprint ? 1 : 0);
      const podiums = prev.podiums + (rank >= 1 && rank <= 3 ? 1 : 0);
      const points = prev.points + add;
      driverToAgg.set(r.driverNumber, { points, wins, sprintWins, podiums });
    }
  }

  const standings: DriverStanding[] = [];
  for (const [driverNumber, agg] of driverToAgg.entries()) {
    // Find the most recent driver record for this driver in the season
    let meta: typeof driverRows[number] | undefined;
    for (let i = sessionsSortedAsc.length - 1; i >= 0; i -= 1) {
      const s = sessionsSortedAsc[i];
      const index = driverIndexBySession.get(s.sessionKey);
      const candidate = index?.get(driverNumber);
      if (candidate) {
        meta = candidate;
        break;
      }
    }

    const driverName = meta ? `${meta.firstName} ${meta.lastName}` : `#${driverNumber}`;
    const nationality = meta?.countryCode ?? "UNK";
    const team = meta?.teamName ?? "Unknown";

    standings.push({
      position: 0, // temp; will be assigned after sorting
      driver: driverName,
      nationality,
      team,
      points: agg.points,
      wins: agg.wins,
      sprintWins: agg.sprintWins,
      podiums: agg.podiums,
    });
  }

  standings.sort((a, b) => b.points - a.points);
  standings.forEach((s, idx) => (s.position = idx + 1));

  return standings;
};

// Cross-request cached standings. Revalidates every hour or when the tag is revalidated.
export const getStandings = unstable_cache(buildStandings, [
  "standings-from-db-v1",
], {
  revalidate: 3600,
  tags: ["f1-standings"],
});

export async function getStandingsFiltered(opts: FilterOptions): Promise<DriverStanding[]> {
  // Optional: lightweight per-filter cache key
  const key = JSON.stringify({
    year: opts.year ?? null,
    excludeTeams: (opts.excludeTeams ?? []).map((t) => t.toLowerCase()).sort(),
    excludeDriverNumbers: (opts.excludeDriverNumbers ?? []).slice().sort((a, b) => a - b),
  });
  const cached = unstable_cache(() => buildStandings(opts), [
    "standings-filtered-v1",
    key,
  ], {
    revalidate: 3600,
    tags: ["f1-standings"],
  });
  return cached();
}

export async function revalidateStandings() {
  revalidateTag("f1-standings");
}

export default getStandings;