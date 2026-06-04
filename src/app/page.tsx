import Link from 'next/link';

export default function Home() {
  return (
    <div className="bg-zinc-950 text-zinc-100 min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Dynamic Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-900/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Cinematic Content container */}
      <main className="max-w-4xl w-full flex flex-col items-center text-center space-y-12 z-10 my-16">
        {/* Title */}
        <div className="space-y-4">
          <span className="text-[11px] uppercase tracking-[0.2em] font-extrabold text-cyan-400/90 bg-cyan-950/40 border border-cyan-800/40 rounded-full px-4 py-1.5 shadow-[0_0_12px_rgba(6,182,212,0.1)]">
            Now Live: Next-Gen AI Companion
          </span>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-none bg-clip-text text-transparent bg-gradient-to-b from-zinc-50 via-zinc-100 to-zinc-400">
            Ananya AI
          </h1>
          <p className="text-sm md:text-base text-zinc-400 max-w-xl mx-auto font-medium leading-relaxed">
            Experience a realistic conversational agent powered by a dynamic emotional state engine, 
            vector semantic memory, and authentic Mumbai Hinglish speech styling.
          </p>
        </div>

        {/* CTA Button */}
        <div>
          <Link
            href="/chat"
            className="group relative inline-flex items-center justify-center p-0.5 mb-2 mr-2 overflow-hidden text-sm font-semibold rounded-xl bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-500 hover:text-white dark:text-white focus:outline-none shadow-[0_0_30px_rgba(168,85,247,0.3)] transition-all duration-300"
          >
            <span className="relative px-8 py-4 transition-all ease-in duration-75 bg-zinc-950 rounded-xl group-hover:bg-opacity-0 text-zinc-100 font-bold tracking-wide flex items-center gap-2">
              Enter Chatroom
              <svg
                className="w-4 h-4 transform group-hover:translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M9 5l7 7-7 7"
                ></path>
              </svg>
            </span>
          </Link>
        </div>

        {/* Architectural Pillars grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left pt-8">
          {/* Card 1: Emotional Engine */}
          <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-2xl p-6 backdrop-blur-sm relative group hover:border-zinc-700/60 transition-all">
            <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" />
              Emotional Engine
            </h3>
            <p className="text-xs text-zinc-400 mt-3 leading-relaxed">
              Dynamically computes and updates coordinates for Trust, Affection, Comfort, and Attachment. 
              Automatically transitions across relationship stages from Stranger to Girlfriend.
            </p>
          </div>

          {/* Card 2: Semantic Memory */}
          <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-2xl p-6 backdrop-blur-sm relative group hover:border-zinc-700/60 transition-all">
            <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.4)]" />
              Vector Memory
            </h3>
            <p className="text-xs text-zinc-400 mt-3 leading-relaxed">
              Generates 1536-dimensional embeddings for message contents and runs similarity matching via 
              PostgreSQL pgvector RPC to retrieve context-aware long-term memories.
            </p>
          </div>

          {/* Card 3: Hinglish Speech Style */}
          <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-2xl p-6 backdrop-blur-sm relative group hover:border-zinc-700/60 transition-all">
            <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.4)]" />
              Hinglish Texting
            </h3>
            <p className="text-xs text-zinc-400 mt-3 leading-relaxed">
              Expresses herself using natural urban Mumbai texting Hinglish. Blends Hindi and English 
              seamlessly to resemble genuine texting patterns of young urban Indians.
            </p>
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="text-xs text-zinc-600 mt-12">
        Built with Next.js (App Router), TypeScript, and Tailwind CSS.
      </footer>
    </div>
  );
}
