export type CellType = 'empty' | 'wall' | 'goal' | 'pit';

// Actions: UP=0, RIGHT=1, DOWN=2, LEFT=3
export const ACTIONS = [0, 1, 2, 3] as const;
export type Action = (typeof ACTIONS)[number];
export const ACTION_NAMES = ['Up', 'Right', 'Down', 'Left'] as const;
export const ACTION_DELTAS: [number, number][] = [[-1, 0], [0, 1], [1, 0], [0, -1]];

export interface GridWorld {
  width: number;
  height: number;
  cells: CellType[][];
  startPos: [number, number];
  goalPos: [number, number];
}

export function createDefaultGrid(): GridWorld {
  const width = 6;
  const height = 6;
  const cells: CellType[][] = Array.from({ length: height }, () =>
    new Array(width).fill('empty')
  );

  // Walls
  cells[1][2] = 'wall';
  cells[2][2] = 'wall';
  cells[3][4] = 'wall';
  cells[4][1] = 'wall';

  // Pit
  cells[3][1] = 'pit';

  // Goal
  cells[5][5] = 'goal';

  return { width, height, cells, startPos: [0, 0], goalPos: [5, 5] };
}

export function getReward(grid: GridWorld, row: number, col: number): number {
  const cell = grid.cells[row][col];
  if (cell === 'goal') return 10;
  if (cell === 'pit') return -10;
  return -0.1; // small negative to encourage shorter paths
}

export function step(
  grid: GridWorld,
  pos: [number, number],
  action: Action
): { nextPos: [number, number]; reward: number; done: boolean } {
  const [dr, dc] = ACTION_DELTAS[action];
  let nr = pos[0] + dr;
  let nc = pos[1] + dc;

  // Boundary check
  if (nr < 0 || nr >= grid.height || nc < 0 || nc >= grid.width) {
    nr = pos[0];
    nc = pos[1];
  }

  // Wall check
  if (grid.cells[nr][nc] === 'wall') {
    nr = pos[0];
    nc = pos[1];
  }

  const reward = getReward(grid, nr, nc);
  const done = grid.cells[nr][nc] === 'goal' || grid.cells[nr][nc] === 'pit';

  return { nextPos: [nr, nc], reward, done };
}
