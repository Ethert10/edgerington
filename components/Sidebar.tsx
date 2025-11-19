import React, { useState } from 'react';
import { Trash2, X, BookOpen, Bot, ChevronDown, ChevronRight, History, Home } from 'lucide-react';
import { ChatSession, ChatMode } from '../types';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onNewChat: (mode: ChatMode) => void;
  onGoHome: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  toggleSidebar,
  sessions,
  currentSessionId,
  onNewChat,
  onGoHome,
  onSelectSession,
  onDeleteSession
}) => {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Filter sessions: Only show Homework mode in history
  const homeworkSessions = sessions.filter(s => s.mode === 'homework');

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={toggleSidebar}
      />

      {/* Sidebar Content */}
      <div className={`fixed lg:static inset-y-0 left-0 z-30 w-72 glass-panel-dark text-gray-100 flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        
        {/* Header */}
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3 font-display font-bold text-2xl tracking-wider cursor-pointer" onClick={onGoHome}>
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-rose-900 flex items-center justify-center shadow-neon">
                <span className="text-white">E</span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-black animate-pulse"></div>
            </div>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-red-200">
              EDGE<span className="text-red-500">AI</span>
            </span>
          </div>
          <button onClick={toggleSidebar} className="lg:hidden p-1 hover:text-red-400 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Navigation */}
        <div className="px-4 py-2 space-y-3">
            <button 
            onClick={() => {
              onGoHome();
              if (window.innerWidth < 1024) toggleSidebar();
            }}
            className="w-full flex items-center gap-4 px-4 py-3 text-gray-300 hover:bg-white/5 rounded-xl transition-all hover:text-white"
          >
            <Home size={20} />
            <span className="font-display font-bold">Home</span>
          </button>

          <button 
            onClick={() => {
              onNewChat('persona');
              if (window.innerWidth < 1024) toggleSidebar();
            }}
            className="w-full flex items-center gap-4 px-4 py-4 bg-gradient-to-r from-red-900/40 to-transparent hover:from-red-600 hover:to-red-900 text-white rounded-xl transition-all border border-red-900/50 hover:border-red-500 group shadow-lg hover:shadow-neon relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/5 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12"></div>
            <Bot size={22} className="text-red-400 group-hover:text-white relative z-10" />
            <div className="flex flex-col items-start relative z-10">
                <span className="font-display font-bold text-lg leading-tight">EdgeChat</span>
                <span className="text-[10px] text-red-300/70 font-mono">Edgerington Model</span>
            </div>
          </button>

          <button 
            onClick={() => {
              onNewChat('homework');
              if (window.innerWidth < 1024) toggleSidebar();
            }}
            className="w-full flex items-center gap-4 px-4 py-4 bg-cyan-900/20 hover:bg-cyan-900/40 text-cyan-100 rounded-xl transition-all border border-cyan-900/30 hover:border-cyan-500/50 group"
          >
            <BookOpen size={22} className="text-cyan-400/60 group-hover:text-cyan-300" />
             <div className="flex flex-col items-start">
                <span className="font-display font-bold text-lg leading-tight">EdgeHomework</span>
                <span className="text-[10px] text-cyan-400/50 font-mono">Academic Support</span>
            </div>
          </button>
        </div>

        {/* Divider */}
        <div className="mx-6 my-4 h-px bg-gradient-to-r from-transparent via-gray-800 to-transparent"></div>

        {/* History Dropdown (Homework Only) */}
        <div className="flex-1 overflow-hidden flex flex-col px-4">
          <button 
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className="w-full flex items-center justify-between p-3 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all mb-2 group"
          >
            <div className="flex items-center gap-2">
              <History size={16} className="group-hover:text-cyan-400 transition-colors" />
              <span className="text-xs font-bold uppercase tracking-wider">Homework Log</span>
            </div>
            {isHistoryOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          <div className={`overflow-y-auto space-y-1 transition-all duration-300 ${isHistoryOpen ? 'max-h-[40vh] opacity-100' : 'max-h-0 opacity-0'}`}>
            {homeworkSessions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-600 italic font-mono border-l-2 border-gray-800 ml-2">No records found</div>
            ) : (
              homeworkSessions.map((session) => (
                <div 
                  key={session.id}
                  onClick={() => {
                    onSelectSession(session.id);
                    if (window.innerWidth < 1024) toggleSidebar();
                  }}
                  className={`group relative flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-all border-l-2 ml-2 ${
                    currentSessionId === session.id 
                      ? 'bg-cyan-900/20 border-cyan-500 text-white' 
                      : 'border-transparent hover:bg-white/5 hover:border-gray-600 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <span className="text-sm truncate pr-6 font-sans">{session.title}</span>
                  
                  <button 
                    onClick={(e) => onDeleteSession(session.id, e)}
                    className={`absolute right-2 p-1.5 rounded hover:bg-red-900 hover:text-red-400 transition-opacity ${currentSessionId === session.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 text-[10px] text-center text-gray-600 font-mono">
           Made by Thomas Etherington
        </div>
      </div>
    </>
  );
};