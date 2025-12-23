
export type Point = {
  x: number;
  y: number;
};

export interface Money {
  id: string;
  pos: Point;
  value: number;
  collected: boolean;
}

export interface Wall {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Guard {
  id: string;
  pos: Point;
  path: Point[];
  currentPathIndex: number;
  speed: number;
}

export interface GameState {
  playerPos: Point;
  currentFloor: number;
  score: number;
  money: Money[];
  walls: Wall[];
  guards: Guard[];
  password: string;
  foundPassword: boolean;
  doorPos: Point;
  isPaused: boolean;
  isGameOver: boolean;
  showTerminal: boolean;
  lastPasswordFound: string;
  timeLeft: number;
}

export enum Direction {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  NONE = 'NONE'
}
