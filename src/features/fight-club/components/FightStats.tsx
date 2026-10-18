import { useFightStore } from '../stores/fightStore';
import { ACTIONS } from '../lib/fighter';
import { Activity, Gauge } from 'lucide-react';

export function FightStats() {
  const {
    mode,
    roundRewards,
    dqnEpisodeRewards,
    dqnLossHistory,
    lastBlueQValues,
    lastBlueAction,
    lastRedAction,
    red,
    blue,
  } = useFightStore();

  const dist = Math.round(Math.abs(red.x - blue.x));

  if (mode === 'dojo') {
    // Neural Q-value inspector & fight spacing
    const maxQ = Math.max(...lastBlueQValues.map(Math.abs), 0.1);

    return (
      <div className="h-full flex flex-col justify-between text-slate-800">
        <div className="flex items-center justify-between border-b border-blue-100 pb-1 mb-1.5">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-blue-950 uppercase tracking-wide flex items-center gap-1.5">
              <Gauge size={14} className="text-blue-600" />
              Live Combat Telemetry & Deep Q-Network Decisions
            </span>
            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 font-semibold">
              Spacing: {dist}px {dist <= 55 ? '(Punch Range)' : dist <= 75 ? '(Kick Range)' : '(Approaching)'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            Red: <span className="text-red-600 font-bold uppercase">{lastRedAction}</span> | Blue AI: <span className="text-blue-600 font-bold uppercase">{lastBlueAction}</span>
          </div>
        </div>

        {/* Q-Value Action Bars */}
        <div className="flex-1 grid grid-cols-6 gap-2 items-end pb-1">
          {ACTIONS.map((act, i) => {
            const qVal = lastBlueQValues[i] || 0;
            const normH = Math.min(100, Math.max(12, (Math.abs(qVal) / maxQ) * 100));
            const isChosen = act === lastBlueAction;
            const isPositive = qVal >= 0;

            return (
              <div key={act} className="flex flex-col items-center h-full justify-end">
                <span className="text-[10px] font-mono font-semibold text-slate-600 mb-0.5">
                  {qVal.toFixed(1)}
                </span>
                <div className="w-full bg-slate-100 rounded-t-lg overflow-hidden flex flex-col justify-end h-18 border border-slate-200">
                  <div
                    style={{ height: `${normH}%` }}
                    className={`w-full transition-all duration-100 ${
                      isChosen
                        ? 'bg-blue-600 shadow-sm shadow-blue-500/40'
                        : isPositive
                        ? 'bg-sky-400'
                        : 'bg-amber-400/80'
                    }`}
                  />
                </div>
                <span
                  className={`text-[10px] mt-1 font-mono uppercase truncate max-w-full tracking-tight ${
                    isChosen ? 'text-blue-700 font-extrabold' : 'text-slate-500 font-medium'
                  }`}
                >
                  {act}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (mode === 'train') {
    // Training Curves (Rewards + Loss)
    const rewards = dqnEpisodeRewards.slice(-60);
    const width = 600;
    const height = 120;
    const pad = { top: 10, right: 15, bottom: 20, left: 45 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    const maxR = Math.max(...rewards, 10);
    const minR = Math.min(...rewards, -10);
    const rangeR = maxR - minR || 1;
    const toY = (v: number) => pad.top + (1 - (v - minR) / rangeR) * plotH;

    const pts = rewards.map((r, i) => `${pad.left + (i / Math.max(1, rewards.length - 1)) * plotW},${toY(r)}`).join(' ');

    return (
      <div className="h-full flex flex-col justify-between text-slate-800">
        <div className="flex items-center justify-between mb-1 border-b border-blue-100 pb-1">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-blue-600" />
            <span className="text-xs font-bold text-blue-950 uppercase tracking-wide">
              DQN Training Trajectory ({rewards.length} Episodes Tracked)
            </span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            Latest Loss: <span className="text-blue-700 font-bold">{dqnLossHistory[dqnLossHistory.length - 1]?.toFixed(4) || '0.000'}</span>
          </div>
        </div>

        {rewards.length > 1 ? (
          <svg viewBox={`0 0 ${width} ${height}`} className="flex-1 w-full">
            <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + plotH} stroke="#cbd5e1" />
            <line x1={pad.left} y1={pad.top + plotH} x2={pad.left + plotW} y2={pad.top + plotH} stroke="#cbd5e1" />
            <line x1={pad.left} y1={toY(0)} x2={pad.left + plotW} y2={toY(0)} stroke="#94a3b8" strokeDasharray="3,3" />

            <text x={pad.left - 6} y={toY(0) + 3} textAnchor="end" style={{ fontSize: '8px', fill: '#64748b' }}>0</text>
            <text x={pad.left - 6} y={pad.top + 4} textAnchor="end" style={{ fontSize: '8px', fill: '#64748b' }}>{maxR.toFixed(0)}</text>
            <text x={pad.left - 6} y={pad.top + plotH} textAnchor="end" style={{ fontSize: '8px', fill: '#64748b' }}>{minR.toFixed(0)}</text>

            <polyline points={pts} fill="none" stroke="#2563eb" strokeWidth={2.5} />

            <text x={pad.left + plotW / 2} y={height - 4} textAnchor="middle" style={{ fontSize: '9px', fill: '#64748b', fontWeight: 600 }}>
              Training Episodes (Moving Performance)
            </text>
          </svg>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-slate-400 font-medium">
            Training active... Waiting for episode completion data
          </div>
        )}
      </div>
    );
  }

  // Showtime / Standard Mode
  const data = roundRewards.slice(-150);
  const width = 500;
  const height = 120;
  const pad = { top: 10, right: 10, bottom: 20, left: 45 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const redVals = data.map((d) => d.red);
  const blueVals = data.map((d) => d.blue);
  const allVals = [...redVals, ...blueVals];
  const maxV = allVals.length > 0 ? Math.max(...allVals, 10) : 10;
  const minV = allVals.length > 0 ? Math.min(...allVals, -10) : -10;
  const range = maxV - minV || 1;
  const toY = (v: number) => pad.top + (1 - (v - minV) / range) * plotH;

  const redPts = redVals.map((v, i) => `${pad.left + (i / Math.max(1, data.length - 1)) * plotW},${toY(v)}`).join(' ');
  const bluePts = blueVals.map((v, i) => `${pad.left + (i / Math.max(1, data.length - 1)) * plotW},${toY(v)}`).join(' ');

  return (
    <div className="h-full flex flex-col justify-between text-slate-800">
      <div className="flex items-center justify-between mb-1 border-b border-blue-100 pb-1">
        <span className="text-xs font-bold text-blue-950 uppercase tracking-wide">
          Cumulative Bout Reward Trajectories
        </span>
        <div className="flex gap-3 text-[11px] font-mono">
          <span className="flex items-center gap-1 font-semibold text-red-600">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" /> RED
          </span>
          <span className="flex items-center gap-1 font-semibold text-blue-600">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" /> BLUE
          </span>
        </div>
      </div>

      {data.length > 1 ? (
        <svg viewBox={`0 0 ${width} ${height}`} className="flex-1 w-full">
          <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + plotH} stroke="#cbd5e1" />
          <line x1={pad.left} y1={pad.top + plotH} x2={pad.left + plotW} y2={pad.top + plotH} stroke="#cbd5e1" />
          <line x1={pad.left} y1={toY(0)} x2={pad.left + plotW} y2={toY(0)} stroke="#94a3b8" strokeDasharray="3,3" />

          <text x={pad.left - 6} y={toY(0) + 3} textAnchor="end" style={{ fontSize: '8px', fill: '#64748b' }}>0</text>
          <text x={pad.left - 6} y={pad.top + 4} textAnchor="end" style={{ fontSize: '8px', fill: '#64748b' }}>{maxV.toFixed(0)}</text>
          <text x={pad.left - 6} y={pad.top + plotH} textAnchor="end" style={{ fontSize: '8px', fill: '#64748b' }}>{minV.toFixed(0)}</text>

          <polyline points={redPts} fill="none" stroke="#ef4444" strokeWidth={2} />
          <polyline points={bluePts} fill="none" stroke="#2563eb" strokeWidth={2} />
        </svg>
      ) : (
        <div className="flex-1 flex items-center justify-center text-xs text-slate-400 font-medium">
          Awaiting bout completion data...
        </div>
      )}
    </div>
  );
}
