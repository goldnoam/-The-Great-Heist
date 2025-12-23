
import React from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { Direction } from '../types';

interface Props {
  onMove: (dir: Direction) => void;
  onStop: () => void;
}

export const VirtualControls: React.FC<Props> = ({ onMove, onStop }) => {
  return (
    <div className="flex flex-col items-center gap-2 sm:hidden select-none">
      <h3 className="text-[10px] font-black uppercase text-zinc-500 mb-1 tracking-widest text-center w-full">Mobile Navigation</h3>
      <div className="grid grid-cols-3 gap-2">
        <div />
        <button 
          onMouseDown={() => onMove(Direction.UP)} 
          onMouseUp={onStop}
          onTouchStart={() => onMove(Direction.UP)}
          onTouchEnd={onStop}
          className="w-16 h-16 bg-zinc-800 active:bg-yellow-500 active:text-black rounded-2xl flex items-center justify-center border border-zinc-700 shadow-lg"
        >
          <ArrowUp size={24} />
        </button>
        <div />
        
        <button 
          onMouseDown={() => onMove(Direction.LEFT)} 
          onMouseUp={onStop}
          onTouchStart={() => onMove(Direction.LEFT)}
          onTouchEnd={onStop}
          className="w-16 h-16 bg-zinc-800 active:bg-yellow-500 active:text-black rounded-2xl flex items-center justify-center border border-zinc-700 shadow-lg"
        >
          <ArrowLeft size={24} />
        </button>
        <button 
          onMouseDown={() => onMove(Direction.DOWN)} 
          onMouseUp={onStop}
          onTouchStart={() => onMove(Direction.DOWN)}
          onTouchEnd={onStop}
          className="w-16 h-16 bg-zinc-800 active:bg-yellow-500 active:text-black rounded-2xl flex items-center justify-center border border-zinc-700 shadow-lg"
        >
          <ArrowDown size={24} />
        </button>
        <button 
          onMouseDown={() => onMove(Direction.RIGHT)} 
          onMouseUp={onStop}
          onTouchStart={() => onMove(Direction.RIGHT)}
          onTouchEnd={onStop}
          className="w-16 h-16 bg-zinc-800 active:bg-yellow-500 active:text-black rounded-2xl flex items-center justify-center border border-zinc-700 shadow-lg"
        >
          <ArrowRight size={24} />
        </button>
      </div>
    </div>
  );
};
