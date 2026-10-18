import { useState } from 'react';
import {
  Brain,
  Table,
  Cpu,
  User,
  Zap,
  Activity,
  CheckCircle2,
  ChevronRight,
  Shield,
  Crosshair,
  Swords,
  Sliders,
} from 'lucide-react';
import { useFightStore, type FighterPolicy } from '../stores/fightStore';
import { ACTIONS } from '../lib/fighter';

export function AlgorithmWorkings() {
  const [selectedAlgo, setSelectedAlgo] = useState<FighterPolicy>('dqn');
  const {
    redPolicy,
    setRedPolicy,
    bluePolicy,
    setBluePolicy,
    lastRedAction,
    lastBlueAction,
    lastRedQValues,
    lastBlueQValues,
    red,
    blue,
    dqnAgent,
  } = useFightStore();

  const algos = [
    {
      id: 'dqn' as FighterPolicy,
      name: 'Deep Q-Network (DQN)',
      short: 'Neural Q-Learning',
      category: 'Deep Reinforcement Learning',
      icon: Brain,
      summary:
        'Approximates continuous state-action value functions via deep neural networks, stabilizing training through an experience replay buffer and Polyak target-network updates.',
      math: 'Q(s, a; θ) ← r + γ max_a\' Q(s\', a\'; θ⁻)   |   Loss: L(θ) = E[(y - Q(s, a; θ))²]',
      architecture:
        'Input(16 continuous features) → Dense(32, ReLU) → Dense(24, ReLU) → Output(6 Linear Q-values) [1,518 Parameters]',
      inputSpec:
        '16-dimensional normalized vector: Self X/Z, Opponent X/Z, Relative ΔX, 3D Euclidean distance, HP ratios, Cooldown frames, Facing, Animation threat flags.',
      exploration:
        `ε-Greedy exploration (Current ε = ${(dqnAgent.epsilon || 0.05).toFixed(2)}, decaying from 0.80 down to 0.05).`,
      targetSync: 'Polyak averaging with soft target interpolation factor τ = 0.15.',
      combatProfile:
        'Learns non-linear spatial combos. Anticipates incoming strikes by boosting block/dodge and spaces at ideal range.',
      strengths:
        'Generalizes seamlessly across continuous 3D distances; learns emergent counter-punches and spacing tactics.',
      weaknesses:
        'Requires replay buffer memory and gradient backpropagation; sample efficiency depends on reward shaping.',
    },
    {
      id: 'tabular' as FighterPolicy,
      name: 'Tabular Q-Learning',
      short: 'Discrete Q-Table',
      category: 'Model-Free Temporal Difference',
      icon: Table,
      summary:
        'Classic Bellman temporal difference control storing explicit state-action value estimates across a discretized Markov Decision Process matrix.',
      math: 'Q(s, a) ← Q(s, a) + α [r + γ max_a\' Q(s\', a\') - Q(s, a)]',
      architecture:
        '1,600 Discrete States × 6 Actions = 9,600 Float32 Lookup Elements in system memory.',
      inputSpec:
        '1,600 discretized buckets: 10 arena position zones × 4 HP tiers × 5 distance brackets × 4 opponent animation threat states × 2 readiness flags.',
      exploration: 'ε-Greedy action selection over valid combat actions.',
      targetSync: 'Instantaneous dynamic programming lookup; no separate target network required.',
      combatProfile:
        'Deterministic and direct. Executes memorized responses for specific distance and threat states.',
      strengths:
        'Zero neural training overhead; guaranteed asymptotic convergence in finite discrete environments.',
      weaknesses:
        'Suffers from the curse of dimensionality; cannot generalize to unvisited continuous distances without dense discretization.',
    },
    {
      id: 'expert' as FighterPolicy,
      name: 'Expert Heuristic Tree',
      short: 'Rule-Based Expert',
      category: 'Hierarchical Expert System',
      icon: Cpu,
      summary:
        'Hand-engineered martial arts tactical decision tree evaluating frame data, attack reach, opponent whiff recovery, and guard breaking.',
      math: 'Priority Tree: Active Threat Detection → Whiff Punish → Guard Breaking → Combo Cadence Spacing',
      architecture:
        'Hierarchical state evaluation engine computing threat distance, recovery frames, and defensive angles.',
      inputSpec:
        'Frame-accurate real-time physics telemetry: 3D Euclidean distance, active attack windows, and opponent recovery frames.',
      exploration: 'None (Deterministic decision tree with dynamic combat footsie cadence).',
      targetSync: 'Zero parameter updates; static expert domain logic.',
      combatProfile:
        'Disciplined and reactive. Blocks incoming strikes, feints at mid-range, resets after 2-strike combos, and punishes whiffs.',
      strengths:
        'Zero training required; baseline benchmark for evaluating RL policy competence; perfect spacing discipline.',
      weaknesses:
        'Fixed behavioral rules that do not learn or adapt to novel player exploit strategies.',
    },
    {
      id: 'human' as FighterPolicy,
      name: 'Human Keyboard Policy',
      short: 'Player Input',
      category: 'Human-in-the-Loop',
      icon: User,
      summary:
        'Direct human neuromuscular control via asynchronous browser keyboard event listeners and low-latency frame trigger buffers.',
      math: 'Event Capture → Intent FIFO Buffer → Single-Frame Action Dispatch',
      architecture: 'Capture-phase keyboard event controller with single-frame trigger buffers.',
      inputSpec:
        'Asynchronous keyboard inputs: [A/D] movement, [J/Space] punch, [K/E] kick, [Shift] block, [Alt/Q] dodge.',
      exploration: 'Human intuition, feints, baiting, and psychological adaptation.',
      targetSync: 'Human cognitive learning and motor-reflex optimization.',
      combatProfile:
        'Expressive and unpredictable. Mixes sudden evasive rolls with aggressive strike bursts and spacing traps.',
      strengths:
        'Capable of creative baiting, complex timing mix-ups, and adaptive mind-games.',
      weaknesses:
        'Constrained by human reaction time (150–250ms) and keyboard dexterity.',
    },
  ];

  const current = algos.find((a) => a.id === selectedAlgo) || algos[0];
  const CurrentIcon = current.icon;

  const dist = Math.round(Math.sqrt((blue.x - red.x) ** 2 + (blue.z - red.z) ** 2));

  // Compute normalized Q-bars
  const maxRedQ = Math.max(...lastRedQValues.map(Math.abs), 0.1);
  const maxBlueQ = Math.max(...lastBlueQValues.map(Math.abs), 0.1);

  return (
    <div className="bg-white border border-blue-100 rounded-2xl p-4 shadow-xs flex flex-col gap-4 text-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-blue-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <Zap size={16} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-blue-950 uppercase tracking-wide">
              Algorithm Intelligence Inspector
            </h3>
            <p className="text-[11px] text-slate-500">
              Live neural Q-values, observation breakdown, and mathematical architecture
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">
            Spacing: {dist}px
          </span>
        </div>
      </div>

      {/* Real-Time Live Dual-Fighter Decision Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50/70 border border-blue-100">
        {/* Red Fighter Telemetry */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />
              <span className="font-extrabold text-red-700 uppercase">Red Fighter (P1)</span>
              <span className="text-[10px] font-mono text-slate-500">[{redPolicy}]</span>
            </div>
            <span className="text-[10px] font-mono font-bold text-red-600 uppercase bg-red-50 px-2 py-0.5 rounded border border-red-200">
              Action: {lastRedAction}
            </span>
          </div>

          <div className="space-y-1">
            {ACTIONS.map((act, i) => {
              const val = lastRedQValues[i] || 0;
              const isSelected = act === lastRedAction;
              const widthPct = Math.min(100, Math.max(8, (Math.abs(val) / maxRedQ) * 100));

              return (
                <div key={act} className="flex items-center gap-2 text-[10px] font-mono">
                  <span className={`w-18 truncate uppercase ${isSelected ? 'font-bold text-red-700' : 'text-slate-500'}`}>
                    {act}
                  </span>
                  <div className="flex-1 h-3.5 bg-slate-200/80 rounded-md overflow-hidden relative">
                    <div
                      style={{ width: `${widthPct}%` }}
                      className={`h-full transition-all duration-100 rounded-md ${
                        isSelected
                          ? 'bg-red-600 shadow-xs'
                          : val >= 0
                          ? 'bg-red-400/80'
                          : 'bg-slate-400'
                      }`}
                    />
                  </div>
                  <span className="w-10 text-right tabular-nums font-semibold text-slate-600">
                    {val.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Blue Fighter Telemetry */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
              <span className="font-extrabold text-blue-700 uppercase">Blue Fighter (P2)</span>
              <span className="text-[10px] font-mono text-slate-500">[{bluePolicy}]</span>
            </div>
            <span className="text-[10px] font-mono font-bold text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              Action: {lastBlueAction}
            </span>
          </div>

          <div className="space-y-1">
            {ACTIONS.map((act, i) => {
              const val = lastBlueQValues[i] || 0;
              const isSelected = act === lastBlueAction;
              const widthPct = Math.min(100, Math.max(8, (Math.abs(val) / maxBlueQ) * 100));

              return (
                <div key={act} className="flex items-center gap-2 text-[10px] font-mono">
                  <span className={`w-18 truncate uppercase ${isSelected ? 'font-bold text-blue-700' : 'text-slate-500'}`}>
                    {act}
                  </span>
                  <div className="flex-1 h-3.5 bg-slate-200/80 rounded-md overflow-hidden relative">
                    <div
                      style={{ width: `${widthPct}%` }}
                      className={`h-full transition-all duration-100 rounded-md ${
                        isSelected
                          ? 'bg-blue-600 shadow-xs'
                          : val >= 0
                          ? 'bg-blue-400/80'
                          : 'bg-slate-400'
                      }`}
                    />
                  </div>
                  <span className="w-10 text-right tabular-nums font-semibold text-slate-600">
                    {val.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick Sparring Matchup Presets */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-bold text-blue-950 flex items-center gap-1">
          <Swords size={12} className="text-blue-600" /> Sparring Policy Matchups:
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {[
            { label: 'DQN vs Tabular', red: 'dqn', blue: 'tabular' },
            { label: 'DQN vs Expert', red: 'dqn', blue: 'expert' },
            { label: 'Expert vs Tabular', red: 'expert', blue: 'tabular' },
            { label: 'DQN vs DQN', red: 'dqn', blue: 'dqn' },
          ].map((m) => (
            <button
              key={m.label}
              onClick={() => {
                setRedPolicy(m.red as FighterPolicy);
                setBluePolicy(m.blue as FighterPolicy);
              }}
              className="py-1.5 px-2 rounded-lg bg-white border border-blue-200 hover:bg-blue-50 text-[10px] font-bold text-blue-900 transition-all cursor-pointer text-center"
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Algorithm Deep-Dive Selector Tabs */}
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold text-blue-950 flex items-center gap-1">
          <Sliders size={12} className="text-blue-600" /> Deep-Dive Mathematical Inspection:
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {algos.map((algo) => {
            const Icon = algo.icon;
            const active = selectedAlgo === algo.id;
            return (
              <button
                key={algo.id}
                onClick={() => setSelectedAlgo(algo.id)}
                className={`flex items-center gap-2 p-2 rounded-xl text-left border transition-all cursor-pointer ${
                  active
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-500/25 font-bold'
                    : 'bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-white hover:border-blue-200'
                }`}
              >
                <Icon size={14} className={active ? 'text-white' : 'text-blue-600'} />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] truncate leading-tight">{algo.name.split(' ')[0]}</div>
                  <div className={`text-[9px] truncate ${active ? 'text-blue-100' : 'text-slate-400'}`}>
                    {algo.short}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Algorithm Comprehensive Specification Card */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CurrentIcon className="text-blue-600" size={20} />
            <div>
              <span className="text-xs font-extrabold text-blue-950">{current.name}</span>
              <span className="ml-2 text-[9px] font-mono uppercase bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md font-bold">
                {current.category}
              </span>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-600 leading-relaxed">{current.summary}</p>

        {/* Technical Specification Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-[10px]">
          {/* Bellman / Update Equation */}
          <div className="p-3 rounded-lg bg-white border border-blue-100/80 shadow-2xs">
            <span className="font-bold text-blue-950 block mb-1 flex items-center gap-1.5">
              <Activity size={12} className="text-blue-600" /> Update / Value Equation
            </span>
            <code className="text-[9.5px] font-mono text-blue-800 block bg-blue-50 p-1.5 rounded font-semibold break-all leading-relaxed">
              {current.math}
            </code>
          </div>

          {/* Internal Structure & Parameter Math */}
          <div className="p-3 rounded-lg bg-white border border-blue-100/80 shadow-2xs">
            <span className="font-bold text-blue-950 block mb-1 flex items-center gap-1.5">
              <Cpu size={12} className="text-blue-600" /> Internal Architecture & Parameters
            </span>
            <p className="text-slate-600 leading-snug font-mono text-[9.5px]">{current.architecture}</p>
          </div>

          {/* Observation Representation */}
          <div className="p-3 rounded-lg bg-white border border-blue-100/80 shadow-2xs">
            <span className="font-bold text-blue-950 block mb-1 flex items-center gap-1.5">
              <Crosshair size={12} className="text-blue-600" /> State Representation (Input Features)
            </span>
            <p className="text-slate-600 leading-snug">{current.inputSpec}</p>
          </div>

          {/* Combat Playstyle Profile */}
          <div className="p-3 rounded-lg bg-white border border-blue-100/80 shadow-2xs">
            <span className="font-bold text-blue-950 block mb-1 flex items-center gap-1.5">
              <Shield size={12} className="text-blue-600" /> Ring Strategy & Combat Rhythm
            </span>
            <p className="text-slate-600 leading-snug">{current.combatProfile}</p>
          </div>
        </div>

        {/* Strengths & Academic Trade-offs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] pt-1">
          <div className="flex items-start gap-1.5 text-emerald-800 bg-white p-2.5 rounded-lg border border-emerald-100">
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong className="text-emerald-950">Key Advantage:</strong> {current.strengths}
            </span>
          </div>
          <div className="flex items-start gap-1.5 text-amber-900 bg-white p-2.5 rounded-lg border border-amber-100">
            <ChevronRight size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong className="text-amber-950">Trade-off / Limit:</strong> {current.weaknesses}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
