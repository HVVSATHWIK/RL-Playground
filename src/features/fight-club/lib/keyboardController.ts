import { type Action, type FighterState } from './fighter';

export interface KeyState {
  moveLeft: boolean;
  moveRight: boolean;
  punch: boolean;
  kick: boolean;
  block: boolean;
  dodge: boolean;
}

export class KeyboardController {
  private keys: Record<string, boolean> = {};
  private punchTriggered = false;
  private kickTriggered = false;
  private dodgeTriggered = false;
  private active = false;

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.active) return;
    // Prevent capturing inputs when user is typing in form controls
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    const code = e.code;
    const key = e.key ? e.key.toLowerCase() : '';

    this.keys[code] = true;
    if (key) this.keys[key] = true;

    // Attacks & Dodges (One-shot triggers for responsive combos)
    if (code === 'KeyJ' || key === 'j' || code === 'Space' || key === ' ') {
      this.punchTriggered = true;
      e.preventDefault();
    } else if (code === 'KeyK' || key === 'k' || code === 'KeyE' || key === 'e') {
      this.kickTriggered = true;
      e.preventDefault();
    } else if (code === 'KeyQ' || key === 'q' || code.startsWith('Alt') || key === 'alt') {
      this.dodgeTriggered = true;
      e.preventDefault();
    } else if (
      code.startsWith('Shift') ||
      key === 'shift' ||
      code === 'KeyA' ||
      key === 'a' ||
      code === 'KeyD' ||
      key === 'd' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight'
    ) {
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (!this.active) return;
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    const code = e.code;
    const key = e.key ? e.key.toLowerCase() : '';

    this.keys[code] = false;
    if (key) this.keys[key] = false;
  };

  private onBlur = () => {
    this.resetInputState();
  };

  private resetInputState() {
    this.keys = {};
    this.punchTriggered = false;
    this.kickTriggered = false;
    this.dodgeTriggered = false;
  }

  attach(): void {
    if (typeof window === 'undefined') return;
    this.active = true;
    this.resetInputState();
    window.addEventListener('keydown', this.onKeyDown, { capture: true });
    window.addEventListener('keyup', this.onKeyUp, { capture: true });
    window.addEventListener('blur', this.onBlur);
  }

  detach(): void {
    if (typeof window === 'undefined') return;
    this.active = false;
    window.removeEventListener('keydown', this.onKeyDown, { capture: true });
    window.removeEventListener('keyup', this.onKeyUp, { capture: true });
    window.removeEventListener('blur', this.onBlur);
    this.resetInputState();
  }

  /**
   * Translates active keyboard input into a fighter action.
   */
  getAction(fighter?: FighterState, opponent?: FighterState): Action {
    void fighter;
    void opponent;

    // 1. Attack / Evade Triggers (Instant 1-frame trigger)
    if (this.punchTriggered) {
      this.punchTriggered = false;
      return 'punch';
    }
    if (this.kickTriggered) {
      this.kickTriggered = false;
      return 'kick';
    }
    if (this.dodgeTriggered) {
      this.dodgeTriggered = false;
      return 'dodge';
    }

    // 2. Block: Dedicated Shift key
    const isShiftHeld = Boolean(
      this.keys['ShiftLeft'] ||
      this.keys['ShiftRight'] ||
      this.keys['shift']
    );
    if (isShiftHeld) {
      return 'block';
    }

    // 3. Directional Left / Right Movement (A / D / Arrow Keys)
    const wantsLeft = Boolean(this.keys['KeyA'] || this.keys['a'] || this.keys['ArrowLeft']);
    const wantsRight = Boolean(this.keys['KeyD'] || this.keys['d'] || this.keys['ArrowRight']);

    if (wantsLeft && !wantsRight) {
      return 'moveLeft';
    }
    if (wantsRight && !wantsLeft) {
      return 'moveRight';
    }

    return 'idle';
  }

  getKeyState(): KeyState {
    const wantsLeft = Boolean(this.keys['KeyA'] || this.keys['a'] || this.keys['ArrowLeft']);
    const wantsRight = Boolean(this.keys['KeyD'] || this.keys['d'] || this.keys['ArrowRight']);

    return {
      moveLeft: wantsLeft,
      moveRight: wantsRight,
      punch: Boolean(this.keys['KeyJ'] || this.keys['j'] || this.keys['Space'] || this.keys[' '] || this.punchTriggered),
      kick: Boolean(this.keys['KeyK'] || this.keys['k'] || this.keys['KeyE'] || this.keys['e'] || this.kickTriggered),
      block: Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.keys['shift']),
      dodge: Boolean(this.keys['KeyQ'] || this.keys['q'] || this.keys['AltLeft'] || this.keys['AltRight'] || this.keys['alt'] || this.dodgeTriggered),
    };
  }
}

export const globalKeyboardController = new KeyboardController();
