import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, X, Radio } from 'lucide-react';
import { GoogleGenAI, Modality } from '@google/genai';

interface LiveVoiceModeProps {
  onClose: () => void;
}

export const LiveVoiceMode: React.FC<LiveVoiceModeProps> = ({ onClose }) => {
  const [status, setStatus] = useState<'connecting' | 'active' | 'error'>('connecting');
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cleanup = false;

    // Re-implementing connection here to fully control callbacks as per SDK requirements
    const initDirectConnection = async () => {
         try {
             const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
             streamRef.current = stream;
             
             const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
             
             const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
             audioContextRef.current = audioCtx; // Store it to close later
             const source = audioCtx.createMediaStreamSource(stream);
             const processor = audioCtx.createScriptProcessor(4096, 1, 1);
             
             processor.onaudioprocess = (e) => {
                if (isMuted || cleanup) return; // Check cleanup
                const inputData = e.inputBuffer.getChannelData(0);
                
                // Volume for visualizer
                let sum = 0;
                for(let i=0; i<inputData.length; i++) sum += inputData[i]*inputData[i];
                setVolume(Math.min(1, Math.sqrt(sum/inputData.length) * 5));
    
                const l = inputData.length;
                const int16 = new Int16Array(l);
                for (let i = 0; i < l; i++) { int16[i] = inputData[i] * 32768; }
                
                // Encode to base64
                let binary = '';
                const bytes = new Uint8Array(int16.buffer);
                const len = bytes.byteLength;
                for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                const base64Data = btoa(binary);
                
                sessionPromise.then(session => {
                    session.sendRealtimeInput({ media: { mimeType: 'audio/pcm;rate=16000', data: base64Data }});
                });
             };
             
             source.connect(processor);
             processor.connect(audioCtx.destination);
    
             const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
             let nextStartTime = 0;
    
             const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
                    systemInstruction: "You are Edgerington. Mean, smart, calls people buddy. Helpful but rude."
                },
                callbacks: {
                    onopen: () => setStatus('active'),
                    onmessage: async (msg: any) => {
                        const data = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (data) {
                            const binary = atob(data);
                            const bytes = new Uint8Array(binary.length);
                            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                            
                            const dataInt16 = new Int16Array(bytes.buffer);
                            const audioBuffer = outputCtx.createBuffer(1, dataInt16.length, 24000);
                            const channelData = audioBuffer.getChannelData(0);
                            for(let i=0; i<dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
                            
                            const src = outputCtx.createBufferSource();
                            src.buffer = audioBuffer;
                            src.connect(outputCtx.destination);
                            
                            const now = outputCtx.currentTime;
                            const start = Math.max(now, nextStartTime);
                            src.start(start);
                            nextStartTime = start + audioBuffer.duration;
                        }
                    }
                }
             });
             
             sessionRef.current = await sessionPromise;
         } catch(e) {
             console.error(e);
             setStatus('error');
         }
    };

    initDirectConnection();

    return () => {
      cleanup = true;
      sessionRef.current?.close();
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioContextRef.current?.close();
    };
  }, [isMuted]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center text-white overflow-hidden">
      {/* Background Animation */}
      <div className="absolute inset-0 bg-gradient-to-b from-red-900/20 to-black pointer-events-none"></div>
      <div className={`absolute w-96 h-96 bg-red-600 rounded-full blur-[150px] opacity-30 transition-all duration-100 transform scale-${100 + Math.floor(volume * 50)}`}></div>

      <button onClick={onClose} className="absolute top-6 right-6 p-4 hover:bg-white/10 rounded-full transition-colors z-20">
        <X size={32} />
      </button>

      <div className="relative z-10 flex flex-col items-center gap-12">
         <div className="flex flex-col items-center gap-4">
            <div className="relative">
                <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center transition-all duration-300 ${status === 'active' ? 'border-red-500 shadow-[0_0_50px_rgba(220,38,38,0.5)]' : 'border-gray-700'}`}>
                    <Radio size={48} className={status === 'active' ? 'text-red-500 animate-pulse' : 'text-gray-500'} />
                </div>
                {/* Visualizer Rings */}
                {status === 'active' && (
                    <>
                        <div className="absolute inset-0 rounded-full border border-red-500/50 animate-ping" style={{ animationDuration: '2s' }}></div>
                        <div className="absolute inset-0 rounded-full border border-red-500/30 animate-ping" style={{ animationDuration: '3s', animationDelay: '0.5s' }}></div>
                    </>
                )}
            </div>
            
            <div className="text-center">
                <h2 className="text-3xl font-display font-bold tracking-wider mb-1">EDGE VOICE</h2>
                <p className="text-red-400 font-mono text-sm uppercase tracking-widest">
                    {status === 'connecting' ? 'INITIALIZING LINK...' : status === 'error' ? 'CONNECTION FAILED' : 'LIVE CONNECTION ESTABLISHED'}
                </p>
            </div>
         </div>

         <div className="flex items-center gap-8">
            <button 
                onClick={() => setIsMuted(!isMuted)}
                className={`p-6 rounded-full transition-all ${isMuted ? 'bg-gray-800 text-red-500' : 'bg-white text-black hover:scale-110'}`}
            >
                {isMuted ? <MicOff size={32} /> : <Mic size={32} />}
            </button>
         </div>
      </div>
      
      <div className="absolute bottom-10 text-white/20 font-mono text-xs">
        POWERED BY GEMINI LIVE API
      </div>
    </div>
  );
};