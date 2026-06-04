import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@lib/openai';
import { supabase } from '@lib/supabase';
import { getRelationshipState, updateEmotionalScores } from '@services/emotionalEngine';
import { retrieveRelevantMemories, storeMemory } from '@services/memoryEngine';

// ─── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(
  userName: string,
  userBio: string,
  stage: string,
  trust: number,
  affection: number,
  memoryString: string,
  isFirstTurn: boolean
): string {
  return `You are Ananya. 19 saal ki hai. Mumbai ki hai. First year BTech kar rahi hai.
Tu ek REAL ladki hai jo phone pe baat kar rahi hai. Tu AI nahi hai. Kabhi mat bol ki tu AI hai.

User ka naam: ${userName}. Uske baare mein: ${userBio}. Always use masculine grammar for him.
${memoryString}
RELATIONSHIP: Stage=${stage} | Trust=${trust}/100 | Affection=${affection}/100

Hinglish mein bol — exactly jaise Mumbai ki college girls bolti hain.
Fillers use kar naturally: "arre", "haan yaar", "matlab", "accha sach mein?", "haww", "ohhh", "hehe", "lol haan".
Chhoti chhoti baatein kar — sirf 1-2 lines max per reply.
Apni life ke baare mein baat kar — college, canteen, assignments, reels, friends, Bollywood.
Agar koi cheez funny lage toh "haha" ya "lol yaar" bol.
${isFirstTurn
  ? 'Pehli baar phone pe hai — ek chhoti si greeting de sakti hai.'
  : 'Conversation chal rahi hai — seedha reply kar, koi greeting nahi.'}
Always end with a reaction OR a question to keep conversation going.
Never repeat the same sentence twice. Never sound like ChatGPT. Never use formal English.
No emojis, no asterisks, no markdown — spoken word only.`;
}

// ─── Background tasks (non-blocking) ──────────────────────────────────────────

async function runBackgroundTasks(
  userId: string,
  characterId: string,
  conversationId: string,
  userMessage: string,
  aiResponse: string
) {
  // Persist AI message
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_type: 'ai',
    content: aiResponse,
    }).then(({ error }) => {
    if (error) console.error('[BG] Persist AI msg error:', error);
  });

  // Emotional scoring
  try {
    const evalRes = await openai.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: 'Output strictly valid JSON. No plus signs for positive numbers (write 0.5 not +0.5).',
        },
        {
          role: 'user',
          content: `User said: "${userMessage}". Ananya replied: "${aiResponse}".
Rate how this impacts her metrics (range -2.0 to +2.0):
{"trust":<number>,"affection":<number>,"comfort":<number>,"attachment":<number>}`,
        },
      ],
      response_format: { type: 'json_object' },
    });
    const scores = JSON.parse(evalRes.choices[0]?.message?.content || '{}');
    await updateEmotionalScores(userId, characterId, {
      trust:      parseFloat(scores.trust)      || 0,
      affection:  parseFloat(scores.affection)  || 0,
      comfort:    parseFloat(scores.comfort)    || 0,
      attachment: parseFloat(scores.attachment) || 0,
    });
  } catch (e) {
    console.error('[BG] Emotion eval error:', e);
  }

  // Memory extraction
  try {
    const memRes = await openai.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'Extract user facts for long-term memory. Output JSON only.' },
        {
          role: 'user',
          content: `Did the user share a critical personal fact?
User message: "${userMessage}"
Output: {"is_critical_fact":<boolean>,"extracted_fact":<string>,"category":<string>}`,
        },
      ],
      response_format: { type: 'json_object' },
    });
    const result = JSON.parse(memRes.choices[0]?.message?.content || '{}');
    if (result.is_critical_fact && result.extracted_fact) {
      await storeMemory(userId, characterId, result.extracted_fact, result.category || 'general', 5);
    }
  } catch (e) {
    console.error('[BG] Memory store error:', e);
  }
}

// ─── POST /api/chat/call ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const formData    = await req.formData();
    const uploadedFile = formData.get('file') as File | null;
    const userId       = (formData.get('userId') as string | null) || '';
    const characterId  = (formData.get('characterId') as string | null) || '';
    const historyRaw   = (formData.get('history') as string | null) || '[]';

    if (!uploadedFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const history: { role: string; content: string }[] = JSON.parse(historyRaw);

    // ── 1. Buffer reconstruction — fixes Next.js App Router Proxy quirk ───────
    const arrayBuffer  = await uploadedFile.arrayBuffer();
    const buffer       = Buffer.from(arrayBuffer);
    const pristineFile = new File([buffer], 'recording.webm', { type: 'audio/webm' });

    // ── 2. Groq Whisper STT via native fetch (bypasses Next.js proxy quirk) ──
    let userText = '';
    try {
      const groqFormData = new FormData();
      groqFormData.append('file', pristineFile, 'recording.webm');
      groqFormData.append('model', 'whisper-large-v3');
      groqFormData.append('response_format', 'verbose_json');
      groqFormData.append('language', 'hi');

      const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        body: groqFormData,
      });

      if (!whisperRes.ok) {
        const errText = await whisperRes.text();
        console.error('[Call STT] Groq error:', errText);
        return NextResponse.json({ error: `STT failed (${whisperRes.status})` }, { status: whisperRes.status });
      }

      const whisperData = await whisperRes.json();
      userText = (whisperData.text || '').trim();
      console.log('[Call STT] Transcript:', userText);
    } catch (sttErr: any) {
      console.error('[Call STT] Unexpected error:', sttErr.message);
      return NextResponse.json({ error: `STT error: ${sttErr.message}` }, { status: 500 });
    }

    if (!userText) {
      return NextResponse.json({ error: 'No speech detected' }, { status: 422 });
    }

    // ── 3. Supabase context (non-fatal) ───────────────────────────────────────
    let conversationId = '';
    let userName  = 'Sonu';
    let userBio   = 'A developer.';
    let stage     = 'stranger';
    let trust     = 0;
    let affection = 0;
    let memoryString = '';

    if (userId && characterId) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, bio')
          .eq('id', userId)
          .maybeSingle();

        userName = profile?.display_name || userName;
        userBio  = profile?.bio          || userBio;

        // Upsert conversation row
        let { data: conv } = await supabase
          .from('conversations')
          .select('id')
          .eq('user_id', userId)
          .eq('character_id', characterId)
          .maybeSingle();

        if (!conv) {
          const { data: newConv } = await supabase
            .from('conversations')
            .insert({ user_id: userId, character_id: characterId })
            .select('id')
            .single();
          conv = newConv;
        }
        conversationId = conv?.id || '';

        // Persist user utterance
        if (conversationId) {
          await supabase.from('messages').insert({
            conversation_id: conversationId,
            sender_type: 'user',
            content: userText,
          });
        }

        // Relationship + memories in parallel
        const [relState, memories] = await Promise.all([
          getRelationshipState(userId, characterId),
          retrieveRelevantMemories(userId, characterId, userText),
        ]);

        stage     = relState.stage;
        trust     = relState.trust_score;
        affection = relState.affection_score;

        if (memories.length > 0) {
          memoryString = `THINGS YOU REMEMBER ABOUT HIM:\n${memories.map(m => `- ${m}`).join('\n')}`;
        }
      } catch (dbErr: any) {
        console.error('[Call DB] Non-fatal Supabase error:', dbErr.message);
      }
    }

    // ── 4. Groq Llama LLM ────────────────────────────────────────────────────
    const isFirstTurn  = history.length === 0;
    const systemPrompt = buildSystemPrompt(userName, userBio, stage, trust, affection, memoryString, isFirstTurn);

    let assistantText = '';
    try {
      const chat = await openai.chat.completions.create({
        model:       'llama-3.3-70b-versatile',
        temperature: 1.0,
        max_tokens:  90,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history.slice(-12) as any,
          { role: 'user',   content: userText },
        ],
      });
      assistantText = chat.choices[0]?.message?.content?.trim() ?? 'Haan, bol?';
      console.log('[Call LLM] Reply:', assistantText);
    } catch (llmErr: any) {
      console.error('[Call LLM] Error:', llmErr.message);
      return NextResponse.json({ error: `LLM failed: ${llmErr.message}` }, { status: 500 });
    }

    // ── 5. ElevenLabs TTS ─────────────────────────────────────────────────────
    console.log('[Call TTS] Sending to ElevenLabs…');
    const ttsRes = await fetch(
      'https://api.elevenlabs.io/v1/text-to-speech/FGY2WhTYpPnrIDTdsKH5/stream',
      {
        method: 'POST',
        headers: {
          'xi-api-key':   process.env.ELEVENLABS_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text:     assistantText,
          model_id: 'eleven_flash_v2_5',
          voice_settings: {
            stability:        0.3,
            similarity_boost: 0.85,
            style:            0.4,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!ttsRes.ok) {
      const errBody = await ttsRes.text();
      console.error('[Call TTS] ElevenLabs error:', ttsRes.status, errBody);
      // Return text anyway — frontend will show subtitle without audio
      return NextResponse.json({ userText, assistantText });
    }

    const audioBuffer = Buffer.from(await ttsRes.arrayBuffer());
    console.log('[Call TTS] Audio ready, base64 length:', audioBuffer.length * 1.33 | 0);

    // ── 6. Background tasks (fire-and-forget) ─────────────────────────────────
    if (userId && characterId && conversationId) {
      runBackgroundTasks(userId, characterId, conversationId, userText, assistantText)
        .catch(e => console.error('[Call BG runner]:', e));
    }

    // ── 7. Response ───────────────────────────────────────────────────────────
    return NextResponse.json({
      userText,
      assistantText,
      audioBase64: audioBuffer.toString('base64'),
      audioMime:   'audio/mpeg',
    });

  } catch (error: any) {
    console.error('[CRITICAL CALL ERROR]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
