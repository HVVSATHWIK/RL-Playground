import { useState } from 'react';
import { Trophy, Play, BarChart3, CheckCircle2 } from 'lucide-react';
import { useFightStore } from '../stores/fightStore';

export function BenchmarkEval() {
  const { runBenchmark, evalResults } = useFightStore();
  const [rounds, setRounds] = useState<number>(50);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);

  const handleStartEval = () => {
    setIsEvaluating(true);
    setTimeout(() => {
      runBenchmark(rounds);
      setIsEvaluating(false);
    }, 50);
  };

  const redRate =
    evalResults && evalResults.totalRounds > 0
      ? Math.round((evalResults.redWins / evalResults.totalRounds) * 100)
      : 0;

  const blueRate =
    evalResults && evalResults.totalRounds > 0
      ? Math.round((evalResults.blueWins / evalResults.totalRounds) * 100)
      : 0;

  const drawRate =
    evalResults && evalResults.totalRounds > 0
      ? Math.round((evalResults.draws / evalResults.totalRounds) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-3.5 text-slate-800">
      {/* Header */}
      <div className="border-b border-blue-100 pb-2.5">
        <h2 className="text-sm font-bold text-blue-950 tracking-wide uppercase flex items-center gap-2">
          <Trophy className="text-blue-600" size={17} />
          Agent Showdown Benchmark
        </h2>
        <p className="text-[11px] text-slate-500">Evaluate Deep Q-Network vs Tabular Q and Heuristic bots</p>
      </div>

      {/* Benchmark Setup */}
      <div className="bg-white border border-blue-100 rounded-xl p-3 space-y-3 shadow-2xs">
        <div className="flex justify-between items-center text-xs">
          <span className="font-bold text-blue-950">Test Matches:</span>
          <div className="flex gap-1.5 font-mono text-xs">
            {[20, 50, 100].map((r) => (
              <button
                key={r}
                onClick={() => setRounds(r)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  rounds === r
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-blue-50 border border-slate-200'
                }`}
              >
                {r} bouts
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleStartEval}
          disabled={isEvaluating}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-500/25 transition-all"
        >
          <Play size={14} />
          {isEvaluating ? 'Simulating Matches...' : `Run ${rounds}-Round Tournament (DQN vs Tabular)`}
        </button>
      </div>

      {/* Results View */}
      {evalResults && (
        <div className="bg-white border border-blue-100 rounded-xl p-3.5 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-blue-950 border-b border-blue-50 pb-2">
            <span className="flex items-center gap-1.5">
              <BarChart3 size={15} className="text-blue-600" />
              Tournament Outcome ({evalResults.totalRounds} Rounds)
            </span>
            <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
              <CheckCircle2 size={11} /> Complete
            </span>
          </div>

          {/* Win Bars */}
          <div className="space-y-2.5">
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="font-bold text-red-600">Deep Q-Network (Red)</span>
                <span className="font-mono font-semibold text-slate-700">
                  {evalResults.redWins} wins ({redRate}%)
                </span>
              </div>
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div
                  style={{ width: `${redRate}%` }}
                  className="h-full bg-red-500 transition-all duration-500"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="font-bold text-blue-600">Tabular Q-Learning (Blue)</span>
                <span className="font-mono font-semibold text-slate-700">
                  {evalResults.blueWins} wins ({blueRate}%)
                </span>
              </div>
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div
                  style={{ width: `${blueRate}%` }}
                  className="h-full bg-blue-600 transition-all duration-500"
                />
              </div>
            </div>

            {drawRate > 0 && (
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="font-semibold text-slate-500">Draws</span>
                  <span className="font-mono font-semibold text-slate-700">
                    {evalResults.draws} ({drawRate}%)
                  </span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div
                    style={{ width: `${drawRate}%` }}
                    className="h-full bg-amber-400 transition-all duration-500"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-blue-50 grid grid-cols-2 gap-2 text-center">
            <div className="bg-red-50/60 p-2 rounded-lg border border-red-100">
              <div className="text-[10px] text-red-600 font-semibold uppercase">Avg Red HP</div>
              <div className="text-base font-black font-mono text-red-700 mt-0.5">
                {evalResults.avgRedHpRemaining} HP
              </div>
            </div>
            <div className="bg-blue-50/60 p-2 rounded-lg border border-blue-100">
              <div className="text-[10px] text-blue-600 font-semibold uppercase">Avg Blue HP</div>
              <div className="text-base font-black font-mono text-blue-700 mt-0.5">
                {evalResults.avgBlueHpRemaining} HP
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
