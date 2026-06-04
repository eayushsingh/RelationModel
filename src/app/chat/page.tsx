'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@lib/supabase';
import ChatWindow from '@/components/chat/ChatWindow';
import OnboardingModal from '@/components/OnboardingModal';
import { motion } from 'framer-motion';

interface RelationshipState {
  stage: string;
  trust_score: number;
  affection_score: number;
  comfort_score: number;
  attachment_score: number;
}

const mockCharacterId = '22222222-2222-2222-2222-222222222222';

export default function ChatPage() {
  const router = useRouter();
  const [relationship, setRelationship] = useState<RelationshipState | null>(null);
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);

  const fetchRelationship = async (userId: string) => {
    try {
      // Ensure user profile exists in profiles table to avoid foreign key violation
      const { data: profileCheck, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.warn('Error checking user profile:', profileError);
      }

      if (profileCheck) {
        setProfileName(profileCheck.display_name);
        if (profileCheck.display_name && profileCheck.display_name.startsWith('User_')) {
          setShowOnboarding(true);
        }
      }

      const { data, error } = await supabase
        .from('relationship_states')
        .select('*')
        .eq('user_id', userId)
        .eq('character_id', mockCharacterId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setRelationship({
          stage: data.stage,
          trust_score: data.trust_score,
          affection_score: data.affection_score,
          comfort_score: data.comfort_score,
          attachment_score: data.attachment_score,
        });
      } else {
        // Automatically insert default state if table is accessible but row is missing
        const { data: newRow, error: createError } = await supabase
          .from('relationship_states')
          .insert({
            user_id: userId,
            character_id: mockCharacterId,
            stage: 'Stranger',
            trust_score: 0,
            affection_score: 0,
            comfort_score: 0,
            attachment_score: 0,
          })
          .select()
          .single();

        if (createError) throw createError;
        if (newRow) {
          setRelationship({
            stage: newRow.stage,
            trust_score: newRow.trust_score,
            affection_score: newRow.affection_score,
            comfort_score: newRow.comfort_score,
            attachment_score: newRow.attachment_score,
          });
        }
      }
    } catch (err) {
      console.warn('Could not fetch relationship state from Supabase, using mock fallback', err);
      // Mock fallback state for quick UI previewing / missing tables
      setRelationship((prev) => {
        if (prev) return prev;
        return {
          stage: 'Stranger',
          trust_score: 15,
          affection_score: 10,
          comfort_score: 25,
          attachment_score: 5,
        };
      });
    }
  };

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login');
      } else {
        setSession(session);
        setAuthLoading(false);
      }
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push('/login');
      } else {
        setSession(session);
        setAuthLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchRelationship(session.user.id);
    }
  }, [session]);

  const getStageBadgeStyles = (stage: string) => {
    switch (stage) {
      case 'Girlfriend':
        return 'bg-rose-950/40 text-rose-400 border-rose-800 shadow-[0_0_15px_rgba(244,63,94,0.35)]';
      case 'Emotionally Attached':
        return 'bg-pink-950/40 text-pink-400 border-pink-800 shadow-[0_0_12px_rgba(236,72,153,0.35)]';
      case 'Flirting':
        return 'bg-violet-950/40 text-violet-400 border-violet-800 shadow-[0_0_12px_rgba(139,92,246,0.35)]';
      case 'Close Friend':
        return 'bg-emerald-950/40 text-emerald-400 border-emerald-800 shadow-[0_0_10px_rgba(16,185,129,0.35)]';
      case 'Comfortable':
        return 'bg-cyan-950/40 text-cyan-400 border-cyan-800 shadow-[0_0_10px_rgba(6,182,212,0.35)]';
      case 'Casual Chat':
        return 'bg-blue-950/40 text-blue-400 border-blue-800 shadow-[0_0_8px_rgba(59,130,246,0.3)]';
      default: // Stranger
        return 'bg-zinc-800/40 text-zinc-400 border-zinc-700/60 shadow-none';
    }
  };

  if (authLoading) {
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

  if (!session) {
    return null;
  }

  return (
    <div className="bg-zinc-950 text-zinc-100 min-h-screen flex flex-col md:flex-row overflow-hidden font-sans">
      {/* Sidebar Panel */}
      <div className="w-full md:w-[320px] flex-shrink-0 bg-zinc-900/30 border-b md:border-b-0 md:border-r border-zinc-800/60 backdrop-blur-md p-6 flex flex-col justify-between space-y-6">
        <div className="space-y-6">
          {/* Ananya Profile Card */}
          <div className="flex flex-col items-center text-center space-y-4">
            <button
              onClick={() => setExpandedImageUrl('/ananya.png')}
              className="transition-transform active:scale-95 focus:outline-none relative w-20 h-20 rounded-full bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-500 p-[3px] shadow-[0_0_25px_rgba(168,85,247,0.3)]"
            >
              <div className="w-full h-full rounded-full bg-zinc-950 flex items-center justify-center overflow-hidden">
                <img src="/ananya.png" alt="Ananya" className="w-full h-full object-cover rounded-full" />
              </div>
              <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-zinc-950 flex items-center justify-center border border-zinc-800">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              </div>
            </button>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-100">Ananya</h1>
              <p className="text-xs text-zinc-400 mt-1">19 • Mumbai • First-year BTech</p>
            </div>
          </div>

          {/* Relationship Stage Badge */}
          {relationship && (
            <div className="space-y-2">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">
                Connection Stage
              </span>
              <div
                className={`py-2.5 px-4 text-center rounded-xl border text-sm font-semibold transition-all duration-500 ${getStageBadgeStyles(
                  relationship.stage
                )}`}
              >
                {relationship.stage}
              </div>
            </div>
          )}

          {/* Emotional Coordinate Metrics */}
          {relationship && (
            <div className="space-y-4 pt-2">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">
                Emotional Bond Coordinates
              </span>
              <div className="space-y-3.5">
                {/* Trust */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium text-zinc-300">
                    <span>Trust</span>
                    <span className="text-cyan-400">{Math.round(relationship.trust_score)}%</span>
                  </div>
                  <div className="w-full bg-zinc-800/40 rounded-full h-1.5 overflow-hidden border border-zinc-800/40">
                    <div
                      className="bg-gradient-to-r from-cyan-500 to-teal-400 h-full rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${relationship.trust_score}%` }}
                    />
                  </div>
                </div>

                {/* Affection */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium text-zinc-300">
                    <span>Affection</span>
                    <span className="text-rose-400">{Math.round(relationship.affection_score)}%</span>
                  </div>
                  <div className="w-full bg-zinc-800/40 rounded-full h-1.5 overflow-hidden border border-zinc-800/40">
                    <div
                      className="bg-gradient-to-r from-rose-500 to-pink-500 h-full rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${relationship.affection_score}%` }}
                    />
                  </div>
                </div>

                {/* Comfort */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium text-zinc-300">
                    <span>Comfort</span>
                    <span className="text-emerald-400">{Math.round(relationship.comfort_score)}%</span>
                  </div>
                  <div className="w-full bg-zinc-800/40 rounded-full h-1.5 overflow-hidden border border-zinc-800/40">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${relationship.comfort_score}%` }}
                    />
                  </div>
                </div>

                {/* Attachment */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium text-zinc-300">
                    <span>Attachment</span>
                    <span className="text-purple-400">{Math.round(relationship.attachment_score)}%</span>
                  </div>
                  <div className="w-full bg-zinc-800/40 rounded-full h-1.5 overflow-hidden border border-zinc-800/40">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${relationship.attachment_score}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer info & Sign Out */}
        <div className="border-t border-zinc-900/60 pt-4 space-y-3">
          <button
            onClick={async () => {
              await supabase.auth.signOut();
            }}
            className="w-full py-2.5 px-4 rounded-xl border border-zinc-800/80 hover:border-zinc-700 bg-zinc-950/40 hover:bg-zinc-900/40 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-all flex items-center justify-center gap-2"
          >
            <span>🚪</span> Sign Out
          </button>
          <div className="text-[10px] text-center text-zinc-600 hidden md:block">
            Dynamic Emotional State Engine v1.0
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative h-[calc(100vh-180px)] md:h-screen">
        {/* Subtle decorative background gradient glow */}
        <div className="absolute top-0 right-0 w-[40%] h-[30%] bg-gradient-to-bl from-purple-900/5 via-transparent to-transparent pointer-events-none rounded-bl-full" />
        <div className="absolute bottom-0 left-0 w-[30%] h-[20%] bg-gradient-to-tr from-cyan-900/5 via-transparent to-transparent pointer-events-none rounded-tr-full" />

        <div className="flex-1 p-3 md:p-6 z-10">
          <ChatWindow
            userId={session.user.id}
            characterId={mockCharacterId}
            onRelationshipUpdate={() => fetchRelationship(session.user.id)}
            onAvatarClick={(url) => setExpandedImageUrl(url || '/ananya.png')}
          />
        </div>
      </div>
      {/* Onboarding Modal Overlay */}
      {showOnboarding && session?.user?.id && (
        <OnboardingModal
          userId={session.user.id}
          onCompleted={() => {
            setShowOnboarding(false);
            fetchRelationship(session.user.id);
          }}
        />
      )}

      {/* Profile Image Expand Modal */}
      {expandedImageUrl && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md cursor-pointer"
          onClick={() => setExpandedImageUrl(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative p-2"
          >
            <img 
              src={expandedImageUrl} 
              alt="Expanded view" 
              className="w-[90vw] max-w-md aspect-[3/4] object-cover rounded-2xl shadow-2xl border border-white/10"
            />
          </motion.div>
        </div>
      )}
    </div>
  );
}
