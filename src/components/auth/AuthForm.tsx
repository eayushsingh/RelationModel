'use client';

import React, { useState } from 'react';
import { supabase } from '@lib/supabase';
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AuthForm() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Validate inputs
  const validateForm = () => {
    if (!email) {
      setErrorMsg('Email address is required.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMsg('Please enter a valid email address.');
      return false;
    }
    if (!password) {
      setErrorMsg('Password is required.');
      return false;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!validateForm()) return;

    setLoading(true);

    try {
      if (isSignUp) {
        // Sign Up with Supabase Auth
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        if (data.session) {
          setSuccessMsg('Account created successfully! Welcome.');
        } else {
          setSuccessMsg('Registration successful! Please check your email for verification instructions.');
        }
      } else {
        // Sign In with Supabase Auth
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        setSuccessMsg('Signed in successfully.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-zinc-950 text-zinc-100 min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background glow effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-900/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-8 backdrop-blur-md relative group shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
      >
        <div className="flex flex-col items-center space-y-4 mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-500 p-[3px] shadow-[0_0_20px_rgba(168,85,247,0.3)]">
            <div className="w-full h-full rounded-full bg-zinc-950 flex items-center justify-center overflow-hidden">
              <span className="text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-tr from-pink-400 via-purple-400 to-cyan-400">
                A
              </span>
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-zinc-50 to-zinc-400">
              Ananya AI
            </h1>
            <p className="text-xs text-zinc-400 mt-2 font-medium">
              Join the future of dynamic emotional companionship
            </p>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="grid grid-cols-2 gap-1 bg-zinc-950/60 p-1.5 rounded-xl border border-zinc-900/80 mb-6">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(false);
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${
              !isSignUp
                ? 'bg-zinc-800 text-zinc-100 shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(true);
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${
              isSignUp
                ? 'bg-zinc-800 text-zinc-100 shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Create Account
          </button>
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

            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-emerald-950/40 border border-emerald-900/60 text-emerald-400 text-xs px-4 py-3 rounded-xl flex items-start space-x-2 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
              >
                <span>✅</span>
                <span>{successMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email input */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">
              Email Address
            </label>
            <div className="relative flex items-center">
              <Mail className="absolute left-4 w-4 h-4 text-zinc-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-xl pl-11 pr-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-700/80 focus:ring-1 focus:ring-zinc-700/20 transition-all"
                required
              />
            </div>
          </div>

          {/* Password input */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">
              Password
            </label>
            <div className="relative flex items-center">
              <Lock className="absolute left-4 w-4 h-4 text-zinc-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-xl pl-11 pr-12 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-700/80 focus:ring-1 focus:ring-zinc-700/20 transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 p-1 rounded-md text-zinc-500 hover:text-zinc-300 focus:outline-none transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
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
                  Processing...
                </>
              ) : isSignUp ? (
                'Create Account'
              ) : (
                'Sign In'
              )}
            </span>
          </button>
        </form>
      </motion.div>
    </div>
  );
}
