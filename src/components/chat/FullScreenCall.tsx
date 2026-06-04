'use client';
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function FullScreenCall({ onClose, onUserVoiceMessage, ananyaLatestResponse }: { onClose: () => void, onUserVoiceMessage: (text: string) => void, ananyaLatestResponse: string }) {
  const [callState, setCallState] = useState<'ringing' | 'connected'>('ringing');
  const [isListening, setIsListening] = useState(false);

  // Simulate Ananya picking up after 2.5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setCallState('connected');
      onUserVoiceMessage("Hey, I'm here. What's up?"); // Invisible trigger to get her first audio response
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // Native Speech API (Temporary placeholder until we wire ElevenLabs)
  useEffect(() => {
    if (callState === 'connected' && ananyaLatestResponse) {
      const utterance = new SpeechSynthesisUtterance(ananyaLatestResponse);
      const voices = window.speechSynthesis.getVoices();
      utterance.voice = voices.find(v => v.lang === 'en-IN' || v.lang === 'hi-IN') || voices[0];
      utterance.rate = 0.95;
      
      utterance.onend = () => startListening(); // Open user mic when she finishes speaking
      window.speechSynthesis.speak(utterance);
    }
  }, [ananyaLatestResponse, callState]);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-IN';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => onUserVoiceMessage(event.results[0][0].transcript);
    recognition.start();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: '100%' }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: '100%' }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-zinc-950 pb-12 pt-32"
    >
      <div className="flex flex-col items-center gap-8">
        <motion.div 
          animate={callState === 'connected' && !isListening ? { boxShadow: ["0px 0px 0px rgba(16, 185, 129, 0)", "0px 0px 60px rgba(16, 185, 129, 0.3)", "0px 0px 0px rgba(16, 185, 129, 0)"] } : {}}
          transition={{ repeat: Infinity, duration: 2 }}
          className="w-40 h-40 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden"
        >
          <img src="/ananya.png" alt="Ananya" className="w-full h-full object-cover rounded-full" />
        </motion.div>
        
        <div className="text-center">
          <h2 className="text-3xl font-semibold text-zinc-100">Ananya</h2>
          <p className="text-zinc-400 mt-3 text-lg">
            {callState === 'ringing' ? 'Ringing...' : isListening ? 'Listening...' : 'Connected'}
          </p>
        </div>
      </div>

      <button 
        onClick={() => {
          window.speechSynthesis.cancel();
          onClose();
        }}
        className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors shadow-lg"
      >
        <span className="text-white text-sm font-bold">End</span>
      </button>
    </motion.div>
  );
}
