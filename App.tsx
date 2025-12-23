
import React, { useState, useEffect } from 'react';
import { Game } from './components/Game';
import { Sun, Moon, Info } from 'lucide-react';

const App: React.FC = () => {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    if (isDark) {
      document.body.classList.add('bg-zinc-950', 'text-zinc-100');
      document.body.classList.remove('bg-zinc-50', 'text-zinc-900');
    } else {
      document.body.classList.add('bg-zinc-50', 'text-zinc-900');
      document.body.classList.remove('bg-zinc-950', 'text-zinc-100');
    }
  }, [isDark]);

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-300`}>
      {/* Header */}
      <header className="p-4 flex justify-between items-center border-b border-zinc-800/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-yellow-500 p-2 rounded-lg shadow-lg">
            <img src="https://img.icons8.com/emoji/48/000000/money-bag-emoji.png" className="w-6 h-6" alt="Robber Icon" />
          </div>
          <h1 className="text-xl font-black tracking-tight uppercase">The Great Heist</h1>
        </div>
        <div className="flex gap-4 items-center">
          <button
            onClick={() => setIsDark(!isDark)}
            className="p-2 rounded-full hover:bg-zinc-800/20 transition-colors border border-zinc-700/30"
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="flex-grow flex flex-col items-center justify-center p-4">
        <Game isDark={isDark} />
      </main>

      {/* Footer */}
      <footer className="p-4 border-t border-zinc-800/50 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs opacity-60">
        <p>(C) Noam Gold AI 2025</p>
        <div className="flex items-center gap-4">
          <a href="mailto:gold.noam@gmail.com" className="hover:text-yellow-500 transition-colors flex items-center gap-1">
            <Info size={12} /> Send Feedback: gold.noam@gmail.com
          </a>
        </div>
      </footer>
    </div>
  );
};

export default App;
