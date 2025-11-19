import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { MessageBubble } from './components/MessageBubble';
import { LiveVoiceMode } from './components/LiveVoiceMode';
import { Message, Role, ChatSession, Suggestion, ChatMode, Attachment } from './types';
import { geminiService } from './services/geminiService';
import { Chat } from '@google/genai';
import { Send, Menu, ArrowUp, Sparkles, Zap, Code, PenTool, BookOpen, Rocket, Image as ImageIcon, Mic, Paperclip, X, Bot } from 'lucide-react';

const HOMEWORK_SUGGESTIONS: Suggestion[] = [
  { label: 'Code Helper', prompt: 'Write a Python script to scrape a website for news headlines.', icon: <Code size={18} /> },
  { label: 'Creative Writing', prompt: 'Write a short sci-fi story about a robot discovering emotions.', icon: <PenTool size={18} /> },
  { label: 'Explain Concept', prompt: 'Explain quantum computing to a 10-year-old.', icon: <Zap size={18} /> },
  { label: 'Brainstorming', prompt: 'Give me 5 unique marketing ideas for a coffee shop.', icon: <Rocket size={18} /> },
];

type ViewState = 'home' | 'chat' | 'voice';

const App: React.FC = () => {
  // --- State ---
  const [view, setView] = useState<ViewState>('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isImageGenMode, setIsImageGenMode] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | undefined>(undefined);
  
  // Chat Instance Reference
  const chatInstance = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Effects ---

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  // --- Handlers ---

  const createNewChat = useCallback((mode: ChatMode) => {
    const newId = Date.now().toString();
    const newSession: ChatSession = {
      id: newId,
      title: 'New Chat',
      lastMessageTime: Date.now(),
      mode: mode
    };
    
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newId);
    setMessages([]);
    setInputValue('');
    setAttachment(undefined);
    setIsImageGenMode(false);
    chatInstance.current = geminiService.createChat(mode);
    setView('chat');
    setIsSidebarOpen(false);
  }, []);

  const handleSelectSession = (id: string) => {
    const session = sessions.find(s => s.id === id);
    if (!session) return;

    setCurrentSessionId(id);
    setMessages([]); // In a real app, load from storage
    setAttachment(undefined);
    
    chatInstance.current = geminiService.createChat(session.mode);
    setView('chat');
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) {
      setView('home');
      setCurrentSessionId(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setAttachment({
            mimeType: file.type,
            data: base64String,
            name: file.name
        });
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async (text: string = inputValue) => {
    const prompt = text.trim();
    if ((!prompt && !attachment) || isLoading) return;
    if (!prompt && isImageGenMode) return; // Image gen needs prompt

    const userMsgId = Date.now().toString();
    const userMsg: Message = { 
        id: userMsgId, 
        role: Role.User, 
        text: prompt, 
        timestamp: Date.now(),
        attachment: attachment
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setAttachment(undefined);
    setIsLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    // Update title if first message
    if (messages.length === 0 && currentSessionId) {
        setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, title: prompt.slice(0, 30) } : s));
    }

    // --- Image Generation Path ---
    if (isImageGenMode) {
        const botMsgId = (Date.now() + 1).toString();
        setMessages(prev => [...prev, { id: botMsgId, role: Role.Model, text: 'Generating image...', timestamp: Date.now(), isThinking: true }]);
        
        try {
            const imageBase64 = await geminiService.generateImage(prompt);
            setMessages(prev => prev.map(msg => 
                msg.id === botMsgId 
                  ? { ...msg, text: '', generatedImage: imageBase64, isThinking: false } 
                  : msg
              ));
        } catch (e) {
            setMessages(prev => prev.map(msg => msg.id === botMsgId ? { ...msg, text: "Image generation failed.", isThinking: false } : msg));
        } finally {
            setIsLoading(false);
            setIsImageGenMode(false);
        }
        return;
    }

    // --- Standard Chat Path ---
    if (!chatInstance.current) return;

    const botMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: botMsgId, role: Role.Model, text: '', timestamp: Date.now(), isThinking: true }]);

    try {
      const stream = geminiService.sendMessageStream(chatInstance.current, prompt, userMsg.attachment);
      let accumulatedText = '';
      
      for await (const chunk of stream) {
        accumulatedText += chunk.text || '';
        
        // Check for grounding (search results) or executable code
        const grounding = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks as any[];
        const exeCode = chunk.candidates?.[0]?.content?.parts?.find(p => p.executableCode)?.executableCode;
        const exeResult = chunk.candidates?.[0]?.content?.parts?.find(p => p.codeExecutionResult)?.codeExecutionResult;

        setMessages(prev => prev.map(msg => 
          msg.id === botMsgId 
            ? { 
                ...msg, 
                text: accumulatedText, 
                isThinking: false,
                groundingChunks: grounding || msg.groundingChunks,
                executableCode: exeCode ? { code: exeCode.code, language: exeCode.language } : msg.executableCode,
                codeExecutionResult: exeResult ? { outcome: exeResult.outcome, output: exeResult.output } : msg.codeExecutionResult
              } 
            : msg
        ));
      }
    } catch (error) {
      setMessages(prev => prev.map(msg => 
        msg.id === botMsgId 
          ? { ...msg, text: "Error connecting to server...", isThinking: false } 
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const isHomeworkMode = currentSession?.mode === 'homework';
  const themeColor = isHomeworkMode ? 'cyan' : 'red';

  // --- Conditional Renders ---

  if (view === 'voice') {
      return <LiveVoiceMode onClose={() => setView('home')} />;
  }

  return (
    <div className={`flex h-screen w-full bg-[#f0f2f5] overflow-hidden font-sans text-gray-900 relative selection:text-white ${isHomeworkMode ? 'selection:bg-cyan-500' : 'selection:bg-red-500'}`}>
      
      {/* Abstract Background Elements */}
      <div className={`absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-br blur-[100px] pointer-events-none opacity-50 transition-colors duration-1000 ${isHomeworkMode ? 'from-cyan-200/40' : 'from-red-200/40'} to-transparent`}></div>
      <div className={`absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-gradient-to-tr blur-[80px] pointer-events-none opacity-50 transition-colors duration-1000 ${isHomeworkMode ? 'from-blue-300/30' : 'from-red-300/30'} to-transparent`}></div>

      <Sidebar 
        isOpen={isSidebarOpen} 
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onNewChat={createNewChat}
        onGoHome={() => { setView('home'); setCurrentSessionId(null); }}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
      />

      <main className="flex-1 flex flex-col relative h-full z-10">
        
        {/* Mobile Header */}
        <header className="h-16 px-4 flex items-center justify-between lg:hidden bg-white/80 backdrop-blur-md border-b border-white/50 z-20 sticky top-0">
          <div className="flex items-center gap-2">
            <button onClick={() => setIsSidebarOpen(true)} className={`p-2 -ml-2 text-gray-600 rounded-lg transition-colors ${isHomeworkMode ? 'hover:bg-cyan-50 hover:text-cyan-600' : 'hover:bg-red-50 hover:text-red-600'}`}>
              <Menu size={24} />
            </button>
            <span className="font-display font-bold text-gray-800 tracking-wide">
              {isHomeworkMode ? 'EdgeHomework' : 'EdgeChat'}
            </span>
          </div>
        </header>

        {/* View: Home Page */}
        {view === 'home' && (
             <div className="flex-1 flex flex-col items-center justify-center p-6 animate-float" style={{ animationDuration: '5s' }}>
                <div className="relative group mb-8">
                    <div className="absolute inset-0 bg-red-600 blur-[60px] opacity-20 group-hover:opacity-40 transition-opacity duration-500 rounded-full"></div>
                    <div className="w-32 h-32 md:w-40 md:h-40 bg-gradient-to-br from-gray-900 to-black rounded-[2.5rem] flex items-center justify-center shadow-2xl relative z-10 border border-red-900/30">
                        <span className="text-7xl md:text-8xl font-display font-bold text-white tracking-tighter drop-shadow-lg">E</span>
                    </div>
                </div>
                
                <div className="text-center space-y-4 mb-12">
                    <h1 className="text-6xl md:text-7xl font-display font-bold text-gray-900 tracking-tighter">
                        EDGE<span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-rose-700">AI</span>
                    </h1>
                    <div className="inline-block px-4 py-1 rounded-full bg-black/5 border border-black/10">
                        <p className="font-mono text-xs md:text-sm tracking-[0.2em] text-gray-600 uppercase">
                            Version 67: Goon
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl">
                    <button onClick={() => createNewChat('persona')} className="p-6 bg-white rounded-2xl shadow-sm border border-red-100 hover:border-red-500 hover:shadow-neon transition-all group flex flex-col items-center gap-3">
                        <Bot size={32} className="text-red-500 group-hover:scale-110 transition-transform" />
                        <span className="font-display font-bold text-xl text-gray-800">EdgeChat</span>
                        <span className="text-xs text-gray-400">Standard Model</span>
                    </button>
                    
                    <button onClick={() => createNewChat('homework')} className="p-6 bg-white rounded-2xl shadow-sm border border-cyan-100 hover:border-cyan-500 hover:shadow-[0_0_20px_rgba(6,182,212,0.2)] transition-all group flex flex-col items-center gap-3">
                        <BookOpen size={32} className="text-cyan-500 group-hover:scale-110 transition-transform" />
                        <span className="font-display font-bold text-xl text-gray-800">Homework</span>
                        <span className="text-xs text-gray-400">Academic Mode</span>
                    </button>

                    <button onClick={() => setView('voice')} className="p-6 bg-gray-900 rounded-2xl shadow-lg hover:shadow-2xl transition-all group flex flex-col items-center gap-3 relative overflow-hidden">
                         <div className="absolute inset-0 bg-gradient-to-br from-red-900/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <Mic size={32} className="text-white relative z-10 group-hover:scale-110 transition-transform" />
                        <span className="font-display font-bold text-xl text-white relative z-10">Voice Mode</span>
                        <span className="text-xs text-gray-400 relative z-10">Live Audio</span>
                    </button>
                </div>
             </div>
        )}

        {/* View: Chat */}
        {view === 'chat' && (
            <>
                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 scroll-smooth relative">
                <div className="max-w-4xl mx-auto min-h-full flex flex-col">
                    
                    {messages.length === 0 ? (
                    /* Empty Chat State */
                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 py-10 animate-float" style={{ animationDuration: '4s' }}>
                        {isHomeworkMode ? (
                        <>
                            <div className="w-20 h-20 bg-white border border-cyan-200 rounded-2xl flex items-center justify-center shadow-glass mb-4">
                                <BookOpen size={40} className="text-cyan-500" />
                            </div>
                            <h2 className="text-3xl font-display font-bold text-gray-800">Edge<span className="text-cyan-600">Homework</span></h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl mt-6">
                            {HOMEWORK_SUGGESTIONS.map((s, i) => (
                                <button 
                                key={i}
                                onClick={() => handleSend(s.prompt)}
                                className="flex items-center gap-4 p-4 text-left bg-white/60 backdrop-blur-sm border border-white/60 hover:border-cyan-300 hover:bg-white rounded-xl transition-all shadow-sm group"
                                >
                                <div className="p-2 bg-cyan-50 rounded-lg text-cyan-500 group-hover:text-white group-hover:bg-cyan-500 transition-colors">
                                    {s.icon}
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold text-gray-700 text-sm">{s.label}</span>
                                    <span className="text-xs text-gray-500 truncate max-w-[150px]">{s.prompt}</span>
                                </div>
                                </button>
                            ))}
                            </div>
                        </>
                        ) : (
                            <>
                                <div className="w-20 h-20 bg-black rounded-2xl flex items-center justify-center shadow-neon mb-4">
                                    <span className="text-white font-display font-bold text-3xl">E</span>
                                </div>
                                <h2 className="text-3xl font-display font-bold text-gray-800">Edgerington</h2>
                                <p className="text-sm font-mono text-gray-400 uppercase tracking-widest">V-67: Goon</p>
                            </>
                        )}
                    </div>
                    ) : (
                    /* Message List */
                    <div className="flex-1 pb-4">
                        {messages.map((msg) => (
                             <MessageBubble key={msg.id} message={msg} themeColor={themeColor} />
                        ))}
                        <div ref={messagesEndRef} className="h-4" />
                    </div>
                    )}

                </div>
                </div>

                {/* Input Area */}
                <div className="p-4 md:p-6 bg-transparent relative">
                <div className="max-w-3xl mx-auto relative">
                    
                    {/* Attachment Preview */}
                    {attachment && (
                         <div className="absolute -top-16 left-4 p-2 bg-white rounded-xl shadow-lg border border-gray-200 flex items-center gap-3 animate-float" style={{animationDuration:'3s'}}>
                             {attachment.mimeType.startsWith('image/') ? (
                                 <img src={`data:${attachment.mimeType};base64,${attachment.data}`} className="w-10 h-10 object-cover rounded-lg" alt="preview" />
                             ) : (
                                 <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center"><Paperclip size={20}/></div>
                             )}
                             <span className="text-xs font-mono max-w-[150px] truncate">{attachment.name}</span>
                             <button onClick={() => setAttachment(undefined)} className="hover:text-red-500"><X size={14}/></button>
                         </div>
                    )}

                    {/* Floating Glass Capsule */}
                    <div className={`relative flex items-end gap-2 p-2 bg-white/80 backdrop-blur-xl border rounded-[2rem] transition-all duration-300 shadow-lg ${
                        isHomeworkMode 
                        ? 'border-gray-200 focus-within:border-cyan-400 focus-within:shadow-[0_0_20px_rgba(6,182,212,0.2)]' 
                        : `border-red-100 focus-within:border-red-400 focus-within:shadow-neon ${isImageGenMode ? 'ring-2 ring-purple-500 border-purple-500' : ''}`
                    }`}>
                    
                    {/* Left Actions */}
                    <div className="flex items-center pb-2 pl-2 gap-1">
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                        <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-black/5 rounded-full transition-colors" title="Attach file">
                            <Paperclip size={20} />
                        </button>
                        
                        <button 
                            onClick={() => setIsImageGenMode(!isImageGenMode)}
                            className={`p-2 rounded-full transition-all ${isImageGenMode ? 'bg-purple-100 text-purple-600' : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'}`}
                            title="Generate Image Mode"
                        >
                            <ImageIcon size={20} />
                        </button>
                    </div>

                    <textarea
                        ref={textareaRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
                        placeholder={isImageGenMode ? "Describe image to generate..." : (isHomeworkMode ? "Ask assignment question..." : "Message Edgerington...")}
                        className="w-full bg-transparent border-0 focus:ring-0 resize-none py-3 px-2 max-h-[200px] min-h-[52px] text-gray-800 placeholder-gray-400 font-sans"
                        rows={1}
                    />
                    
                    <button
                        onClick={() => handleSend()}
                        disabled={(!inputValue.trim() && !attachment) || isLoading}
                        className={`mb-1 p-3 rounded-full flex-shrink-0 transition-all duration-300 ${
                        (inputValue.trim() || attachment) && !isLoading
                            ? isHomeworkMode 
                                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg' 
                                : isImageGenMode
                                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg'
                                    : 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg hover:shadow-neon'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            isImageGenMode ? <Sparkles size={20} /> : <ArrowUp size={20} strokeWidth={3} />
                        )}
                    </button>
                    </div>
                    <p className="text-center text-[10px] text-gray-400 mt-3 font-mono tracking-wide uppercase opacity-60">
                    Powered by Edge AI
                    </p>
                </div>
                </div>
            </>
        )}

      </main>
    </div>
  );
};

export default App;