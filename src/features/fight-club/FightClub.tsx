import { useEffect, useRef } from 'react';
import { Swords, Activity, Trophy, Compass, Box, Layers } from 'lucide-react';
import { useFightStore, type RoboMode } from './stores/fightStore';
import { ArenaCanvas } from './components/ArenaCanvas';
import { Arena3DCanvas } from './components/Arena3DCanvas';
import { HumanFightPanel } from './components/HumanFightPanel';
import { TrainingStudio } from './components/TrainingStudio';
import { BenchmarkEval } from './components/BenchmarkEval';
import { ModelVault } from './components/ModelVault';
import { FightControls } from './components/FightControls';
import { FightStats } from './components/FightStats';
import { InfoBanner } from '../../components/InfoBanner';
import { globalKeyboardController } from './lib/keyboardController';
import { AlgorithmWorkings } from './components/AlgorithmWorkings';

export function FightClub() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { mode, setMode, view3D, toggle3D } = useFightStore();

  useEffect(() => {
    // If in dojo mode, attach keyboard listener
    if (mode === 'dojo') {
      globalKeyboardController.attach();
    }
    return () => {
      globalKeyboardController.detach();
    };
  }, [mode]);

  useEffect(() => {
    let animId: number;
    const loop = () => {
      const state = useFightStore.getState();
      if (state.runState === 'running') {
        const spd = state.speed;
        const batchLimit = Math.min(spd, 8);
        for (let i = 0; i < batchLimit; i++) {
          state.step();
        }
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  const modeTabs: { id: RoboMode; label: string; icon: any; desc: string }[] = [
    { id: 'dojo', label: 'The Dojo', desc: 'Human vs AI', icon: Swords },
    { id: 'train', label: 'DQN Studio', desc: 'Neural Training', icon: Activity },
    { id: 'eval', label: 'Showdown', desc: 'Tournament Eval', icon: Trophy },
    { id: 'showtime', label: 'Spectator', desc: 'Spectator AI', icon: Compass },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-50 text-slate-800">
      {/* Top Robo-Dojo Navigation Bar - Clean White & Blue */}
      <div className="bg-white border-b border-blue-100 px-5 py-2.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/25">
              <Swords size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-blue-950 text-sm tracking-tight">ROBO-DOJO</span>
                <span className="text-[10px] text-blue-700 font-semibold px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200">
                  Deep Q-Learning Lab
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Interactive Reinforcement Learning Fighting Arena with Real Deep Q-Networks
              </p>
            </div>
          </div>
        </div>

        {/* Right Header Controls: Mode Tabs & 3D Toggle */}
        <div className="flex items-center gap-2.5">
          {/* 3D / 2D Rendering Engine Toggle */}
          <button
            onClick={toggle3D}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
              view3D
                ? 'bg-blue-50 border-blue-300 text-blue-800 shadow-xs'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Toggle between Hardware-Accelerated 3D Mecha Models and 2D Canvas"
          >
            {view3D ? <Box size={14} className="text-blue-600" /> : <Layers size={14} className="text-slate-500" />}
            <span>{view3D ? '3D Mecha View' : '2D Classic View'}</span>
          </button>

          {/* Mode Switcher Tabs */}
          <div className="flex gap-1.5 bg-blue-50/70 p-1 rounded-xl border border-blue-100">
            {modeTabs.map((tab) => {
              const Icon = tab.icon;
              const active = mode === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setMode(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                      : 'text-slate-600 hover:text-blue-900 hover:bg-white/80'
                  }`}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Layout Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Active Mode Controls */}
        <div className="w-80 border-r border-blue-100 overflow-y-auto p-4 flex flex-col gap-4 bg-white shrink-0 shadow-xs">
          {mode === 'dojo' && <HumanFightPanel />}
          {mode === 'train' && (
            <>
              <TrainingStudio />
              <ModelVault />
            </>
          )}
          {mode === 'eval' && (
            <>
              <BenchmarkEval />
              <ModelVault />
            </>
          )}
          {mode === 'showtime' && <FightControls />}

          {/* Quick Onboarding / Rule Guide */}
          <div className="mt-auto pt-2 border-t border-blue-100">
            <InfoBanner title="Robo-Dojo Combat Rules" variant="legend" defaultOpen={false}>
              <div className="text-[11px] space-y-1.5 text-slate-600">
                <p>
                  <strong className="text-blue-700">Punches:</strong> 10 Damage, 55px Range, 8-frame cooldown.
                </p>
                <p>
                  <strong className="text-purple-700">Kicks:</strong> 15 Damage, 75px Range, 14-frame cooldown.
                </p>
                <p>
                  <strong className="text-emerald-700">Blocks:</strong> Reduces incoming strike damage by 80%.
                </p>
                <p>
                  <strong className="text-sky-700">Dodges [Alt/Q]:</strong> Backward leap with full invulnerability frames (I-frames) and momentum glide.
                </p>
                <p>
                  <strong className="text-slate-800">Pacing Cadence:</strong> Robots reset neutral and space after combos rather than spamming attacks.
                </p>
              </div>
            </InfoBanner>
          </div>
        </div>

        {/* Center: Arena & Live Combat Stage */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-100/60">
          {/* Combat Ring Canvas (3D Mecha or 2D Classic) */}
          <div className="flex-1 min-h-0 p-4 flex items-center justify-center">
            {view3D ? <Arena3DCanvas /> : <ArenaCanvas ref={canvasRef} />}
          </div>

          {/* Bottom Telemetry & Curves */}
          <div className="h-44 border-t border-blue-100 p-3.5 bg-white shadow-xs">
            <FightStats />
          </div>
        </div>

        {/* Right Pane: Algorithm Intelligence Inspector beside Spectator Arena */}
        {mode === 'showtime' && (
          <div className="w-[480px] xl:w-[520px] border-l border-blue-100 overflow-y-auto p-4 bg-white shrink-0 shadow-xs flex flex-col gap-4">
            <AlgorithmWorkings />
          </div>
        )}
      </div>
    </div>
  );
}
