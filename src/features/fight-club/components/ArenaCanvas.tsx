import { useEffect, forwardRef } from 'react';
import { useFightStore } from '../stores/fightStore';
import { ARENA_WIDTH, FLOOR_Y, ROBOT_WIDTH, ROBOT_HEIGHT, MAX_HP, type FighterState } from '../lib/fighter';

const CANVAS_H = 400;

function drawRobot(ctx: CanvasRenderingContext2D, f: FighterState, color: string, label: string) {
  const x = f.x;
  const y = FLOOR_Y;
  const flash = f.hitFlash > 0;
  const bodyColor = flash ? '#ffffff' : color;
  const darkColor = flash ? '#cccccc' : color === '#ef4444' ? '#991b1b' : '#1e3a8a';

  ctx.save();

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y + 5, 24, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  ctx.fillStyle = darkColor;
  if (f.animState === 'kicking') {
    ctx.fillRect(x - 8, y - 20, 8, 22);
    ctx.fillRect(x + (f.facing === 1 ? 5 : -35), y - 15, 30, 8);
  } else {
    ctx.fillRect(x - 10, y - 22, 8, 22);
    ctx.fillRect(x + 2, y - 22, 8, 22);
  }

  // Body
  ctx.fillStyle = bodyColor;
  const bodyY = y - ROBOT_HEIGHT;
  ctx.fillRect(x - ROBOT_WIDTH / 2 + 5, bodyY + 10, ROBOT_WIDTH - 10, 35);

  // Arms
  if (f.animState === 'blocking') {
    ctx.fillStyle = darkColor;
    ctx.fillRect(x - 18, bodyY + 15, 36, 8);
    // Glowing block shield
    ctx.strokeStyle = `${color}cc`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, bodyY + 25, 26, 0, Math.PI * 2);
    ctx.stroke();
  } else if (f.animState === 'punching') {
    ctx.fillStyle = darkColor;
    ctx.fillRect(x - 6, bodyY + 15, 8, 18);
    // Extended punch fist
    ctx.fillRect(x + (f.facing === 1 ? 10 : -35), bodyY + 16, 30, 8);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + (f.facing === 1 ? 36 : -42), bodyY + 15, 8, 10);
  } else if (f.animState === 'dodging') {
    ctx.fillStyle = darkColor;
    ctx.fillRect(x - 14, bodyY + 18, 8, 16);
    ctx.fillRect(x + 6, bodyY + 18, 8, 16);
    // Evasive dodge dash trail
    ctx.fillStyle = `${color}44`;
    const trailOffset = f.facing === 1 ? -16 : 16;
    ctx.fillRect(x + trailOffset - ROBOT_WIDTH / 2 + 5, bodyY + 12, ROBOT_WIDTH - 10, 32);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, bodyY + 22, 22, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = darkColor;
    ctx.fillRect(x - 14, bodyY + 15, 8, 20);
    ctx.fillRect(x + 6, bodyY + 15, 8, 20);
  }

  // Head
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.arc(x, bodyY + 2, 12, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = f.animState === 'stunned' ? '#fbbf24' : '#ffffff';
  const eyeDir = f.facing;
  if (f.animState === 'stunned') {
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('X X', x, bodyY + 5);
  } else {
    ctx.beginPath();
    ctx.arc(x + eyeDir * 4 - 3, bodyY, 2.5, 0, Math.PI * 2);
    ctx.arc(x + eyeDir * 4 + 3, bodyY, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(x + eyeDir * 5 - 3, bodyY, 1.2, 0, Math.PI * 2);
    ctx.arc(x + eyeDir * 5 + 3, bodyY, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Label
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, bodyY - 22);

  // HP bar
  const barW = 48;
  const barH = 6;
  const barX = x - barW / 2;
  const barY = bodyY - 16;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
  const hpRatio = Math.max(0, f.hp / MAX_HP);
  ctx.fillStyle = hpRatio > 0.5 ? '#10b981' : hpRatio > 0.25 ? '#f59e0b' : '#ef4444';
  ctx.fillRect(barX, barY, barW * hpRatio, barH);
  ctx.strokeStyle = '#ffffff44';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, barH);

  // Cooldown readiness bar
  const cdBarW = 48;
  const cdBarH = 2.5;
  const cdBarX = x - cdBarW / 2;
  const cdBarY = barY + barH + 2;
  ctx.fillStyle = '#020617';
  ctx.fillRect(cdBarX, cdBarY, cdBarW, cdBarH);
  const cdRatio = f.cooldown <= 0 ? 1 : Math.max(0, 1 - f.cooldown / 14);
  ctx.fillStyle = cdRatio >= 1 ? '#38bdf8' : '#64748b';
  ctx.fillRect(cdBarX, cdBarY, cdBarW * cdRatio, cdBarH);

  // Floating Damage & Evasion indicators
  for (const d of f.damageNumbers) {
    if (d.isEvade) {
      const alpha = Math.max(0, 1 - d.age / 35);
      ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
      ctx.font = `900 ${12 + d.age * 0.15}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('⚡ EVADED!', d.x, FLOOR_Y - ROBOT_HEIGHT - 32 - d.age * 1.5);
    } else {
      const alpha = Math.max(0, 1 - d.age / 30);
      ctx.fillStyle = `rgba(255, 60, 60, ${alpha})`;
      ctx.font = `bold ${13 + d.age * 0.25}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`-${d.value}`, d.x, FLOOR_Y - ROBOT_HEIGHT - 32 - d.age * 1.6);
    }
  }

  ctx.restore();
}

function getPolicyLabel(policy: string, defaultName: string): string {
  switch (policy) {
    case 'human':
      return `${defaultName} (YOU)`;
    case 'dqn':
      return `${defaultName} [DQN]`;
    case 'expert':
      return `${defaultName} [EXPERT]`;
    case 'tabular':
      return `${defaultName} [TABULAR]`;
    default:
      return defaultName;
  }
}

function drawShowtimeScoreboard(
  ctx: CanvasRenderingContext2D,
  redHits: number,
  blueHits: number,
  red: FighterState,
  blue: FighterState,
  round: number,
  stepCount: number,
  isRecording: boolean
) {
  const cx = ARENA_WIDTH / 2;

  // Scoreboard background
  ctx.fillStyle = 'rgba(11, 19, 43, 0.9)';
  const sbW = 480;
  const sbH = 54;
  ctx.beginPath();
  ctx.roundRect(cx - sbW / 2, 6, sbW, sbH, 12);
  ctx.fill();
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // RED side
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ef4444';
  ctx.fillText('RED', cx - 80, 26);

  ctx.font = 'black 28px system-ui, sans-serif';
  ctx.fillStyle = '#ef4444';
  ctx.fillText(String(redHits), cx - 30, 44);

  ctx.font = '9px system-ui, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('hits', cx - 80, 44);

  // VS separator
  ctx.font = 'extrabold 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('VS', cx, 36);

  // BLUE side
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#3b82f6';
  ctx.fillText('BLUE', cx + 80, 26);

  ctx.font = 'black 28px system-ui, sans-serif';
  ctx.fillStyle = '#3b82f6';
  ctx.fillText(String(blueHits), cx + 30, 44);

  ctx.font = '9px system-ui, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'left';
  ctx.fillText('hits', cx + 80, 44);

  // Round + step below scoreboard
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#93c5fd';
  ctx.fillText(`Round ${round}  •  Frame ${stepCount}`, cx, 74);

  // Big Top HP bars
  const hpBarW = 160;
  const hpBarH = 8;
  const hpY = 80;

  // Red HP
  const redHp = Math.max(0, red.hp / MAX_HP);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(cx - 10 - hpBarW, hpY, hpBarW, hpBarH);
  ctx.fillStyle = redHp > 0.5 ? '#10b981' : redHp > 0.25 ? '#f59e0b' : '#ef4444';
  ctx.fillRect(cx - 10 - hpBarW + hpBarW * (1 - redHp), hpY, hpBarW * redHp, hpBarH);

  // Blue HP
  const blueHp = Math.max(0, blue.hp / MAX_HP);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(cx + 10, hpY, hpBarW, hpBarH);
  ctx.fillStyle = blueHp > 0.5 ? '#10b981' : blueHp > 0.25 ? '#f59e0b' : '#ef4444';
  ctx.fillRect(cx + 10, hpY, hpBarW * blueHp, hpBarH);

  // HP text
  ctx.font = 'bold 10px monospace';
  ctx.fillStyle = '#cbd5e1';
  ctx.textAlign = 'right';
  ctx.fillText(`${red.hp} HP`, cx - 14 - hpBarW, hpY + 7);
  ctx.textAlign = 'left';
  ctx.fillText(`${blue.hp} HP`, cx + 14 + hpBarW, hpY + 7);

  // Recording indicator
  if (isRecording) {
    ctx.beginPath();
    ctx.arc(ARENA_WIDTH - 20, 20, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.font = '9px system-ui';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ef4444';
    ctx.fillText('REC', ARENA_WIDTH - 30, 24);
  }
}

export const ArenaCanvas = forwardRef<HTMLCanvasElement>(function ArenaCanvas(_, ref) {
  const {
    red,
    blue,
    round,
    stepCount,
    lastWinner,
    announceTimer,
    isShowtime,
    redHitsThisRound,
    blueHitsThisRound,
    redPolicy,
    bluePolicy,
    mode,
  } = useFightStore();

  const isRecording =
    typeof document !== 'undefined' && document.querySelector('[data-recording="true"]') !== null;

  useEffect(() => {
    const canvas = typeof ref === 'function' ? null : ref?.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // Arena Background: Deep Cyber Midnight Navy
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, '#070c1d');
    grad.addColorStop(0.65, '#0c1736');
    grad.addColorStop(1, '#111e47');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, ARENA_WIDTH, CANVAS_H);

    // Subtle blue arena grid lines
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.07)';
    ctx.lineWidth = 1;
    for (let x = 40; x < ARENA_WIDTH; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, FLOOR_Y);
      ctx.stroke();
    }

    // Spotlight glow
    const spotGrad = ctx.createRadialGradient(ARENA_WIDTH / 2, 40, 60, ARENA_WIDTH / 2, FLOOR_Y, 380);
    spotGrad.addColorStop(0, 'rgba(56, 189, 248, 0.12)');
    spotGrad.addColorStop(0.7, 'rgba(37, 99, 235, 0.04)');
    spotGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = spotGrad;
    ctx.fillRect(0, 0, ARENA_WIDTH, CANVAS_H);

    // Floor Platform
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, FLOOR_Y + 5, ARENA_WIDTH, CANVAS_H - FLOOR_Y);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, FLOOR_Y + 5);
    ctx.lineTo(ARENA_WIDTH, FLOOR_Y + 5);
    ctx.stroke();

    // Glowing Neon Ring Ropes
    [FLOOR_Y - 60, FLOOR_Y - 30].forEach((ry, idx) => {
      ctx.strokeStyle = idx === 0 ? 'rgba(56, 189, 248, 0.45)' : 'rgba(37, 99, 235, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10, ry);
      ctx.lineTo(ARENA_WIDTH - 10, ry);
      ctx.stroke();
    });

    // Draw fighters with real dynamic facing and badges
    drawRobot(ctx, red, '#ef4444', getPolicyLabel(redPolicy, 'RED'));
    drawRobot(ctx, blue, '#3b82f6', getPolicyLabel(bluePolicy, 'BLUE'));

    // Top banner
    if (isShowtime) {
      drawShowtimeScoreboard(ctx, redHitsThisRound, blueHitsThisRound, red, blue, round, stepCount, isRecording);
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const modeTitle =
        mode === 'dojo'
          ? 'THE DOJO • HUMAN VS AI'
          : mode === 'train'
          ? 'DEEP Q-NETWORK TRAINING STUDIO'
          : 'BENCHMARK TOURNAMENT SHOWDOWN';
      ctx.fillText(`${modeTitle} • Round ${round} • Frame ${stepCount}`, ARENA_WIDTH / 2, 22);

      if (mode === 'dojo') {
        ctx.font = '10px monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(
          'CONTROLS: [A/D or ←/→] Move • [J/Space] Punch • [K/E] Kick • [Shift] Block • [Alt/Q] Dodge',
          ARENA_WIDTH / 2,
          38
        );
      }
    }

    // Winner announcement
    if (lastWinner && announceTimer > 0) {
      ctx.fillStyle = 'rgba(7, 12, 29, 0.88)';
      ctx.fillRect(0, CANVAS_H / 2 - 50, ARENA_WIDTH, 100);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(0, CANVAS_H / 2 - 50, ARENA_WIDTH, 100);

      ctx.font = 'black 32px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = lastWinner === 'red' ? '#ef4444' : lastWinner === 'blue' ? '#38bdf8' : '#f59e0b';
      const text = lastWinner === 'draw' ? 'DRAW DECISION!' : `${lastWinner.toUpperCase()} WINS!`;
      ctx.fillText(text, ARENA_WIDTH / 2, CANVAS_H / 2 + 5);

      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(
        lastWinner === 'red' && redPolicy === 'human'
          ? 'VICTORY! You defeated the trained AI agent.'
          : lastWinner === 'blue' && redPolicy === 'human'
          ? 'DEFEAT! The Deep Q-Network prevailed.'
          : 'Bout concluded. Resetting ring for next round...',
        ARENA_WIDTH / 2,
        CANVAS_H / 2 + 30
      );
    }
  }, [
    red,
    blue,
    round,
    stepCount,
    lastWinner,
    announceTimer,
    isShowtime,
    redHitsThisRound,
    blueHitsThisRound,
    redPolicy,
    bluePolicy,
    mode,
    ref,
    isRecording,
  ]);

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-lg border-2 border-blue-200/80 bg-slate-900 flex items-center justify-center">
      <canvas
        ref={ref}
        width={ARENA_WIDTH}
        height={CANVAS_H}
        style={{ width: '100%', maxWidth: ARENA_WIDTH, display: 'block' }}
      />
    </div>
  );
});
