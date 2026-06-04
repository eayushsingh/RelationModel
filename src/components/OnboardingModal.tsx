'use client';

import React, { useState } from 'react';
import { supabase } from '@lib/supabase';
import { Loader2, User, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface OnboardingModalProps {
  userId: string;
  onCompleted: () => void;
}

export default function OnboardingModal({ userId, onCompleted }: OnboardingModalProps) {
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedName = name.trim();
    const trimmedBio = bio.trim();

    if (!trimmedName) {
      setErrorMsg('Please enter your name.');
      return;
    }

    if (trimmedName.toLowerCase().startsWith('user_')) {
      setErrorMsg('Please choose a display name that does not start with "User_".');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: trimmedName,
          bio: trimmedBio,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;

      onCompleted();
    } catch (err: any) {
      console.error('Error updating profile during onboarding:', err);
      setErrorMsg(err.message || 'Failed to save onboarding details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
      {/* Background glow effects inside modal area */}
      <div className="absolute top-[20%] left-[20%] w-[30%] h-[30%] bg-purple-900/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[20%] w-[30%] h-[30%] bg-cyan-900/10 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="max-w-md w-full bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-8 backdrop-blur-md shadow-2xl relative z-10 space-y-6"
      >
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-100">
            Welcome to Ananya AI!
          </h2>
          <p className="text-xs text-zinc-400">
            Let Ananya know who you are so she can remember details about you.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="wait">
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-red-950/40 border border-red-900/60 text-red-400 text-xs px-4 py-3 rounded-xl flex items-start space-x-2 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
              >
                <span>⚠️</span>
                <span>{errorMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Name input */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">
              What is your name?
            </label>
            <div className="relative flex items-center">
              <User className="absolute left-4 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ayush"
                className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-xl pl-11 pr-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-700/80 focus:ring-1 focus:ring-zinc-700/20 transition-all"
                required
              />
            </div>
          </div>

          {/* Bio input */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">
              What do you do? / Tell me a bit about yourself
            </label>
            <div className="relative flex items-start">
              <FileText className="absolute left-4 top-3.5 w-4 h-4 text-zinc-500" />
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="e.g. First-year BTech student, loves coding, drinks black tea."
                rows={3}
                className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-xl pl-11 pr-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-700/80 focus:ring-1 focus:ring-zinc-700/20 transition-all resize-none"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full relative group inline-flex items-center justify-center p-0.5 mt-4 overflow-hidden text-sm font-semibold rounded-xl bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-500 hover:text-white focus:outline-none shadow-[0_0_20px_rgba(168,85,247,0.2)] hover:shadow-[0_0_25px_rgba(168,85,247,0.4)] disabled:opacity-50 transition-all duration-300"
          >
            <span className="w-full relative px-6 py-3.5 transition-all ease-in duration-75 bg-zinc-950 rounded-xl group-hover:bg-opacity-0 text-zinc-100 font-bold tracking-wide flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                  Saving details...
                </>
              ) : (
                "Get Started"
              )}
            </span>
          </button>
        </form>
      </motion.div>
    </div>
  );
}
