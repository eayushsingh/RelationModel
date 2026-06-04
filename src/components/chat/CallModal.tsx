'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, PhoneOff, Lock } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'listening' | 'processing' | 'speaking';

interface CallModalProps {
  userId: string;
  characterId: string;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CallModal({ userId, characterId, onClose }: CallModalProps) {
  const [phase, setPhase]     = useState<Phase>('idle');
  const [subtitle, setSubtitle] = useState('');

  // Single shared AudioContext — created ONLY inside a synchronous click handler
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Recording state
  const chunksRef   = useRef<Blob[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);

  // Conversation history — useRef (NOT useState) to avoid stale closure issues
  const conversationHistoryRef = useRef<{ role: string; content: string }[]>([]);

  // ── AudioContext — call ONLY from a synchronous user-gesture handler ────────
  function getAudioContext(): AudioContext {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }

  // ── PHASE: listening ──────────────────────────────────────────────────────
  async function startListening() {
    setPhase('listening');
    setSubtitle('');

    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = handleRecordingComplete;
      recorderRef.current = recorder;
      recorder.start(250);

      // Auto-stop after 5 seconds — prevents infinite listening if user is silent
      setTimeout(() => stopListening(), 5000);
    } catch (err) {
      console.error('[Mic] getUserMedia failed:', err);
      setPhase('idle');
      setSubtitle('Microphone access denied');
    }
  }

  function stopListening() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
      recorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
  }

  // ── PHASE: processing → speaking → back to listening ─────────────────────
  async function handleRecordingComplete() {
    setPhase('processing');

    const mimeType  = recorderRef.current?.mimeType || 'audio/webm';
    const extension = mimeType.includes('webm') ? 'webm' : 'mp4';
    const blob      = new Blob(chunksRef.current, { type: mimeType });

    // Too small = no real speech, retry immediately
    if (blob.size < 1000) {
      console.warn('[Recording] Blob too small, retrying...');
      startListening();
      return;
    }

    const file = new File([blob], `recording.${extension}`, { type: mimeType });
    const fd   = new FormData();
    fd.append('file',        file);
    fd.append('userId',      userId);
    fd.append('characterId', characterId);
    fd.append('history',     JSON.stringify(conversationHistoryRef.current));

    try {
      const res = await fetch('/api/chat/call', { method: 'POST', body: fd });

      if (!res.ok) {
        const errText = await res.text();
        console.error('[API] Route error:', errText);
        // Fall through to startListening() below
      } else {
        const data = await res.json();

        // Append to history ref
        if (data.userText) {
          conversationHistoryRef.current.push({ role: 'user', content: data.userText });
        }
        if (data.assistantText) {
          conversationHistoryRef.current.push({ role: 'assistant', content: data.assistantText });
          setSubtitle(data.assistantText);
        }

        // Play audio — AWAIT so mic never starts while she's speaking
        if (data.audioBase64) {
          setPhase('speaking');
          await playAudio(data.audioBase64);
        }
      }
    } catch (err) {
      console.error('[API] Fetch error:', err);
    }

    // Always called AFTER audio fully finishes (or on any error)
    startListening();
  }

  // ── Audio playback — Web Audio API only. No HTMLAudioElement. No new Audio(). ──
  async function playAudio(base64: string): Promise<void> {
    return new Promise(async (resolve) => {
      try {
        const ctx    = getAudioContext(); // reuses existing context — never creates new one here
        const binary = atob(base64);
        const bytes  = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        const decoded = await ctx.decodeAudioData(bytes.buffer.slice(0));
        const source  = ctx.createBufferSource();
        source.buffer = decoded;
        source.connect(ctx.destination);
        source.onended = () => resolve();
        source.start(0);
      } catch (err) {
        console.error('[Audio] decodeAudioData/play failed:', err);
        resolve(); // resolve anyway so state machine continues
      }
    });
  }

  // ── End call — hard stop everything ────────────────────────────────────────
  function handleEndCall() {
    stopListening();
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close();
    }
    onClose();
  }

  // ── Status text driven by phase ────────────────────────────────────────────
  const statusText: Record<Phase, string> = {
    idle:       'Tap mic to start',
    listening:  'Listening...',
    processing: 'Ananya is thinking...',
    speaking:   'Ananya is speaking...',
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] flex flex-col items-center justify-between bg-black/90 backdrop-blur-2xl text-zinc-100 py-16 px-6"
    >
      {/* ── Top ── */}
      <div className="flex flex-col items-center gap-3 text-center mt-8">
        <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-900/60 border border-zinc-800 rounded-full text-[10px] text-zinc-400 font-medium tracking-wide">
          <Lock className="w-3 h-3 text-emerald-500" />
          <span>End-to-End Encrypted</span>
        </div>
        <h2 className="text-2xl font-bold text-zinc-100 mt-2">Ananya</h2>
        <p className="text-sm font-medium tracking-wide text-zinc-400 min-h-[20px] max-w-xs px-4 transition-all duration-300">
          {statusText[phase]}
        </p>
        {subtitle && (
          <p className="text-xs text-zinc-500 max-w-xs px-4 italic leading-relaxed transition-all duration-500">
            {subtitle}
          </p>
        )}
      </div>

      {/* ── Avatar with phase-driven glow ── */}
      <div className="relative flex items-center justify-center my-auto">
        <AnimatePresence>
          {(phase === 'speaking' || phase === 'listening') && (
            <>
              <motion.div
                key="ring-outer"
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{ scale: 1.8, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeOut' }}
                className="absolute w-36 h-36 rounded-full border border-purple-500/30 pointer-events-none"
              />
              <motion.div
                key="ring-inner"
                initial={{ scale: 1, opacity: 0.4 }}
                animate={{ scale: 1.5, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ repeat: Infinity, duration: 2, delay: 0.6, ease: 'easeOut' }}
                className="absolute w-36 h-36 rounded-full border border-cyan-500/20 pointer-events-none"
              />
            </>
          )}
        </AnimatePresence>

        <div className={`relative w-36 h-36 rounded-full bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-500 p-[3px] transition-all duration-500 ${
          phase === 'speaking'
            ? 'shadow-[0_0_50px_rgba(168,85,247,0.7)] scale-105'
            : phase === 'listening'
            ? 'shadow-[0_0_30px_rgba(6,182,212,0.4)] scale-100'
            : 'shadow-[0_0_20px_rgba(168,85,247,0.15)] scale-100'
        }`}>
          <div className="w-full h-full rounded-full bg-zinc-950 flex items-center justify-center overflow-hidden">
            <img src="/ananya.png" alt="Ananya" className="w-full h-full object-cover rounded-full" />
          </div>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="flex items-center gap-8 mb-8">
        {/*
          IMPORTANT: getAudioContext() MUST be called synchronously inside onClick.
          The browser only grants AudioContext permission inside a direct user gesture.
          Do NOT move it to useEffect, async functions, or setTimeout.
        */}
        <button
          type="button"
          disabled={phase === 'processing' || phase === 'speaking'}
          onClick={() => {
            if (phase === 'idle') {
              getAudioContext(); // synchronous user-gesture unlock — MUST be first
              startListening();
            } else if (phase === 'listening') {
              stopListening(); // manual early stop
            }
          }}
          className={`w-12 h-12 rounded-full border transition-all duration-300 flex items-center justify-center focus:outline-none ${
            phase === 'idle'
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30 hover:scale-105'
              : phase === 'listening'
              ? 'bg-purple-500/30 border-purple-400/60 text-purple-300 animate-pulse'
              : 'bg-zinc-900/30 border-zinc-800/50 text-zinc-700 cursor-not-allowed'
          }`}
        >
          <Mic className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={handleEndCall}
          className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 hover:scale-105 active:scale-95 text-white flex items-center justify-center transition-all focus:outline-none shadow-lg shadow-red-900/30 hover:shadow-red-500/30"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </motion.div>
  );
}
