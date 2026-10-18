import { Play, Pause, RotateCcw, Flame, Shield, Compass, PenTool, Sliders, Activity } from 'lucide-react';
import { useFightStore } from '../stores/fightStore';

export function TrainingStudio() {
  const {
    runState,
    play,
    pause,
    reset,
    speed,
    setSpeed,
    rewardWeights,
    setRewardWeights,
    dqnConfig,
    setDQNConfig,
    dqnAgent,
    dqnRecentWins,
    warmStartDQN,
    setEpsilon,
  } = useFightStore();

  const isRunning = runState === 'running';

  const avgRewardLast20 =
    dqnAgent.recentRewards.length > 0
      ? (dqnAgent.recentRewards.reduce((a, b) => a + b, 0) / dqnAgent.recentRewards.length).toFixed(1)
      : '0.0';

  const winRate =
    dqnRecentWins.length > 0
      ? Math.round((dqnRecentWins.filter(Boolean).length / dqnRecentWins.length) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-3.5 text-slate-800">
      {/* Studio Header */}
      <div className="flex items-center justify-between border-b border-blue-100 pb-2.5">
        <div>
          <h2 className="text-sm font-bold text-blue-950 tracking-wide uppercase flex items-center gap-2">
            <Activity className="text-blue-600" size={17} />
            DQN Training Studio
          </h2>
          <p className="text-[11px] text-slate-500">Deep Q-Network with Replay Buffer & Target Network</p>
        </div>
        <div className="text-right">
          <span className="text-[11px] font-bold font-mono px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            Ep: {dqnAgent.episodesTrained}
          </span>
        </div>
      </div>

      {/* Main Execution Controls */}
      <div className="flex gap-2">
        {isRunning ? (
          <button
            onClick={pause}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-sm shadow-amber-500/20 transition-all"
          >
            <Pause size={14} /> Pause Training
          </button>
        ) : (
          <button
            onClick={play}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-500/25 transition-all"
          >
            <Play size={14} /> Train DQN
          </button>
        )}
        <button
          onClick={warmStartDQN}
          className="px-3 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold border border-blue-200 transition-colors flex items-center gap-1.5"
          title="Warm-start replay buffer with balanced expert sparring"
        >
          <PenTool size={14} />
          Pre-Train
        </button>
        <button
          onClick={reset}
          className="px-3 py-2.5 bg-white hover:bg-slate-50 text-slate-600 rounded-xl text-xs border border-blue-200 shadow-2xs transition-colors flex items-center justify-center"
          title="Reset training environment"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Performance Quick Gauges */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-white border border-blue-100 rounded-xl p-2.5 shadow-2xs">
          <div className="text-[10px] text-slate-500 uppercase font-semibold">Win Rate</div>
          <div className="text-lg font-black font-mono text-emerald-600 mt-0.5">{winRate}%</div>
        </div>
        <div className="bg-white border border-blue-100 rounded-xl p-2.5 shadow-2xs">
          <div className="text-[10px] text-slate-500 uppercase font-semibold">Avg Reward</div>
          <div className="text-lg font-black font-mono text-blue-600 mt-0.5">{avgRewardLast20}</div>
        </div>
        <div className="bg-white border border-blue-100 rounded-xl p-2.5 shadow-2xs">
          <div className="text-[10px] text-slate-500 uppercase font-semibold">Replay Buffer</div>
          <div className="text-lg font-black font-mono text-slate-700 mt-0.5">
            {dqnAgent.replayBuffer.size()}
          </div>
        </div>
      </div>

      {/* Speed Selector */}
      <div className="bg-white border border-blue-100 rounded-xl p-3 space-y-2 shadow-2xs">
        <div className="flex justify-between items-center text-xs text-slate-600 font-semibold">
          <span>Simulation Speed:</span>
          <span className="font-mono text-blue-600 font-bold">{speed}x steps/frame</span>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {[1, 5, 20, 50, 100].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`py-1.5 rounded-lg text-xs font-mono transition-all ${
                speed === s
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-blue-50 border border-slate-200'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Reward Shaping Sliders */}
      <div className="bg-white border border-blue-100 rounded-xl p-3 space-y-2.5 shadow-2xs">
        <div className="flex items-center gap-1.5 text-xs font-bold text-blue-950 border-b border-blue-50 pb-1.5">
          <Sliders size={14} className="text-blue-600" />
          <span>Reward Shaping Weights</span>
        </div>

        <div>
          <div className="flex justify-between text-[11px] mb-1">
            <span className="flex items-center gap-1 text-red-600 font-semibold">
              <Flame size={12} /> Aggression (Hit rewards)
            </span>
            <span className="font-mono font-bold text-slate-700">{rewardWeights.aggression.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.2"
            max="3.0"
            step="0.1"
            value={rewardWeights.aggression}
            onChange={(e) => setRewardWeights({ aggression: parseFloat(e.target.value) })}
            className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between text-[11px] mb-1">
            <span className="flex items-center gap-1 text-emerald-600 font-semibold">
              <Shield size={12} /> Defense (Block rewards)
            </span>
            <span className="font-mono font-bold text-slate-700">{rewardWeights.defense.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.2"
            max="3.0"
            step="0.1"
            value={rewardWeights.defense}
            onChange={(e) => setRewardWeights({ defense: parseFloat(e.target.value) })}
            className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between text-[11px] mb-1">
            <span className="flex items-center gap-1 text-blue-600 font-semibold">
              <Compass size={12} /> Spacing (Gap close)
            </span>
            <span className="font-mono font-bold text-slate-700">{rewardWeights.spacing.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.2"
            max="3.0"
            step="0.1"
            value={rewardWeights.spacing}
            onChange={(e) => setRewardWeights({ spacing: parseFloat(e.target.value) })}
            className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
          />
        </div>
      </div>

      {/* DQN Hyperparameters */}
      <div className="bg-white border border-blue-100 rounded-xl p-3 space-y-2.5 shadow-2xs">
        <div className="flex items-center justify-between text-xs font-bold text-blue-950 border-b border-blue-50 pb-1.5">
          <span>Hyperparameters</span>
          <span className="text-[10px] font-mono text-blue-600 font-medium">ε: {dqnAgent.epsilon.toFixed(2)}</span>
        </div>

        <div>
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-slate-600 font-medium">Learning Rate (α)</span>
            <span className="font-mono font-bold text-slate-700">{dqnConfig.learningRate}</span>
          </div>
          <input
            type="range"
            min="0.001"
            max="0.02"
            step="0.001"
            value={dqnConfig.learningRate}
            onChange={(e) => setDQNConfig({ learningRate: parseFloat(e.target.value) })}
            className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-slate-600 font-medium">Exploration (Epsilon ε)</span>
            <span className="font-mono font-bold text-slate-700">{dqnAgent.epsilon.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.02"
            max="0.9"
            step="0.02"
            value={dqnAgent.epsilon}
            onChange={(e) => setEpsilon(parseFloat(e.target.value))}
            className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
