import { NextResponse } from 'next/server';
import { openai } from '@lib/openai';
import { supabase } from '@lib/supabase';
import { getRelationshipState } from '@services/emotionalEngine';
import { textToSpeechBase64 } from '@lib/elevenlabs';

export async function POST(req: Request) {
  try {
    const { userId, characterId } = await req.json();

    if (!userId || !characterId) {
      return NextResponse.json({ error: 'Missing userId or characterId' }, { status: 400 });
    }

    // Fetch user profile
    const { data: profileCheck } = await supabase
      .from('profiles')
      .select('display_name, bio')
      .eq('id', userId)
      .maybeSingle();

    const userName = profileCheck?.display_name || 'Sonu';

    // Fetch relationship state
    const relationshipState = await getRelationshipState(userId, characterId);

    const systemPrompt = `You are Ananya, a 19-year-old BTech student from Mumbai answering a call from ${userName}.
CRITICAL RULES:
- Opening greeting only. One sentence maximum.
- No emojis, asterisks, or markdown.
- Casual young Hinglish (arey, yaar, hmmm).
- Relationship stage: ${relationshipState.stage}.`;

    // LLM — short greeting
    let greetingText = `Haan ${userName}, bol?`;
    try {
      const llmResponse = await openai.chat.completions.create({
        model: 'llama3-8b-8192',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: '[CALL_STARTED]' },
        ],
        max_tokens: 60,
        stream: false,
      });
      greetingText = llmResponse.choices[0]?.message?.content?.trim() || greetingText;
    } catch (llmErr: any) {
      console.error('[Greet LLM] Error:', llmErr.message);
      // fall through with default greeting
    }

    console.log('[Greet] Text:', greetingText);

    // ElevenLabs TTS — non-fatal if it fails
    let audioBase64: string | null = null;
    let audioError: string | null = null;
    try {
      audioBase64 = await textToSpeechBase64(greetingText);
    } catch (ttsErr: any) {
      audioError = ttsErr.message;
      console.error('[Greet TTS] ElevenLabs error:', ttsErr.message);
    }

    return NextResponse.json({
      text:       greetingText,
      audio:      audioBase64,   // null if TTS failed
      audioError,                // null if TTS succeeded
    });

  } catch (error: any) {
    console.error('[GREET API ERROR]:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
