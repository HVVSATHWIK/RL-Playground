import { useState, useEffect } from 'react';
import { Swords, Play, Pause, RotateCcw, ShieldAlert, UserCheck, User, Zap } from 'lucide-react';
import { useFightStore, type FighterPolicy } from '../stores/fightStore';
import { globalKeyboardController, type KeyState } from '../lib/keyboardController';

export function HumanFightPanel() {
  const {
    runState,
    play,
    pause,
    reset,
    bluePolicy,
    setBluePolicy,
    redWins,
    blueWins,
    draws,
    round,
    red,
    blue,
  } = useFightStore();

  const [keys, setKeys] = useState<KeyState>({
    moveLeft: false,
    moveRight: false,
    punch: false,
    kick: false,
    block: false,
    dodge: false,
  });

  // Poll keys at 30Hz for responsive visual HUD feedback
  useEffect(() => {
    const timer = setInterval(() => {
      setKeys(globalKeyboardController.getKeyState());
    }, 33);
    return () => clearInterval(timer);
  }, []);

  const isRunning = runState === 'running';

  return (
    <div className="flex flex-col gap-3.5 text-slate-800">
      {/* Header */}
      <div className="border-b border-blue-100 pb-2.5 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-blue-950 tracking-wide uppercase flex items-center gap-2">
            <Swords className="text-blue-600" size={17} />
            The Dojo: Human vs AI
          </h2>
          <p className="text-[11px] text-slate-500">Control Fighter 1 (Red) with your keyboard</p>
        </div>
        <span className="text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
          P1 READY
        </span>
      </div>

      {/* Bout Controls */}
      <div className="flex gap-2">
        {isRunning ? (
          <button
            onClick={pause}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-sm shadow-amber-500/20 transition-all"
          >
            <Pause size={14} /> Pause Bout
          </button>
        ) : (
          <button
            onClick={play}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-500/25 transition-all"
          >
            <Play size={14} /> Start Bout!
          </button>
        )}
        <button
          onClick={reset}
          className="px-3 py-2.5 bg-white hover:bg-slate-50 text-slate-600 rounded-xl text-xs border border-blue-200 shadow-2xs transition-colors flex items-center justify-center"
          title="Reset match"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Match Scoreboard - White & Blue card */}
      <div className="bg-white border border-blue-100 rounded-xl p-3 shadow-2xs">
        <div className="flex justify-between items-center text-[11px] text-slate-500 mb-2 border-b border-blue-50 pb-1.5">
          <span className="font-semibold text-blue-900">Scoreboard</span>
          <span className="font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">
            Round {round}
          </span>
        </div>
        <div className="grid grid-cols-3 text-center items-center">
          <div className="p-1 rounded-lg bg-red-50/60 border border-red-100">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-red-600">
              <User size={12} /> YOU (Red)
            </div>
            <div className="text-2xl font-black font-mono text-red-600 my-0.5">{redWins}</div>
            <div className="text-[10px] text-slate-500 font-mono font-medium">{red.hp} HP</div>
          </div>
          <div className="flex flex-col justify-center items-center">
            <span className="text-xs text-blue-900 font-extrabold">VS</span>
            <span className="text-[10px] text-slate-400 font-mono">{draws} Draws</span>
          </div>
          <div className="p-1 rounded-lg bg-blue-50/60 border border-blue-100">
            <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-blue-600">
              <UserCheck size={12} /> AI (Blue)
            </div>
            <div className="text-2xl font-black font-mono text-blue-600 my-0.5">{blueWins}</div>
            <div className="text-[10px] text-slate-500 font-mono font-medium">{blue.hp} HP</div>
          </div>
        </div>
      </div>

      {/* Opponent Policy Selection */}
      <div className="bg-white border border-blue-100 rounded-xl p-3 space-y-2 shadow-2xs">
        <label className="text-xs font-bold text-blue-950 flex items-center justify-between">
          <span>Choose Opponent Policy:</span>
          <span className="text-[10px] text-blue-600 uppercase font-mono font-semibold">Fighter 2 (Blue)</span>
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: 'dqn' as FighterPolicy, label: 'Trained DQN', sub: 'Deep Q-Net', color: 'border-blue-500 bg-blue-50 text-blue-900 shadow-xs' },
            { id: 'expert' as FighterPolicy, label: 'Expert Engine', sub: 'Heuristics', color: 'border-indigo-500 bg-indigo-50 text-indigo-900 shadow-xs' },
            { id: 'tabular' as FighterPolicy, label: 'Tabular Q', sub: 'Q-Table', color: 'border-sky-500 bg-sky-50 text-sky-900 shadow-xs' },
          ].map((op) => (
            <button
              key={op.id}
              onClick={() => setBluePolicy(op.id)}
              className={`p-2 rounded-lg border text-center transition-all ${
                bluePolicy === op.id
                  ? `${op.color} font-bold ring-1 ring-blue-400/30`
                  : 'border-slate-200 bg-slate-50/50 text-slate-600 hover:border-blue-200 hover:bg-white'
              }`}
            >
              <div className="text-[11px]">{op.label}</div>
              <div className="text-[9px] opacity-75">{op.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Live Keypress HUD */}
      <div className="bg-white border border-blue-100 rounded-xl p-3 space-y-2.5 shadow-2xs">
        <div className="flex items-center justify-between text-xs font-bold text-blue-950 border-b border-blue-50 pb-1.5">
          <span className="flex items-center gap-1.5">
            <Zap size={13} className="text-blue-600" />
            Live Keyboard Input HUD
          </span>
          <span className="text-[10px] text-blue-600 font-mono font-medium">Capture Active</span>
        </div>

        {/* Action Keys Visualizer */}
        <div className="flex flex-col gap-2">
          {/* Movement */}
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Horizontal Movement (A / D or ← / →)</span>
            <div className="grid grid-cols-2 gap-1.5">
              <div
                className={`py-1.5 px-2 rounded-lg text-center border font-mono text-xs transition-all ${
                  keys.moveLeft
                    ? 'bg-blue-600 border-blue-600 text-white font-bold shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                [A / ←] Move Left
              </div>
              <div
                className={`py-1.5 px-2 rounded-lg text-center border font-mono text-xs transition-all ${
                  keys.moveRight
                    ? 'bg-blue-600 border-blue-600 text-white font-bold shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                [D / →] Move Right
              </div>
            </div>
          </div>

          {/* Defense & Evasion */}
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Tactical Defense</span>
            <div className="flex gap-1.5">
              <div
                className={`flex-1 py-1.5 px-2 rounded-lg text-center border font-mono text-xs transition-all ${
                  keys.block
                    ? 'bg-emerald-600 border-emerald-600 text-white font-bold shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                [Shift] Block
              </div>
              <div
                className={`flex-1 py-1.5 px-2 rounded-lg text-center border font-mono text-xs transition-all ${
                  keys.dodge
                    ? 'bg-indigo-600 border-indigo-600 text-white font-bold shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                [Alt / Q] Dodge
              </div>
            </div>
          </div>

          {/* Combat Strikes */}
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Combat Attacks</span>
            <div className="grid grid-cols-2 gap-1.5">
              <div
                className={`py-1.5 px-2 rounded-lg text-center border font-mono text-xs transition-all ${
                  keys.punch
                    ? 'bg-amber-500 border-amber-500 text-white font-bold shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                [J / Space] Punch
              </div>
              <div
                className={`py-1.5 px-2 rounded-lg text-center border font-mono text-xs transition-all ${
                  keys.kick
                    ? 'bg-purple-600 border-purple-600 text-white font-bold shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                [K / E] Kick
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Combat Tactics Tip */}
      <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-2.5 text-[11px] text-blue-900 flex items-start gap-2 shadow-2xs">
        <ShieldAlert size={15} className="text-blue-600 shrink-0 mt-0.5" />
        <p>
          <strong className="text-blue-950 font-semibold">Tactics:</strong> Blocking absorbs 80% damage. Punches recover in 8 frames, kicks in 14 frames. Exploit the AI's cooldown window immediately after it swings and misses!
        </p>
      </div>
    </div>
  );
}
