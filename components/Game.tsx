
import { DollarSign, Lock, Move, Pause, Play, RotateCcw, Unlock, ShieldAlert, Timer as TimerIcon } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Direction, GameState, Money, Point, Wall, Guard } from '../types';
import { VirtualControls } from './VirtualControls';

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;
const PLAYER_SIZE = 30;
const GUARD_SIZE = 30;
const SPEED = 5;
const HINT_DISTANCE_THRESHOLD = 180;
const INITIAL_TIME_PER_FLOOR = 60; // seconds

// --- Sound Synthesis Helpers ---
const playSound = (type: 'sine' | 'square' | 'sawtooth' | 'triangle', freq: number, duration: number, volume: number = 0.1) => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
  } catch (e) {
    console.warn('Audio playback blocked or failed', e);
  }
};

const sounds = {
  collect: () => playSound('triangle', 880, 0.1, 0.2),
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
  },
  tick: () => playSound('sine', 200, 0.05, 0.05)
};

const generateWalls = (floor: number): Wall[] => {
  const walls: Wall[] = [
    // Boundaries
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
    const w = 20 + ((seed * (i + 1)) % 100);
    const h = 20 + ((seed * (i + 2)) % 100);
    walls.push({ x, y, w, h });
  }

  return walls;
};

const generateGuards = (floor: number, walls: Wall[]): Guard[] => {
  const guards: Guard[] = [];
  const numGuards = Math.min(1 + Math.floor(floor / 2), 4);
  
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
        pos.x > w.x - 15 && pos.x < w.x + w.w + 15 &&
        pos.y > w.y - 15 && pos.y < w.y + w.h + 15
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
  const [gameState, setGameState] = useState<GameState>({
    playerPos: { x: 50, y: 50 },
    currentFloor: 1,
    score: 0,
    money: [],
    walls: [],
    guards: [],
    password: '',
    foundPassword: false,
    doorPos: { x: CANVAS_WIDTH - 50, y: CANVAS_HEIGHT - 50 },
    isPaused: false,
    isGameOver: false,
    showTerminal: false,
    lastPasswordFound: '',
    timeLeft: INITIAL_TIME_PER_FLOOR
  });

  const [inputCode, setInputCode] = useState('');
  const [movement, setMovement] = useState<{ [key: string]: boolean }>({});
  const animationFrameRef = useRef<number>();
  const pulseRef = useRef(0);
  const lastTimeRef = useRef(Date.now());
  const tickCounterRef = useRef(0);

  const initFloor = useCallback((floor: number, prevScore: number = 0) => {
    const walls = generateWalls(floor);
    const money = generateMoney(floor, walls);
    const guards = generateGuards(floor, walls);
    const password = generatePassword();
    const doorPos = { x: CANVAS_WIDTH - 50, y: CANVAS_HEIGHT - 50 };
    
    setGameState(prev => ({
      ...prev,
      playerPos: { x: 50, y: 50 },
      currentFloor: floor,
      score: prevScore,
      money,
      walls,
      guards,
      password,
      foundPassword: false,
      doorPos,
      isPaused: false,
      isGameOver: false,
      showTerminal: false,
      lastPasswordFound: '',
      timeLeft: INITIAL_TIME_PER_FLOOR
    }));
  }, []);

  useEffect(() => {
    initFloor(1);
  }, [initFloor]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    setMovement(prev => ({ ...prev, [e.code]: true }));
    if (e.code === 'KeyP') setGameState(s => ({ ...s, isPaused: !s.isPaused }));
    if (e.code === 'KeyR') resetGame();
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    setMovement(prev => ({ ...prev, [e.code]: false }));
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  const resetGame = () => {
    initFloor(1, 0);
    setInputCode('');
  };

  const nextFloor = () => {
    sounds.transition();
    initFloor(gameState.currentFloor + 1, gameState.score);
    setInputCode('');
  };

  const update = useCallback(() => {
    if (gameState.isPaused || gameState.isGameOver || gameState.showTerminal) return;

    const now = Date.now();
    const dt = (now - lastTimeRef.current) / 1000;
    lastTimeRef.current = now;

    pulseRef.current += 0.05;

    setGameState(prev => {
      // Timer update
      let newTimeLeft = prev.timeLeft - dt;
      if (newTimeLeft <= 0) {
        sounds.passwordFail();
        const penScore = Math.max(0, prev.score - 500);
        alert("SECURITY ALERT: Timeout! Floor reset.");
        initFloor(prev.currentFloor, penScore);
        return prev;
      }
      
      // Low time tick sound
      if (newTimeLeft < 5) {
        tickCounterRef.current += dt;
        if (tickCounterRef.current > 0.5) {
          sounds.tick();
          tickCounterRef.current = 0;
        }
      }

      // Movement update
      let dx = 0;
      let dy = 0;
      if (movement['ArrowUp'] || movement['KeyW']) dy -= SPEED;
      if (movement['ArrowDown'] || movement['KeyS']) dy += SPEED;
      if (movement['ArrowLeft'] || movement['KeyA']) dx -= SPEED;
      if (movement['ArrowRight'] || movement['KeyD']) dx += SPEED;

      let newX = prev.playerPos.x + dx;
      let newY = prev.playerPos.y + dy;

      const collides = (nx: number, ny: number) => {
        return prev.walls.some(w => (
          nx + PLAYER_SIZE > w.x &&
          nx < w.x + w.w &&
          ny + PLAYER_SIZE > w.y &&
          ny < w.y + w.h
        ));
      };

      if (collides(newX, prev.playerPos.y)) newX = prev.playerPos.x;
      if (collides(prev.playerPos.x, newY)) newY = prev.playerPos.y;
      if (collides(newX, newY)) {
          newX = prev.playerPos.x;
          newY = prev.playerPos.y;
      }

      newX = Math.max(10, Math.min(CANVAS_WIDTH - PLAYER_SIZE - 10, newX));
      newY = Math.max(10, Math.min(CANVAS_HEIGHT - PLAYER_SIZE - 10, newY));

      const newPos = { x: newX, y: newY };

      // Money collection
      let newScore = prev.score;
      let collectedAtLeastOne = false;
      const newMoney = prev.money.map(m => {
        if (!m.collected && 
            Math.abs(m.pos.x - (newPos.x + PLAYER_SIZE/2)) < 25 && 
            Math.abs(m.pos.y - (newPos.y + PLAYER_SIZE/2)) < 25) {
          newScore += m.value;
          collectedAtLeastOne = true;
          return { ...m, collected: true };
        }
        return m;
      });

      if (collectedAtLeastOne) sounds.collect();

      // Guard Patrol Update
      const newGuards = prev.guards.map(g => {
        const target = g.path[g.currentPathIndex];
        const angle = Math.atan2(target.y - g.pos.y, target.x - g.pos.x);
        const dist = Math.sqrt(Math.pow(target.x - g.pos.x, 2) + Math.pow(target.y - g.pos.y, 2));
        
        let newGPos = { ...g.pos };
        let newIndex = g.currentPathIndex;

        if (dist < 5) {
          newIndex = (g.currentPathIndex + 1) % g.path.length;
        } else {
          newGPos.x += Math.cos(angle) * g.speed;
          newGPos.y += Math.sin(angle) * g.speed;
        }

        return { ...g, pos: newGPos, currentPathIndex: newIndex };
      });

      // Collision Detection: Guard vs Player
      const caught = newGuards.some(g => {
        return Math.abs(g.pos.x - (newPos.x + PLAYER_SIZE / 2)) < 25 &&
               Math.abs(g.pos.y - (newPos.y + PLAYER_SIZE / 2)) < 25;
      });

      if (caught) {
        sounds.caught();
        return { ...prev, isGameOver: true };
      }

      const passwordStation = { x: 100, y: 300 };
      let found = prev.foundPassword;
      if (!found && 
          Math.abs(passwordStation.x - (newPos.x + PLAYER_SIZE/2)) < 40 &&
          Math.abs(passwordStation.y - (newPos.y + PLAYER_SIZE/2)) < 40) {
        found = true;
        sounds.collect(); // Sound for finding the code
      }

      let showTerminal = prev.showTerminal;
      if (Math.abs(prev.doorPos.x - (newPos.x + PLAYER_SIZE/2)) < 40 &&
          Math.abs(prev.doorPos.y - (newPos.y + PLAYER_SIZE/2)) < 40) {
        showTerminal = true;
      }

      return {
        ...prev,
        playerPos: newPos,
        money: newMoney,
        guards: newGuards,
        score: newScore,
        foundPassword: found,
        showTerminal,
        timeLeft: newTimeLeft
      };
    });
  }, [movement, gameState.isPaused, gameState.isGameOver, gameState.showTerminal, initFloor]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = isDark ? '#18181b' : '#f4f4f5';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.strokeStyle = isDark ? '#27272a' : '#e4e4e7';
    ctx.lineWidth = 1;
    for(let i=0; i<CANVAS_WIDTH; i+=40) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CANVAS_HEIGHT); ctx.stroke();
    }
    for(let i=0; i<CANVAS_HEIGHT; i+=40) {
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(CANVAS_WIDTH, i); ctx.stroke();
    }

    gameState.walls.forEach(w => {
      ctx.fillStyle = isDark ? '#3f3f46' : '#a1a1aa';
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.strokeStyle = isDark ? '#52525b' : '#71717a';
      ctx.strokeRect(w.x, w.y, w.w, w.h);
    });

    gameState.money.forEach(m => {
      if (!m.collected) {
        ctx.save();
        ctx.translate(m.pos.x, m.pos.y);
        ctx.fillStyle = '#166534'; 
        ctx.fillRect(-10, -6, 20, 12);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(-8, -4, 16, 8);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', 0, 1);
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#22c55e';
        ctx.strokeStyle = '#14532d';
        ctx.lineWidth = 1;
        ctx.strokeRect(-10, -6, 20, 12);
        ctx.restore();
        ctx.shadowBlur = 0;
      }
    });

    const passwordStation = { x: 100, y: 300 };
    ctx.fillStyle = gameState.foundPassword ? '#4ade80' : '#ef4444';
    ctx.fillRect(passwordStation.x - 10, passwordStation.y - 10, 20, 20);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('CODE', passwordStation.x - 14, passwordStation.y + 4);

    ctx.fillStyle = '#8b5cf6';
    ctx.fillRect(gameState.doorPos.x - 20, gameState.doorPos.y - 20, 40, 40);
    ctx.strokeStyle = 'white';
    ctx.strokeRect(gameState.doorPos.x - 20, gameState.doorPos.y - 20, 40, 40);
    ctx.fillStyle = 'white';
    ctx.fillText('EXIT', gameState.doorPos.x - 12, gameState.doorPos.y + 5);

    const playerMidX = gameState.playerPos.x + PLAYER_SIZE / 2;
    const playerMidY = gameState.playerPos.y + PLAYER_SIZE / 2;
    const distToExit = Math.sqrt(Math.pow(gameState.doorPos.x - playerMidX, 2) + Math.pow(gameState.doorPos.y - playerMidY, 2));

    if (distToExit < HINT_DISTANCE_THRESHOLD && !gameState.showTerminal) {
      const angle = Math.atan2(gameState.doorPos.y - playerMidY, gameState.doorPos.x - playerMidX);
      const hintOpacity = (1 - distToExit / HINT_DISTANCE_THRESHOLD) * (0.3 + 0.2 * Math.sin(pulseRef.current * 4));
      
      ctx.save();
      ctx.translate(playerMidX + Math.cos(angle) * 40, playerMidY + Math.sin(angle) * 40);
      ctx.rotate(angle);
      ctx.strokeStyle = `rgba(139, 92, 246, ${hintOpacity})`;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-10, -5);
      ctx.lineTo(5, 0);
      ctx.lineTo(-10, 5);
      ctx.stroke();
      ctx.restore();
    }

    gameState.guards.forEach(g => {
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(g.pos.x, g.pos.y, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
      ctx.beginPath();
      ctx.arc(g.pos.x, g.pos.y, 45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(g.pos.x - 10, g.pos.y - 18, 20, 6);
    });

    // --- DRAW ROBBER (Improved Visual) ---
    const px = gameState.playerPos.x;
    const py = gameState.playerPos.y;
    
    // Shirt (Striped)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px, py + 10, PLAYER_SIZE, 20);
    ctx.fillStyle = '#000000';
    ctx.fillRect(px, py + 12, PLAYER_SIZE, 4);
    ctx.fillRect(px, py + 20, PLAYER_SIZE, 4);
    ctx.fillRect(px, py + 28, PLAYER_SIZE, 2);

    // Head
    ctx.fillStyle = '#fca5a5';
    ctx.beginPath();
    ctx.arc(px + PLAYER_SIZE / 2, py + 8, 8, 0, Math.PI * 2);
    ctx.fill();

    // Mask
    ctx.fillStyle = '#000000';
    ctx.fillRect(px + PLAYER_SIZE / 2 - 8, py + 4, 16, 6);
    
    // Eyes in mask
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px + PLAYER_SIZE / 2 - 5, py + 6, 2, 2);
    ctx.fillRect(px + PLAYER_SIZE / 2 + 3, py + 6, 2, 2);

    // Beanie/Hat
    ctx.fillStyle = '#3f3f46';
    ctx.beginPath();
    ctx.arc(px + PLAYER_SIZE / 2, py + 4, 8, Math.PI, 0);
    ctx.fill();

    // Loot Bag on Back
    if (gameState.score > 0) {
      ctx.fillStyle = '#713f12';
      ctx.beginPath();
      ctx.arc(px + 4, py + 20, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    if (gameState.isPaused) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0,0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 40px sans-serif';
      ctx.fillText('PAUSED', CANVAS_WIDTH/2 - 80, CANVAS_HEIGHT/2);
    }

    if (gameState.isGameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0,0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = '#ef4444';
      ctx.font = 'black 48px sans-serif';
      ctx.fillText('BUSTED!', CANVAS_WIDTH/2 - 95, CANVAS_HEIGHT/2);
      ctx.fillStyle = 'white';
      ctx.font = '20px sans-serif';
      ctx.fillText('The guards caught you.', CANVAS_WIDTH/2 - 100, CANVAS_HEIGHT/2 + 40);
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('PRESS R TO RETRY', CANVAS_WIDTH/2 - 75, CANVAS_HEIGHT/2 + 80);
    }
  }, [gameState, isDark]);

  const loop = useCallback(() => {
    update();
    draw();
    animationFrameRef.current = requestAnimationFrame(loop);
  }, [update, draw]);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [loop]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode === gameState.password) {
      sounds.passwordSuccess();
      nextFloor();
    } else {
      sounds.passwordFail();
      alert("INCORRECT PASSWORD! Access Denied.");
      setInputCode('');
      setGameState(s => ({ ...s, showTerminal: false, playerPos: { x: s.playerPos.x - 40, y: s.playerPos.y - 40 } }));
    }
  };

  const timerPercentage = (gameState.timeLeft / INITIAL_TIME_PER_FLOOR) * 100;

  return (
    <div className="relative group max-w-full">
      <div className="mb-4 flex flex-wrap gap-4 items-center justify-between bg-zinc-800/20 p-4 rounded-xl border border-zinc-700/30 backdrop-blur-sm shadow-xl">
        <div className="flex gap-6 items-center">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">Floor</span>
            <span className="text-2xl font-black text-yellow-500 leading-none">{gameState.currentFloor}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">Loot</span>
            <span className="text-2xl font-black text-green-500 leading-none">${gameState.score.toLocaleString()}</span>
          </div>
          <div className="flex flex-col min-w-[120px]">
            <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 flex items-center gap-1">
              <TimerIcon size={10} /> Time Left
            </span>
            <div className="h-2 w-full bg-zinc-800 rounded-full mt-1 overflow-hidden">
               <div 
                 className={`h-full transition-all duration-300 ${timerPercentage < 25 ? 'bg-red-500' : 'bg-yellow-500'}`}
                 style={{ width: `${timerPercentage}%` }}
               />
            </div>
            <span className={`text-xs font-mono mt-1 ${gameState.timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-zinc-400'}`}>
              {Math.max(0, Math.ceil(gameState.timeLeft))}s
            </span>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => setGameState(s => ({ ...s, isPaused: !s.isPaused }))}
            className="p-3 bg-zinc-700/50 hover:bg-zinc-600 rounded-lg transition-all"
          >
            {gameState.isPaused ? <Play size={20} /> : <Pause size={20} />}
          </button>
          <button 
            onClick={resetGame}
            className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all"
          >
            <RotateCcw size={20} />
          </button>
        </div>
      </div>

      <div className="relative rounded-2xl overflow-hidden border-4 border-zinc-800 shadow-2xl bg-zinc-900">
        <canvas 
          ref={canvasRef} 
          width={CANVAS_WIDTH} 
          height={CANVAS_HEIGHT}
          className="max-w-full h-auto cursor-none"
        />

        {gameState.foundPassword && !gameState.showTerminal && !gameState.isGameOver && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-full font-mono font-bold shadow-lg animate-bounce border-2 border-white">
            SCANNED CODE: {gameState.password}
          </div>
        )}

        {!gameState.foundPassword && !gameState.showTerminal && !gameState.isGameOver && (
            <div className="absolute top-4 right-4 bg-zinc-800/80 text-white p-3 rounded-lg text-xs border border-zinc-700">
                <p className="flex items-center gap-2 mb-1"><Lock size={14} className="text-red-400" /> Door is Locked</p>
                <p className="text-zinc-400">Find the security note on the floor!</p>
            </div>
        )}

        {gameState.showTerminal && !gameState.isGameOver && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
            <div className="bg-zinc-900 border-2 border-yellow-500 w-full max-w-sm p-8 rounded-2xl shadow-[0_0_50px_rgba(234,179,8,0.2)]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-yellow-500 font-black text-xl tracking-tighter uppercase flex items-center gap-2">
                  <Unlock size={24} /> Security Terminal
                </h2>
                <button 
                  onClick={() => setGameState(s => ({ ...s, showTerminal: false }))}
                  className="text-zinc-500 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
              
              <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                Vault exit protocol initiated. Please enter the 4-digit floor clearance code.
              </p>

              <form onSubmit={handlePasswordSubmit}>
                <input 
                  autoFocus
                  type="text" 
                  maxLength={4}
                  placeholder="0 0 0 0"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-zinc-950 border-2 border-zinc-800 p-6 text-center text-4xl font-black tracking-[1em] text-yellow-500 rounded-xl focus:border-yellow-500 focus:outline-none transition-all placeholder:text-zinc-800"
                />
                <button 
                  type="submit"
                  disabled={inputCode.length < 4}
                  className="w-full mt-6 bg-yellow-500 hover:bg-yellow-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-black p-4 rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest shadow-lg active:scale-95"
                >
                  Confirm Entry
                </button>
              </form>
              
              {gameState.foundPassword ? (
                 <p className="mt-4 text-center text-green-500 text-xs font-mono">
                    HINT: Security Note matches code "{gameState.password}"
                 </p>
              ) : (
                 <p className="mt-4 text-center text-red-500 text-xs font-mono">
                    HINT: Clearance code not found. Check the floor notes.
                 </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
        <div className="bg-zinc-800/10 p-4 rounded-xl border border-zinc-800/50">
          <h3 className="text-[10px] font-black uppercase text-zinc-500 mb-3 tracking-widest flex items-center gap-2">
            <ShieldAlert size={12} className="text-blue-400" /> Security Intel
          </h3>
          <div className="flex gap-4 text-xs text-zinc-400 flex-wrap">
             <div className="flex items-center gap-2"><div className="bg-zinc-800 px-2 py-1 rounded border border-zinc-700 text-white">WASD</div> Move</div>
             <div className="flex items-center gap-2"><div className="bg-zinc-800 px-2 py-1 rounded border border-zinc-700 text-white">P</div> Pause</div>
             <div className="flex items-center gap-2"><div className="bg-zinc-800 px-2 py-1 rounded border border-zinc-700 text-white">R</div> Reset</div>
             <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500 rounded-full" /> Avoid Guards</div>
          </div>
        </div>

        <VirtualControls 
          onMove={(dir) => {
             setMovement(prev => ({
                ...prev,
                'KeyW': dir === Direction.UP,
                'KeyS': dir === Direction.DOWN,
                'KeyA': dir === Direction.LEFT,
                'KeyD': dir === Direction.RIGHT,
             }));
          }}
          onStop={() => {
             setMovement({
                'KeyW': false, 'KeyS': false, 'KeyA': false, 'KeyD': false,
                'ArrowUp': false, 'ArrowDown': false, 'ArrowLeft': false, 'ArrowRight': false
             });
          }}
        />
      </div>

      <div className="mt-4 text-center italic text-zinc-500 text-sm animate-pulse">
        Objective: Collect all dollar bills, avoid blue guards, and find the security note before the timer runs out!
      </div>
    </div>
  );
};
