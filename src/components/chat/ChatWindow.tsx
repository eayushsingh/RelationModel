'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Paperclip, Phone } from 'lucide-react';
import CallModal from './CallModal';
import { supabase } from '@lib/supabase';

// Helper functions to synthesize premium UI sounds using browser Web Audio API
const playSentSound = () => {
  if (typeof window === 'undefined') return;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return;
  try {
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.07);
    
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.07);
  } catch (e) {
    // Ignore context blocked errors
  }
};

const playReceivedSound = () => {
  if (typeof window === 'undefined') return;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return;
  try {
    const ctx = new AudioCtx();
    
    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      
      gain.gain.setValueAtTime(0.03, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };
    
    playTone(520, 0, 0.12);
    playTone(660, 0.08, 0.18);
  } catch (e) {
    // Ignore context blocked errors
  }
};

const playKeyClick = () => {
  if (typeof window === 'undefined') return;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return;
  try {
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = 'triangle';
    const freq = 1600 + Math.random() * 500;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    
    gain.gain.setValueAtTime(0.004, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.015);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.015);
  } catch (e) {
    // Ignore context blocked errors
  }
};

interface Message {
  id: string;
  sender_type: 'user' | 'ai';
  content: string;
  image?: string;
}

interface ChatWindowProps {
  userId: string;
  characterId: string;
  onRelationshipUpdate?: () => void;
  onAvatarClick?: (url?: string) => void;
}

export default function ChatWindow({ userId, characterId, onRelationshipUpdate, onAvatarClick }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender_type: 'ai',
      content: 'Hey! Glad you reached out. Coffee is brewed and I am just sitting here debugging some React code. What are you up to today?',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [activeSpeechText, setActiveSpeechText] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadWithProgress = (file: File, filePath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qjfasplmpgcbgymiuaym.supabase.co';
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

      const baseUrl = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
      const uploadUrl = `${baseUrl}/storage/v1/object/chat-attachments/${filePath}`;

      xhr.open('POST', uploadUrl, true);
      xhr.setRequestHeader('apikey', anonKey);
      xhr.setRequestHeader('Authorization', `Bearer ${anonKey}`);
      xhr.setRequestHeader('Content-Type', file.type);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percentComplete);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const publicUrl = `${baseUrl}/storage/v1/object/public/chat-attachments/${filePath}`;
          resolve(publicUrl);
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during upload'));
      };

      xhr.send(file);
    });
  };

  const processAndUploadFile = async (file: File) => {
    if (!file) return;

    // Show immediate preview locally using FileReader
    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);

    setIsUploading(true);
    setUploadProgress(0);

    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
    const filePath = `chat-uploads/${fileName}`;

    try {
      const publicUrl = await uploadWithProgress(file, filePath);
      setSelectedImage(publicUrl);
    } catch (err: any) {
      console.warn('Supabase storage upload failed, falling back to base64 Data URL:', err);
      // FileReader onloadend will execute and set Base64 URL fallback
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processAndUploadFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processAndUploadFile(file);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Extract the latest response from Ananya
  const latestAIMessage = [...messages]
    .reverse()
    .find((msg) => msg.sender_type === 'ai')?.content || '';

  // Auto-scroll logic
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Periodic typing clicks when AI is preparing a response
  useEffect(() => {
    let timeout: any;
    if (isTyping) {
      const playRandomClick = () => {
        playKeyClick();
        const nextDelay = 80 + Math.random() * 120;
        timeout = setTimeout(playRandomClick, nextDelay);
      };
      playRandomClick();
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [isTyping]);

  // Load chat history from DB on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await fetch(`/api/chat?userId=${userId}&characterId=${characterId}`);
        if (!response.ok) throw new Error('Failed to fetch chat history');
        const data = await response.json();
        if (data && data.length > 0) {
          const mappedMessages = data.map((msg: any) => ({
            id: msg.id,
            sender_type: msg.sender_type,
            content: msg.content,
          }));
          setMessages(mappedMessages);
        }
      } catch (err) {
        console.warn('Could not load chat history, keeping defaults:', err);
      }
    };

    loadHistory();
  }, [userId, characterId]);

  const sendMessageText = async (text: string, imageBase64?: string) => {
    if (!text.trim() && !imageBase64) return;

    setActiveSpeechText('');

    // Append user message locally
    const newUserMessage: Message = {
      id: Date.now().toString(),
      sender_type: 'user',
      content: text,
      image: imageBase64,
    };
    setMessages((prev) => [...prev, newUserMessage]);
    playSentSound();
    setIsTyping(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, characterId, message: text, image: imageBase64 }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch from chat API');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('ReadableStream reader not available');

      setIsTyping(false);

      // Create an empty AI message placeholder
      const aiMessageId = (Date.now() + 1).toString();
      setMessages((prev) => [
        ...prev,
        { id: aiMessageId, sender_type: 'ai', content: '' },
      ]);

      const decoder = new TextDecoder();
      let accumulatedContent = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') {
              break;
            }
            try {
              const data = JSON.parse(jsonStr);
              if (data.content) {
                accumulatedContent += data.content;
                playKeyClick();
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === aiMessageId ? { ...msg, content: accumulatedContent } : msg
                  )
                );
              }
            } catch (e) {
              // Ignore errors from partial stream lines
            }
          }
        }
      }

      playReceivedSound();
      setActiveSpeechText(accumulatedContent);

      // Trigger relationship metric update check in parent component
      if (onRelationshipUpdate) {
        // Delay slightly to give background worker time to finish evaluations
        setTimeout(onRelationshipUpdate, 2000);
      }
    } catch (err) {
      console.error(err);
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender_type: 'ai',
          content: 'Hey, sorry, but my connection got interrupted. Make sure your database and env variables in .env.local are configured correctly, then let\'s try again!',
        },
      ]);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !selectedImage) return;

    const userMsg = inputText.trim();
    const imageToSend = selectedImage || undefined;

    setInputText('');
    setSelectedImage(null);

    await sendMessageText(userMsg, imageToSend);
  };

  const handleUserVoiceMessage = async (text: string) => {
    await sendMessageText(text);
  };

  const setIsImageOpen = (url: string) => {
    onAvatarClick?.(url);
  };

  const renderMessageContent = (msg: Message) => {
    const text = msg.content;
    if (msg.sender_type === 'ai') {
      const parts = text.split(/(\[IMG_\d+\])/g);
      return (
        <div className="space-y-2">
          {parts.map((part, index) => {
            const match = part.match(/\[IMG_(\d+)\]/);
            if (match) {
              const imgNumber = match[1];
              const imagePath = `/ananya-${imgNumber}.png`;
              return (
                <img
                  key={index}
                  src={imagePath}
                  alt="Ananya"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.onerror = null; // Prevent infinite fallback loops
                    target.src = '/ananya.png'; // The guaranteed safe default image
                  }}
                  className="w-48 sm:w-64 aspect-auto rounded-xl shadow-lg my-3 border border-white/10 cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setIsImageOpen(imagePath)}
                  loading="lazy"
                />
              );
            }
            return <span key={index} className="whitespace-pre-wrap">{part}</span>;
          })}
        </div>
      );
    } else {
      const userImageRegex = /^\[USER_IMAGE:\s*(\S+?)\]\s*([\s\S]*)$/;
      const match = text ? text.match(userImageRegex) : null;
      if (match) {
        const imageUrl = match[1];
        const textContent = match[2] || '';
        return (
          <div className="space-y-2">
            <img
              src={imageUrl}
              alt="User Upload"
              className="max-w-full max-h-64 object-cover rounded-xl my-1 border border-white/10 cursor-pointer hover:opacity-90 active:scale-95 transition-all"
              onClick={() => onAvatarClick?.(imageUrl)}
              loading="lazy"
            />
            {textContent && <p className="whitespace-pre-wrap">{textContent}</p>}
          </div>
        );
      }
    }

    return (
      <div className="space-y-2">
        {msg.image && (
          <img
            src={msg.image}
            alt="User Upload"
            className="max-w-full max-h-64 object-cover rounded-xl my-1 border border-white/10 cursor-pointer hover:opacity-90 active:scale-95 transition-all"
            onClick={() => onAvatarClick?.(msg.image)}
            loading="lazy"
          />
        )}
        <p className="whitespace-pre-wrap">{text}</p>
      </div>
    );
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex flex-col h-[calc(100vh-2rem)] md:h-screen w-full bg-zinc-950/20 backdrop-blur-sm rounded-2xl md:rounded-none overflow-hidden relative"
    >
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-purple-950/40 backdrop-blur-md z-50 flex flex-col items-center justify-center border-2 border-dashed border-purple-500/50 m-4 rounded-2xl pointer-events-none"
          >
            <div className="p-4 bg-zinc-900/80 rounded-2xl border border-white/10 flex flex-col items-center shadow-2xl scale-100 animate-pulse">
              <span className="text-4xl mb-2">📥</span>
              <p className="text-sm font-semibold text-zinc-100">Drop image to upload</p>
              <p className="text-xs text-zinc-400 mt-1">Supports PNG, JPG, JPEG, WebP</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-6 py-4 bg-zinc-900/10 border-b border-zinc-800/40 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onAvatarClick?.('/ananya.png')}
            className="transition-transform active:scale-95 relative w-10 h-10 rounded-full bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-500 p-[2px] shadow-[0_0_15px_rgba(168,85,247,0.2)] focus:outline-none"
          >
            <div className="w-full h-full rounded-full bg-zinc-950 flex items-center justify-center overflow-hidden">
              <img src="/ananya.png" alt="Ananya" className="w-full h-full object-cover rounded-full" />
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-zinc-950 flex items-center justify-center border border-zinc-800">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
            </div>
          </button>
          <div>
            <h2 className="text-sm md:text-base font-semibold text-zinc-100 flex items-center gap-1.5">
              Ananya
            </h2>
            <p className="text-[10px] md:text-xs text-zinc-400">Mumbai • Online</p>
          </div>
        </div>

        <button
          onClick={() => setIsCalling(true)}
          className="p-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-full text-zinc-400 hover:text-zinc-200 transition-all shadow-md focus:outline-none flex items-center justify-center cursor-pointer"
          title="Call Ananya"
        >
          <Phone className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Window */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className={`flex ${msg.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`text-sm leading-relaxed tracking-wide ${
                  msg.sender_type === 'user'
                    ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg shadow-purple-900/20 rounded-2xl rounded-tr-sm px-5 py-3 max-w-[75%] md:max-w-[60%]'
                    : 'bg-[#1E1E24] border border-white/5 text-gray-200 rounded-2xl rounded-tl-sm px-5 py-3 shadow-sm max-w-[75%] md:max-w-[60%]'
                }`}
              >
                {renderMessageContent(msg)}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center space-x-1.5 shadow-lg shadow-black/25">
              <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input panel */}
      <div className="p-4 md:p-6 bg-zinc-950/40 border-t border-zinc-800/40 flex-shrink-0">
        <form onSubmit={handleSendMessage} className="flex flex-col">
          {selectedImage && (
            <div className="relative mb-3 inline-block self-start group">
              <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-zinc-800 shadow-md">
                <img
                  src={selectedImage}
                  alt="Preview"
                  className={`w-full h-full object-cover transition-opacity duration-200 ${isUploading ? 'opacity-50' : 'opacity-100'}`}
                />
                {isUploading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 backdrop-blur-[1px]">
                    <div className="w-6 h-6 rounded-full border-2 border-zinc-700 border-t-purple-500 animate-spin mb-1" />
                    <span className="text-[9px] font-semibold text-zinc-200">{uploadProgress}%</span>
                  </div>
                )}
              </div>
              {!isUploading && (
                <button
                  type="button"
                  onClick={() => setSelectedImage(null)}
                  className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-0.5 text-xs hover:bg-red-500 w-5 h-5 flex items-center justify-center border border-zinc-950 focus:outline-none transition-all duration-200 active:scale-90 shadow-lg"
                >
                  ✕
                </button>
              )}
            </div>
          )}
          <div className="relative flex items-center">
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageChange}
              className="hidden"
              disabled={isUploading}
            />
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="absolute left-3.5 p-2 text-zinc-500 hover:text-zinc-300 transition-all focus:outline-none disabled:opacity-40 z-10 cursor-pointer"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type your message..."
              className="w-full bg-zinc-900/40 border border-zinc-800/80 rounded-xl pl-12 pr-14 py-3.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700/80 focus:ring-1 focus:ring-zinc-700/20 transition-all backdrop-blur-md"
              disabled={isUploading}
            />
            <button
              type="submit"
              disabled={(!inputText.trim() && !selectedImage) || isUploading}
              className="absolute right-2.5 p-2 rounded-lg bg-zinc-100 text-zinc-950 hover:bg-zinc-200 focus:outline-none disabled:opacity-40 disabled:hover:bg-zinc-100 transition-all shadow-md shadow-black/10 z-10 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {isCalling && (
        <CallModal
          userId={userId}
          characterId={characterId}
          onClose={() => {
            setIsCalling(false);
            if (onRelationshipUpdate) {
              onRelationshipUpdate();
            }
            // Reload message log to show call transcript
            fetch(`/api/chat?userId=${userId}&characterId=${characterId}`)
              .then(res => res.json())
              .then(data => {
                if (data && data.length > 0) {
                  setMessages(data.map((msg: any) => ({
                    id: msg.id,
                    sender_type: msg.sender_type,
                    content: msg.content,
                  })));
                }
              })
              .catch(err => console.warn('History reload failed:', err));
          }}
        />
      )}
    </div>
  );
}
