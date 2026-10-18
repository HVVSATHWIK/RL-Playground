import { Play, Pause, RotateCcw, Target, Zap, Gauge } from 'lucide-react';
import { useFightStore, type FighterPolicy } from '../stores/fightStore';

export function FightControls() {
  const {
    runState,
    play,
    pause,
    reset,
    resetAgents,
    round,
    redWins,
    blueWins,
    draws,
    redPolicy,
    setRedPolicy,
    bluePolicy,
    setBluePolicy,
    speed,
    setSpeed,
    useExpertStart,
    setUseExpertStart,
  } = useFightStore();

  const isRunning = runState === 'running';

  return (
    <div className="flex flex-col gap-3.5 text-slate-800">
      <div className="border-b border-blue-100 pb-2.5">
        <h2 className="text-sm font-bold text-blue-950 uppercase tracking-wide flex items-center gap-2">
          <Zap className="text-blue-600" size={16} />
          Spectator Sparring Console
        </h2>
        <p className="text-[11px] text-slate-500">Autonomous AI vs AI combat simulation</p>
      </div>

      {/* Play / Pause / Reset Action Row */}
      <div className="flex gap-2">
        {isRunning ? (
          <button
            onClick={pause}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Pause size={14} /> Pause Bout
          </button>
        ) : (
          <button
            onClick={play}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-500/25 transition-all cursor-pointer"
          >
            <Play size={14} /> Start Sparring!
          </button>
        )}
        <button
          onClick={resetAgents}
          className="px-3 py-2.5 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
          title="Reset neural network & Q-table memory"
        >
          <Target size={14} />
        </button>
        <button
          onClick={reset}
          className="px-3 py-2.5 bg-white hover:bg-slate-50 text-slate-600 border border-blue-200 rounded-xl text-xs shadow-2xs transition-colors cursor-pointer"
          title="Reset match & scores"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Speed Selector */}
      <div className="bg-white border border-blue-100 rounded-xl p-3 space-y-2 shadow-2xs">
        <label className="text-xs font-bold text-blue-950 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Gauge size={13} className="text-blue-600" /> Simulation Speed
          </span>
          <span className="text-[11px] font-mono text-blue-700 font-bold">{speed}x</span>
        </label>
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { val: 1, label: '1x Real' },
            { val: 2, label: '2x Fast' },
            { val: 5, label: '5x Sim' },
            { val: 20, label: '20x Turbo' },
          ].map((s) => (
            <button
              key={s.val}
              onClick={() => setSpeed(s.val)}
              className={`py-1.5 px-2 rounded-lg border text-center text-[10px] font-bold font-mono transition-all cursor-pointer ${
                speed === s.val
                  ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white hover:border-blue-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Red Robot Policy Selection */}
      <div className="bg-white border border-blue-100 rounded-xl p-3 space-y-2 shadow-2xs">
        <label className="text-xs font-bold text-red-700 flex items-center justify-between">
          <span>Red Fighter (P1) Algorithm:</span>
          <span className="text-[10px] font-mono uppercase bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-200 font-bold">
            {redPolicy}
          </span>
        </label>
        <div className="grid grid-cols-3 gap-1.5 text-center">
          {[
            { id: 'dqn' as FighterPolicy, label: 'DQN', sub: 'Deep Q-Net' },
            { id: 'tabular' as FighterPolicy, label: 'Tabular', sub: 'Q-Table' },
            { id: 'expert' as FighterPolicy, label: 'Expert', sub: 'Heuristic' },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setRedPolicy(p.id)}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                redPolicy === p.id
                  ? 'bg-red-50 border-red-400 text-red-900 font-bold ring-1 ring-red-400/30'
                  : 'bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-white'
              }`}
            >
              <div className="text-[11px]">{p.label}</div>
              <div className="text-[9px] opacity-75">{p.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Blue Robot Policy Selection */}
      <div className="bg-white border border-blue-100 rounded-xl p-3 space-y-2 shadow-2xs">
        <label className="text-xs font-bold text-blue-700 flex items-center justify-between">
          <span>Blue Fighter (P2) Algorithm:</span>
          <span className="text-[10px] font-mono uppercase bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 font-bold">
            {bluePolicy}
          </span>
        </label>
        <div className="grid grid-cols-3 gap-1.5 text-center">
          {[
            { id: 'dqn' as FighterPolicy, label: 'DQN', sub: 'Deep Q-Net' },
            { id: 'tabular' as FighterPolicy, label: 'Tabular', sub: 'Q-Table' },
            { id: 'expert' as FighterPolicy, label: 'Expert', sub: 'Heuristic' },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setBluePolicy(p.id)}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                bluePolicy === p.id
                  ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold ring-1 ring-blue-400/30'
                  : 'bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-white'
              }`}
            >
              <div className="text-[11px]">{p.label}</div>
              <div className="text-[9px] opacity-75">{p.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Scoreboard */}
      <div className="bg-white border border-blue-100 rounded-xl p-3 shadow-2xs">
        <div className="flex justify-between items-center text-[11px] text-slate-500 mb-2 border-b border-blue-50 pb-1.5">
          <span className="font-semibold text-blue-900">Spectator Match Record</span>
          <span className="font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">
            Round {round}
          </span>
        </div>
        <div className="grid grid-cols-3 text-center items-center">
          <div className="p-1 rounded-lg bg-red-50/60 border border-red-100">
            <div className="text-xl font-black font-mono text-red-600">{redWins}</div>
            <div className="text-[10px] text-red-600 font-bold uppercase">{redPolicy}</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-lg font-bold font-mono text-slate-400">{draws}</div>
            <div className="text-[9px] text-slate-400 font-semibold uppercase">DRAWS</div>
          </div>
          <div className="p-1 rounded-lg bg-blue-50/60 border border-blue-100">
            <div className="text-xl font-black font-mono text-blue-600">{blueWins}</div>
            <div className="text-[10px] text-blue-600 font-bold uppercase">{bluePolicy}</div>
          </div>
        </div>
      </div>

      {/* Expert Sparring Knowledge Toggle */}
      <label className="flex items-center gap-2 text-xs text-slate-600 font-medium cursor-pointer p-1">
        <input
          type="checkbox"
          checked={useExpertStart}
          onChange={(e) => setUseExpertStart(e.target.checked)}
          className="accent-blue-600 cursor-pointer"
        />
        <span>Seed replay buffer with expert demonstrations</span>
      </label>
    </div>
  );
}
