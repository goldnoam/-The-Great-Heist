
import React from 'react';
import { Direction } from '../types';

interface Props {
  onMove: (dir: Direction) => void;
  onStop: () => void;
}

export const VirtualControls: React.FC<Props> = ({ onMove, onStop }) => {
  return (
    <div className="flex flex-col items-center gap-2 sm:hidden select-none">
      <h3 className="text-[10px] font-black uppercase text-zinc-500 mb-1 tracking-widest text-center w-full">Tactical Touchpad</h3>
      <div className="grid grid-cols-3 gap-2">
        <div />
        <button 
          onMouseDown={() => onMove(Direction.UP)} 
          onMouseUp={onStop}
          onTouchStart={(e) => { e.preventDefault(); onMove(Direction.UP); }}
          onTouchEnd={(e) => { e.preventDefault(); onStop(); }}
          className="w-16 h-16 bg-zinc-800 active:bg-yellow-500 active:text-black rounded-2xl flex items-center justify-center border-2 border-zinc-700 shadow-lg text-2xl font-black"
        >
          W
        </button>
        <div />
        
        <button 
          onMouseDown={() => onMove(Direction.LEFT)} 
          onMouseUp={onStop}
          onTouchStart={(e) => { e.preventDefault(); onMove(Direction.LEFT); }}
          onTouchEnd={(e) => { e.preventDefault(); onStop(); }}
          className="w-16 h-16 bg-zinc-800 active:bg-yellow-500 active:text-black rounded-2xl flex items-center justify-center border-2 border-zinc-700 shadow-lg text-2xl font-black"
        >
          A
        </button>
        <button 
          onMouseDown={() => onMove(Direction.DOWN)} 
          onMouseUp={onStop}
          onTouchStart={(e) => { e.preventDefault(); onMove(Direction.DOWN); }}
          onTouchEnd={(e) => { e.preventDefault(); onStop(); }}
          className="w-16 h-16 bg-zinc-800 active:bg-yellow-500 active:text-black rounded-2xl flex items-center justify-center border-2 border-zinc-700 shadow-lg text-2xl font-black"
        >
          S
        </button>
        <button 
          onMouseDown={() => onMove(Direction.RIGHT)} 
          onMouseUp={onStop}
          onTouchStart={(e) => { e.preventDefault(); onMove(Direction.RIGHT); }}
          onTouchEnd={(e) => { e.preventDefault(); onStop(); }}
          className="w-16 h-16 bg-zinc-800 active:bg-yellow-500 active:text-black rounded-2xl flex items-center justify-center border-2 border-zinc-700 shadow-lg text-2xl font-black"
        >
          D
        </button>
      </div>
    </div>
  );
};
