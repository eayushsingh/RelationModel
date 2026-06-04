'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@lib/supabase';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/chat');
      } else {
        setLoading(false);
      }
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.push('/chat');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  if (loading) {
    return (
      <div className="bg-zinc-950 text-zinc-100 min-h-screen flex flex-col items-center justify-center relative overflow-hidden font-sans">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-900/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="flex flex-col items-center space-y-4 z-10">
          <div className="w-12 h-12 rounded-full border-t-2 border-purple-500 animate-spin" />
          <p className="text-zinc-400 text-sm font-medium animate-pulse">Initializing connection...</p>
        </div>
      </div>
    );
  }

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

        <Auth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#a855f7',
                  brandAccent: '#ec4899',
                  inputBackground: 'rgba(9, 9, 11, 0.6)',
                  inputText: '#f4f4f5',
                  inputBorder: 'rgba(39, 39, 42, 0.8)',
                  inputPlaceholder: '#71717a',
                  messageText: '#f4f4f5',
                },
              },
            },
            style: {
              button: {
                borderRadius: '0.75rem',
                border: 'none',
                background: 'linear-gradient(to top right, #ec4899, #a855f7, #06b6d4)',
                fontWeight: 'bold',
                color: '#ffffff',
                padding: '12px',
              },
              input: {
                borderRadius: '0.75rem',
                border: '1px solid rgba(39, 39, 42, 0.8)',
                padding: '12px',
              },
              container: {
                color: '#f4f4f5',
              },
              anchor: {
                color: '#a855f7',
              },
              label: {
                color: '#a1a1aa',
                fontSize: '10px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              },
            },
          }}
          theme="dark"
          view="sign_in"
          providers={[]}
        />
      </motion.div>
    </div>
  );
}
