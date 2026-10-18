import { useEffect, useRef } from 'react';
import { Swords, Activity, Box, Layers } from 'lucide-react';
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
    if (mode === 'dojo') {
      globalKeyboardController.attach();
    }
    return () => {
      globalKeyboardController.detach();
    };
  }, [mode]);

  // Fixed-timestep physics accumulator so 1x Dojo/Spectator bouts run at a crisp martial-arts cadence (~18Hz)
  // while 3D rendering interpolates at 60 FPS, and Turbo Training (20x-100x) runs uncapped multi-steps per frame!
  useEffect(() => {
    let animId: number;
    let lastTick = performance.now();
    let accumulator = 0;
    const BASE_STEP_MS = 52; // ~19 physics steps/sec at 1x real-time speed

    const loop = (now: number) => {
      const dt = Math.min(now - lastTick, 200);
      lastTick = now;

      const state = useFightStore.getState();
      if (state.runState === 'running') {
        const spd = state.speed;
        if (spd <= 2) {
          accumulator += dt * spd;
          let stepsRun = 0;
          while (accumulator >= BASE_STEP_MS && stepsRun < 4) {
            state.step();
            accumulator -= BASE_STEP_MS;
            stepsRun++;
          }
        } else {
          accumulator = 0;
          const batchSteps = Math.min(spd, 100);
          for (let i = 0; i < batchSteps; i++) {
            state.step();
          }
        }
      } else {
        accumulator = 0;
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  const modeTabs: { id: RoboMode; label: string; icon: any; desc: string }[] = [
    { id: 'dojo', label: 'Dojo', desc: 'Human vs AI', icon: Swords },
    { id: 'train', label: 'DQN Studio', desc: 'Neural Training', icon: Activity },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-50 text-slate-800">
      {/* Top Robo-Dojo Navigation Bar */}
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
                  3D Physics & Deep Q-Learning Lab
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Reinforcement Learning Lab
              </p>
            </div>
          </div>
        </div>

        {/* Right Header Controls: Mode Tabs & 3D Toggle */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={toggle3D}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
              view3D
                ? 'bg-blue-50 border-blue-300 text-blue-800 shadow-xs'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Toggle between Hardware-Accelerated 3D Mecha Models and 2D Canvas"
          >
            {view3D ? <Box size={14} className="text-blue-600" /> : <Layers size={14} className="text-slate-500" />}
            <span>{view3D ? '3D Mecha View' : '2D Classic View'}</span>
          </button>

          <div className="flex gap-1.5 bg-blue-50/70 p-1 rounded-xl border border-blue-100">
            {modeTabs.map((tab) => {
              const Icon = tab.icon;
              const active = mode === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setMode(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
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
            <InfoBanner title="Robo-Dojo Physics & Combat Rules" variant="legend" defaultOpen={false}>
              <div className="text-[11px] space-y-1.5 text-slate-600">
                <p>
                  <strong className="text-blue-700">Punches [J / Space]:</strong> 10 Damage, 56px Range, alternating lead jab & rear cross.
                </p>
                <p>
                  <strong className="text-purple-700">Kicks [K / E]:</strong> 15 Damage, 76px Range, kinetic jump kick that shatters low-stamina guards.
                </p>
                <p>
                  <strong className="text-emerald-700">Blocks [Shift]:</strong> Absorbs 80% strike damage using the 3D geodesic shield dome.
                </p>
                <p>
                  <strong className="text-sky-700">3D Dodge [Alt / Q]:</strong> Jet-assisted backstep + Z-axis lateral sidestep with full I-frames.
                </p>
              </div>
            </InfoBanner>
          </div>
        </div>

        {/* Center: Arena & Live Combat Stage */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-100/60">
          <div className="flex-1 min-h-0 p-4 flex items-center justify-center">
            {view3D ? <Arena3DCanvas /> : <ArenaCanvas ref={canvasRef} />}
          </div>

          <div className="h-44 border-t border-blue-100 p-3.5 bg-white shadow-xs">
            <FightStats />
          </div>
        </div>

        {/* Right Pane: Algorithm Intelligence Inspector */}
        {mode === 'showtime' && (
          <div className="w-[480px] xl:w-[520px] border-l border-blue-100 overflow-y-auto p-4 bg-white shrink-0 shadow-xs flex flex-col gap-4">
            <AlgorithmWorkings />
          </div>
        )}
      </div>
    </div>
  );
}
