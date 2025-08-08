'use server';

import Link from "next/link";
import getStandings, { getStandingsFiltered } from "./action";

function teamAccent(team: string): string {
  const map: Record<string, string> = {
    'Red Bull Racing': 'from-blue-700 to-indigo-600',
    Mercedes: 'from-emerald-400 to-teal-500',
    Ferrari: 'from-red-600 to-rose-600',
    McLaren: 'from-amber-400 to-orange-500',
    'Aston Martin': 'from-emerald-600 to-green-700',
    Alpine: 'from-sky-600 to-indigo-600',
    Williams: 'from-blue-500 to-sky-600',
    AlphaTauri: 'from-slate-600 to-slate-800',
    'Alfa Romeo': 'from-rose-500 to-rose-700',
    'Haas F1 Team': 'from-neutral-500 to-neutral-700',
  };
  return map[team] ?? 'from-zinc-600 to-zinc-800';
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Support query param filtering: /?excludeTeams=McLaren,Red%20Bull
  const params = (await searchParams) ?? {};
  const excludeTeamsParam = params.excludeTeams;
  const excludeTeams = Array.isArray(excludeTeamsParam)
    ? excludeTeamsParam
    : excludeTeamsParam
    ? String(excludeTeamsParam)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const standings = excludeTeams.length
    ? await getStandingsFiltered({ excludeTeams })
    : await getStandings();
  const topThree = standings.slice(0, 3);
  const rest = standings.slice(3);

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Top nav */}
      <header className="sticky top-0 z-10 bg-neutral-950/80 backdrop-blur border-b border-white/10">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center gap-6">
            <Link
              href="/"
              className={`font-semibold tracking-tight text-sm transition-colors ${
                excludeTeams.length ? "text-neutral-300 hover:text-white" : "text-white"
              }`}
            >
              F1.5
            </Link>
            <Link
              href="/?excludeTeams=McLaren"
              className={`font-semibold tracking-tight text-sm transition-colors ${
                excludeTeams.length ? "text-white" : "text-neutral-300 hover:text-white"
              }`}
            >
              Without McLaren
            </Link>
          </nav>
        </div>
      </header>
      <section className="container mx-auto px-4 py-14">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{excludeTeams.length ? "Without McLaren Standings" : "Formula 1.5 Standings"}</h1>
      </section>

      {/* Podium */}
      <section className="container mx-auto px-4 mt-4 md:mt-2 mb-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-end">
          {topThree.map((d, idx) => {
            const order = idx === 0 ? 'sm:order-2' : idx === 1 ? 'sm:order-1' : 'sm:order-3';
            const height = idx === 0 ? 'h-40 md:h-72' : idx === 1 ? 'h-36 md:h-64' : 'h-32 md:h-60';
            const titleSize = idx === 0 ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl';
            return (
              <div key={d.position} className={`${order}`}>
                <div className={`relative rounded-2xl p-4 md:p-6 border border-white/10 bg-gradient-to-br ${teamAccent(d.team)} shadow-xl overflow-hidden`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-widest text-white/80">Position</div>
                      <div className="text-3xl md:text-5xl font-extrabold leading-none">{d.position}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-white/80">Points</div>
                      <div className="text-2xl md:text-4xl font-extrabold">{d.points}</div>
                    </div>
                  </div>
                  <div className={`mt-4 md:mt-5 ${height} flex items-end`}>
                    <div className="w-full rounded-xl bg-black/20 backdrop-blur-sm p-4 md:p-5 border border-white/10">
                      <div className={`${titleSize} font-bold truncate`}>{d.driver}</div>
                      <div className="text-sm text-white/85 truncate">{d.team} • {d.nationality}</div>
                      <div className="mt-4 flex gap-3 text-xs text-white/90">
                        <span className="px-2 py-1 rounded-md bg-white/15 border border-white/10">Wins {d.wins}</span>
                        <span className="px-2 py-1 rounded-md bg-white/15 border border-white/10">Sprint Wins {d.sprintWins}</span>
                        <span className="px-2 py-1 rounded-md bg-white/15 border border-white/10">Podiums {d.podiums}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Table */}
      <section className="container mx-auto px-4 mb-16">
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-neutral-900/40">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-white/80 border-b border-white/10">
                <th className="px-5 py-4 font-medium">Pos</th>
                <th className="px-5 py-4 font-medium">Driver</th>
                <th className="px-5 py-4 font-medium">Team</th>
                <th className="px-5 py-4 font-medium text-right hidden md:table-cell">Wins</th>
                <th className="px-5 py-4 font-medium text-right hidden lg:table-cell">Sprint Wins</th>
                <th className="px-5 py-4 font-medium text-right hidden md:table-cell">Podiums</th>
                <th className="px-5 py-4 font-medium text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {rest.map((d) => (
                <tr key={d.position} className="border-t border-white/10 hover:bg-white/[0.05]">
                  <td className="px-5 py-4 font-semibold">{d.position}</td>
                  <td className="px-5 py-4">{d.driver}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-block text-xs px-2 py-1 rounded-md bg-gradient-to-r ${teamAccent(d.team)} border border-white/10`}>{d.team}</span>
                  </td>
                  <td className="px-5 py-4 text-right hidden md:table-cell">{d.wins}</td>
                  <td className="px-5 py-4 text-right hidden lg:table-cell">{d.sprintWins}</td>
                  <td className="px-5 py-4 text-right hidden md:table-cell">{d.podiums}</td>
                  <td className="px-5 py-4 text-right font-bold">{d.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
