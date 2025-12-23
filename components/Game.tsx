import { DollarSign, Lock, Move, Pause, Play, RotateCcw, Unlock, ShieldAlert, Timer as TimerIcon, Trophy, Volume2, VolumeX } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Direction, GameState, Money, Point, Wall, Guard } from '../types';
import { VirtualControls } from './VirtualControls';

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;
const PLAYER_SIZE = 20;
const GUARD_SIZE = 24;
const SPEED = 4;
const INITIAL_TIME_PER_FLOOR = 60; // seconds

// --- Procedural Audio Engine ---
let audioCtx: AudioContext | null = null;
const getAudioCtx = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
};

const playSound = (type: OscillatorType, freq: number, duration: number, volume: number = 0.1) => {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, ctx.currentTime);
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    oscillator.start();
    oscillator.stop(ctx.currentTime + duration);
  } catch (e) {
    // Silence errors to prevent console spam if audio is blocked
  }
};

const sounds = {
  collect: () => playSound('triangle', 880, 0.1, 0.15),
  passwordSuccess: () => {
    playSound('sine', 440, 0.2, 0.2);
    setTimeout(() => playSound('sine', 554.37, 0.2, 0.2), 100);
    setTimeout(() => playSound('sine', 659.25, 0.4, 0.2), 200);
  },
  passwordFail: () => {
    playSound('sawtooth', 220, 0.2, 0.1);
    setTimeout(() => playSound('sawtooth', 110, 0.4, 0.1), 100);
  },
  caught: () => {
    playSound('sawtooth', 100, 0.5, 0.3);
    playSound('square', 150, 0.5, 0.1);
  },
  transition: () => {
    playSound('sine', 330, 0.5, 0.1);
    setTimeout(() => playSound('sine', 440, 0.5, 0.1), 150);
  }
};

const generateWalls = (floor: number): Wall[] => {
  const walls: Wall[] = [
    { x: 0, y: 0, w: CANVAS_WIDTH, h: 10 },
    { x: 0, y: CANVAS_HEIGHT - 10, w: CANVAS_WIDTH, h: 10 },
    { x: 0, y: 0, w: 10, h: CANVAS_HEIGHT },
    { x: CANVAS_WIDTH - 10, y: 0, w: 10, h: CANVAS_HEIGHT },
  ];

  const seed = floor * 12345;
  const numObstacles = Math.min(3 + floor, 8);
  for (let i = 0; i < numObstacles; i++) {
    const x = 50 + ((seed + i * 150) % (CANVAS_WIDTH - 150));
    const y = 50 + ((seed + i * 100) % (CANVAS_HEIGHT - 150));
    const w = 40 + ((seed * (i + 1)) % 100);
    const h = 40 + ((seed * (i + 2)) % 100);
    walls.push({ x, y, w, h });
  }

  return walls;
};

const generateGuards = (floor: number, walls: Wall[]): Guard[] => {
  const guards: Guard[] = [];
  const numGuards = Math.min(1 + Math.floor(floor / 2), 5);
  
  for (let i = 0; i < numGuards; i++) {
    const startX = 200 + Math.random() * (CANVAS_WIDTH - 300);
    const startY = 100 + Math.random() * (CANVAS_HEIGHT - 200);
    const pathWidth = 100 + Math.random() * 100;
    
    guards.push({
      id: `guard-${i}`,
      pos: { x: startX, y: startY },
      path: [
        { x: startX, y: startY },
        { x: startX + pathWidth, y: startY },
      ],
      currentPathIndex: 0,
      speed: 1.5 + (floor * 0.2)
    });
  }
  return guards;
};

const generateMoney = (floor: number, walls: Wall[]): Money[] => {
  const money: Money[] = [];
  const numBills = 5 + floor * 2;
  
  for (let i = 0; i < numBills; i++) {
    let valid = false;
    let pos = { x: 0, y: 0 };
    while (!valid) {
      pos = {
        x: 40 + Math.random() * (CANVAS_WIDTH - 80),
        y: 40 + Math.random() * (CANVAS_HEIGHT - 80)
      };
      valid = !walls.some(w => 
        pos.x > w.x - 20 && pos.x < w.x + w.w + 20 &&
        pos.y > w.y - 20 && pos.y < w.y + w.h + 20
      );
    }
    money.push({
      id: `money-${i}`,
      pos,
      value: 100 * floor,
      collected: false
    });
  }
  return money;
};

const generatePassword = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

export const Game: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [moveDir, setMoveDir] = useState<Direction>(Direction.NONE);
  const [inputPassword, setInputPassword] = useState('');

  const [gameState, setGameState] = useState<GameState>(() => {
    const walls = generateWalls(1);
    return {
      playerPos: { x: 30, y: 30 },
      currentFloor: 1,
      score: 0,
      money: generateMoney(1, walls),
      walls: walls,
      guards: generateGuards(1, walls),
      password: generatePassword(),
      // Fix: removed 'boolean' type usage as value
      foundPassword: false,
      doorPos: { x: CANVAS_WIDTH - 40, y: CANVAS_HEIGHT - 40 },
      isPaused: false,
      isGameOver: false,
      // Fix: completed missing 'showTerminal' property
      showTerminal: false,
      lastPasswordFound: '',
      timeLeft: INITIAL_TIME_PER_FLOOR,
    };
  });

  const resetGame = useCallback(() => {
    const walls = generateWalls(1);
    setGameState({
      playerPos: { x: 30, y: 30 },
      currentFloor: 1,
      score: 0,
      money: generateMoney(1, walls),
      walls: walls,
      guards: generateGuards(1, walls),
      password: generatePassword(),
      foundPassword: false,
      doorPos: { x: CANVAS_WIDTH - 40, y: CANVAS_HEIGHT - 40 },
      isPaused: false,
      isGameOver: false,
      showTerminal: false,
      lastPasswordFound: '',
      timeLeft: INITIAL_TIME_PER_FLOOR,
    });
    setHasStarted(true);
    setMoveDir(Direction.NONE);
    setInputPassword('');
  }, []);

  const nextFloor = useCallback(() => {
    setGameState(prev => {
      const nextF = prev.currentFloor + 1;
      const walls = generateWalls(nextF);
      if (!isMuted) sounds.transition();
      return {
        ...prev,
        currentFloor: nextF,
        playerPos: { x: 30, y: 30 },
        money: generateMoney(nextF, walls),
        walls: walls,
        guards: generateGuards(nextF, walls),
        password: generatePassword(),
        foundPassword: false,
        doorPos: { x: CANVAS_WIDTH - 40, y: CANVAS_HEIGHT - 40 },
        timeLeft: INITIAL_TIME_PER_FLOOR,
      };
    });
  }, [isMuted]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState.showTerminal) return;
      switch (e.key.toLowerCase()) {
        case 'w': setMoveDir(Direction.UP); break;
        case 's': setMoveDir(Direction.DOWN); break;
        case 'a': setMoveDir(Direction.LEFT); break;
        case 'd': setMoveDir(Direction.RIGHT); break;
        case 'p': setGameState(prev => ({ ...prev, isPaused: !prev.isPaused })); break;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w', 's', 'a', 'd'].includes(key)) setMoveDir(Direction.NONE);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState.showTerminal]);

  // Game Loop
  useEffect(() => {
    if (!hasStarted || gameState.isPaused || gameState.isGameOver || gameState.showTerminal) return;

    const interval = setInterval(() => {
      setGameState(prev => {
        let newX = prev.playerPos.x;
        let newY = prev.playerPos.y;

        if (moveDir === Direction.UP) newY -= SPEED;
        if (moveDir === Direction.DOWN) newY += SPEED;
        if (moveDir === Direction.LEFT) newX -= SPEED;
        if (moveDir === Direction.RIGHT) newX += SPEED;

        // Wall collision
        const collide = prev.walls.some(w => 
          newX + PLAYER_SIZE > w.x && newX < w.x + w.w &&
          newY + PLAYER_SIZE > w.y && newY < w.y + w.h
        );

        if (!collide) {
          newX = Math.max(10, Math.min(CANVAS_WIDTH - PLAYER_SIZE - 10, newX));
          newY = Math.max(10, Math.min(CANVAS_HEIGHT - PLAYER_SIZE - 10, newY));
        } else {
          newX = prev.playerPos.x;
          newY = prev.playerPos.y;
        }

        // Money collection
        let newScore = prev.score;
        const newMoney = prev.money.map(m => {
          if (!m.collected && 
              Math.abs(newX - m.pos.x) < 20 && 
              Math.abs(newY - m.pos.y) < 20) {
            if (!isMuted) sounds.collect();
            newScore += m.value;
            return { ...m, collected: true };
          }
          return m;
        });

        // Guard movement & collision
        const newGuards = prev.guards.map(g => {
          const target = g.path[g.currentPathIndex];
          const dx = target.x - g.pos.x;
          const dy = target.y - g.pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          let newGPos = { ...g.pos };
          let newIdx = g.currentPathIndex;
          
          if (dist < 5) {
            newIdx = (g.currentPathIndex + 1) % g.path.length;
          } else {
            newGPos.x += (dx / dist) * g.speed;
            newGPos.y += (dy / dist) * g.speed;
          }

          return { ...g, pos: newGPos, currentPathIndex: newIdx };
        });

        const caught = newGuards.some(g => 
          Math.abs(newX - g.pos.x) < 20 && 
          Math.abs(newY - g.pos.y) < 20
        );

        if (caught) {
          if (!isMuted) sounds.caught();
          return { ...prev, isGameOver: true };
        }

        // Door interaction
        const distToDoor = Math.sqrt(
          Math.pow(newX - prev.doorPos.x, 2) + Math.pow(newY - prev.doorPos.y, 2)
        );
        
        if (distToDoor < 30 && !prev.foundPassword) {
            return { ...prev, showTerminal: true, playerPos: { x: newX, y: newY } };
        }

        if (prev.foundPassword && distToDoor < 20) {
           nextFloor();
           return prev; 
        }

        return {
          ...prev,
          playerPos: { x: newX, y: newY },
          score: newScore,
          money: newMoney,
          guards: newGuards,
          timeLeft: Math.max(0, prev.timeLeft - 1/60)
        };
      });
    }, 1000 / 60);

    return () => clearInterval(interval);
  }, [hasStarted, gameState.isPaused, gameState.isGameOver, gameState.showTerminal, moveDir, isMuted, nextFloor]);

  // Timer logic
  useEffect(() => {
    if (!hasStarted || gameState.isPaused || gameState.isGameOver || gameState.showTerminal) return;
    const t = setInterval(() => {
      setGameState(prev => {
        if (prev.timeLeft <= 0) return { ...prev, isGameOver: true };
        return prev;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [hasStarted, gameState.isPaused, gameState.isGameOver, gameState.showTerminal]);

  // Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Walls
    ctx.fillStyle = isDark ? '#3f3f46' : '#d4d4d8';
    gameState.walls.forEach(w => ctx.fillRect(w.x, w.y, w.w, w.h));

    // Draw Money
    ctx.fillStyle = '#22c55e';
    gameState.money.forEach(m => {
      if (!m.collected) {
        ctx.beginPath();
        ctx.arc(m.pos.x, m.pos.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '10px bold sans-serif';
        ctx.fillText('$', m.pos.x - 3, m.pos.y + 4);
      }
    });

    // Draw Terminal/Door
    ctx.fillStyle = gameState.foundPassword ? '#22c55e' : '#eab308';
    ctx.fillRect(gameState.doorPos.x, gameState.doorPos.y, 30, 30);
    ctx.fillStyle = '#fff';
    ctx.font = '10px bold sans-serif';
    ctx.fillText(gameState.foundPassword ? 'EXIT' : 'LOCK', gameState.doorPos.x, gameState.doorPos.y - 5);

    // Draw Guards
    ctx.fillStyle = '#ef4444';
    gameState.guards.forEach(g => {
      ctx.fillRect(g.pos.x, g.pos.y, GUARD_SIZE, GUARD_SIZE);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.2)';
      ctx.beginPath();
      ctx.arc(g.pos.x + 12, g.pos.y + 12, 50, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Draw Player
    ctx.fillStyle = isDark ? '#fbbf24' : '#b45309';
    ctx.fillRect(gameState.playerPos.x, gameState.playerPos.y, PLAYER_SIZE, PLAYER_SIZE);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(gameState.playerPos.x, gameState.playerPos.y, PLAYER_SIZE, PLAYER_SIZE);

  }, [gameState, isDark]);

  const handlePasswordSubmit = () => {
    if (inputPassword === gameState.password) {
      if (!isMuted) sounds.passwordSuccess();
      setGameState(prev => ({ ...prev, foundPassword: true, showTerminal: false }));
    } else {
      if (!isMuted) sounds.passwordFail();
      setInputPassword('');
      setGameState(prev => ({ ...prev, showTerminal: false }));
    }
  };

  if (!hasStarted) {
    return (
      <div className="flex flex-col items-center gap-8 text-center max-w-md">
        <div className="relative">
          <div className="absolute -inset-4 bg-yellow-500/20 blur-xl rounded-full animate-pulse" />
          <DollarSign size={80} className="text-yellow-500 relative" />
        </div>
        <div>
          <h2 className="text-4xl font-black uppercase tracking-tighter mb-2">The Great Heist</h2>
          <p className="text-sm opacity-60">Infiltrate the bank, collect the cash, crack the code, and escape to the next floor. Don't let the guards spot you.</p>
        </div>
        <button 
          onClick={resetGame}
          className="group relative px-8 py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase tracking-widest rounded-xl transition-all hover:scale-105 active:scale-95 shadow-[0_8px_0_0_#ca8a04]"
        >
          Begin Infiltration
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-4xl">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
        <div className="bg-zinc-900/40 p-3 rounded-xl border border-zinc-800 flex items-center gap-3">
          <Trophy className="text-yellow-500" size={20} />
          <div>
            <p className="text-[10px] uppercase font-bold opacity-40">Score</p>
            <p className="font-black text-lg">${gameState.score.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-zinc-900/40 p-3 rounded-xl border border-zinc-800 flex items-center gap-3">
          <Move className="text-blue-500" size={20} />
          <div>
            <p className="text-[10px] uppercase font-bold opacity-40">Floor</p>
            <p className="font-black text-lg">{gameState.currentFloor}</p>
          </div>
        </div>
        <div className="bg-zinc-900/40 p-3 rounded-xl border border-zinc-800 flex items-center gap-3">
          <TimerIcon className={gameState.timeLeft < 10 ? "text-red-500 animate-pulse" : "text-zinc-500"} size={20} />
          <div>
            <p className="text-[10px] uppercase font-bold opacity-40">Time</p>
            <p className="font-black text-lg">{Math.ceil(gameState.timeLeft)}s</p>
          </div>
        </div>
        <div className="bg-zinc-900/40 p-3 rounded-xl border border-zinc-800 flex items-center gap-3">
          {gameState.foundPassword ? <Unlock className="text-green-500" size={20} /> : <Lock className="text-red-500" size={20} />}
          <div>
            <p className="text-[10px] uppercase font-bold opacity-40">Security</p>
            <p className="font-black text-lg">{gameState.foundPassword ? 'CRACKED' : 'LOCKED'}</p>
          </div>
        </div>
      </div>

      <div className="relative group w-full flex justify-center">
        <canvas 
          ref={canvasRef} 
          width={CANVAS_WIDTH} 
          height={CANVAS_HEIGHT}
          className="bg-zinc-900 rounded-2xl border-4 border-zinc-800 shadow-2xl cursor-none w-full max-w-[600px] aspect-[3/2]"
        />

        {(gameState.isPaused || gameState.isGameOver) && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center p-6 text-center max-w-[600px] mx-auto">
            {gameState.isGameOver ? (
              <>
                <ShieldAlert size={60} className="text-red-500 mb-4" />
                <h2 className="text-3xl font-black uppercase mb-2">Busted!</h2>
                <p className="mb-6 opacity-60">You were caught or ran out of time on floor {gameState.currentFloor}.</p>
                <button onClick={resetGame} className="flex items-center gap-2 px-6 py-3 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 transition-colors">
                  <RotateCcw size={18} /> Try Again
                </button>
              </>
            ) : (
              <>
                <Pause size={60} className="text-yellow-500 mb-4" />
                <h2 className="text-3xl font-black uppercase mb-6">Game Paused</h2>
                <button 
                  onClick={() => setGameState(prev => ({ ...prev, isPaused: false }))}
                  className="flex items-center gap-2 px-6 py-3 bg-yellow-500 text-black font-bold rounded-lg hover:bg-yellow-400 transition-colors"
                >
                  <Play size={18} /> Resume
                </button>
              </>
            )}
          </div>
        )}

        {gameState.showTerminal && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md rounded-xl flex flex-col items-center justify-center p-8 max-w-[600px] mx-auto">
            <div className="w-full max-w-xs space-y-4">
              <div className="flex items-center gap-2 text-green-500 font-mono text-sm mb-4">
                <span className="animate-pulse">_</span> SECURITY_TERMINAL_V2.0
              </div>
              <p className="text-xs opacity-50 mb-6 font-mono">ENCRYPTED KEY REQUIRED. HINT: {gameState.password}</p>
              <input 
                autoFocus
                type="text"
                maxLength={4}
                value={inputPassword}
                onChange={(e) => setInputPassword(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                placeholder="0000"
                className="w-full bg-zinc-900 border-2 border-green-900/50 text-green-500 text-center text-4xl py-4 rounded-lg font-mono tracking-[1em] focus:outline-none focus:border-green-500"
              />
              <div className="grid grid-cols-2 gap-3">
                 <button 
                  onClick={() => setGameState(prev => ({ ...prev, showTerminal: false }))}
                  className="py-3 bg-zinc-800 text-white rounded-lg font-bold hover:bg-zinc-700"
                >
                  ABORT
                </button>
                <button 
                  onClick={handlePasswordSubmit}
                  className="py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-500"
                >
                  INJECT
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-8 items-start w-full">
        <VirtualControls 
          onMove={(dir) => setMoveDir(dir)} 
          onStop={() => setMoveDir(Direction.NONE)} 
        />
        
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <button 
              onClick={() => setGameState(prev => ({ ...prev, isPaused: !prev.isPaused }))}
              className="p-4 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition-colors"
              title="Pause (P)"
            >
              {gameState.isPaused ? <Play size={24} /> : <Pause size={24} />}
            </button>
            <button 
              onClick={resetGame}
              className="p-4 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition-colors"
              title="Restart"
            >
              <RotateCcw size={24} />
            </button>
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className="p-4 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition-colors"
              title="Mute"
            >
              {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
            </button>
          </div>
          <div className="text-[10px] uppercase font-bold opacity-30 text-center">
            WASD TO MOVE • P TO PAUSE
          </div>
        </div>
      </div>
    </div>
  );
};