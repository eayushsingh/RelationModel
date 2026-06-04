import { NextResponse } from 'next/server';
import { openai } from '@lib/openai';
import { supabase } from '@lib/supabase';
import { getRelationshipState, updateEmotionalScores } from '@services/emotionalEngine';
import { retrieveRelevantMemories, storeMemory } from '@services/memoryEngine';
import { buildSystemPrompt } from '@services/promptBuilder';

/**
 * Background worker to update metrics and store long-term memories out-of-band.
 */
async function handleBackgroundTasks(
  userId: string,
  characterId: string,
  conversationId: string,
  userMessage: string,
  aiResponse: string
) {
  // 1. Insert AI response into public.messages
  const { error: aiMsgError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_type: 'ai',
      content: aiResponse,
    });

  if (aiMsgError) {
    console.error('[Background] Error saving AI message:', aiMsgError);
  }

  // 2. Analyze the emotional impact of the user's message on the character
  const evaluationPrompt = `
You are the emotional assessment module for Ananya, a 19-year-old BTech student from Mumbai.
Given the user's message and Ananya's corresponding response, determine how this exchange impacts her relationship metrics with the user.

User's message: "${userMessage}"
Ananya's response: "${aiResponse}"

Provide score changes for:
- trust: impact on confidence and reliance on the user (range: -2.0 to +2.0)
- affection: impact on romantic attraction/fondness (range: -2.0 to +2.0)
- comfort: impact on feeling relaxed/at ease (range: -2.0 to +2.0)
- attachment: impact on deep emotional connection (range: -2.0 to +2.0)

Assign small adjustments (+0.1 to +0.5) for normal casual conversation, larger adjustments (+1.0 to +2.0) for sharing deep secrets or intense caring, and negative adjustments (-0.5 to -2.0) if the user is rude, cold, or pushy.

Output JSON format exactly:
{
  "trust": <number>,
  "affection": <number>,
  "comfort": <number>,
  "attachment": <number>
}
`;

  try {
    const evalResponse = await openai.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'You evaluate emotional metric updates and output JSON. You must output in JSON format. CRITICAL: Output STRICTLY valid JSON. Do NOT use plus signs (+) for positive numbers. Use 0.5, not +0.5.' },
        { role: 'user', content: evaluationPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    const evalContent = evalResponse.choices[0]?.message?.content;
    if (evalContent) {
      const scores = JSON.parse(evalContent);
      await updateEmotionalScores(userId, characterId, {
        trust: parseFloat(scores.trust) || 0,
        affection: parseFloat(scores.affection) || 0,
        comfort: parseFloat(scores.comfort) || 0,
        attachment: parseFloat(scores.attachment) || 0,
      });
    }
  } catch (err) {
    console.error('[Background] Error evaluating emotional scores:', err);
  }

  // 3. Memory storage check for critical facts
  const memoryCheckPrompt = `
Analyze the user's message. Determine if they explicitly shared a critical personal fact, habit, preference, family detail, or milestone about themselves (e.g. "I love black tea", "I hate birthdays", "My dad is a lawyer").
Do NOT capture general statements, brief opinions, or transient conversational responses.

User's message: "${userMessage}"

If a critical fact is shared, extract it into a clear third-person statement (e.g. "The user prefers black tea", "The user hates birthdays"). Otherwise, set "is_critical_fact" to false.

Output JSON format exactly:
{
  "is_critical_fact": <boolean>,
  "extracted_fact": <string>,
  "category": <string> (e.g., "preference", "family", "aspiration", "general")
}
`;

  try {
    const memResponse = await openai.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'You identify user facts for long-term memory extraction and output JSON. You must output in JSON format.' },
        { role: 'user', content: memoryCheckPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    const memContent = memResponse.choices[0]?.message?.content;
    if (memContent) {
      const result = JSON.parse(memContent);
      if (result.is_critical_fact && result.extracted_fact) {
        await storeMemory(
          userId,
          characterId,
          result.extracted_fact,
          result.category || 'general',
          5
        );
      }
    }
  } catch (err) {
    console.error('[Background] Error processing memory store:', err);
  }
}

export async function POST(req: Request) {
  try {
    // 1. Parse and validate input params
    const { userId, characterId, message, image } = await req.json();
    if (!userId || !characterId || (!message && !image)) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, characterId, message or image' },
        { status: 400 }
      );
    }

    // Ensure user profile exists to prevent foreign key violations in relationship_states, conversations, etc.
    let { data: profileCheck, error: profileError } = await supabase
      .from('profiles')
      .select('id, display_name, bio')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.warn('[API/chat] Error checking profile existence:', profileError);
    }

    if (!profileCheck) {
      const { data: newProfile, error: insertProfileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          display_name: `User_${userId.slice(0, 8)}`,
          updated_at: new Date().toISOString()
        })
        .select('id, display_name, bio')
        .single();
      if (insertProfileError) {
        console.error('[API/chat] Error creating profile row:', insertProfileError);
      } else {
        profileCheck = newProfile;
      }
    }

    const userName = profileCheck?.display_name || 'Ayush';
    const userBio = profileCheck?.bio || 'A developer.';

    // Ensure relationship state exists (pre-initialize if missing)
    try {
      await getRelationshipState(userId, characterId);
    } catch (e) {
      console.error('[API/chat] Error pre-initializing relationship state:', e);
    }

    // 2. Fetch or create active conversation
    let { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId)
      .eq('character_id', characterId)
      .maybeSingle();

    if (convError) {
      return NextResponse.json({ error: convError.message }, { status: 500 });
    }

    let conversationId: string;
    if (!conversation) {
      const { data: newConv, error: createError } = await supabase
        .from('conversations')
        .insert({ user_id: userId, character_id: characterId })
        .select('id')
        .single();

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500 });
      }
      conversationId = newConv.id;
    } else {
      conversationId = conversation.id;
    }

    // 3. Insert user's message into messages table (with image serialization if present)
    let dbContent = message || '';
    if (image) {
      dbContent = `[USER_IMAGE: ${image}]` + (message ? ` ${message}` : '');
    }

    const { error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_type: 'user',
        content: dbContent,
      });

    if (msgError) {
      return NextResponse.json({ error: msgError.message }, { status: 500 });
    }

    // 4. Fetch relationship state and memories concurrently
    const [relationshipState, memories] = await Promise.all([
      getRelationshipState(userId, characterId),
      retrieveRelevantMemories(userId, characterId, message),
    ]);

    // 5. Fetch basic character profile
    const { data: character, error: charError } = await supabase
      .from('ai_characters')
      .select('*')
      .eq('id', characterId)
      .single();

    if (charError) {
      return NextResponse.json(
        { error: `Character profile not found: ${charError.message}` },
        { status: 404 }
      );
    }

    // 6. Build the custom system prompt with dynamic user profile data
    const systemPrompt = buildSystemPrompt(character, relationshipState, memories, userName, userBio);

    // 7. Fetch the last 20 messages from the conversation history (including the newly inserted message)
    const { data: historyMessages, error: historyError } = await supabase
      .from('messages')
      .select('sender_type, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (historyError) {
      return NextResponse.json({ error: historyError.message }, { status: 500 });
    }

    // Chronological order: reverse the retrieved list
    const formattedHistory = historyMessages ? [...historyMessages].reverse() : [];

    const userImageRegex = /^\[USER_IMAGE:\s*(\S+?)\]\s*([\s\S]*)$/;

    const openAIMessages = [
      { role: 'system', content: systemPrompt },
      ...formattedHistory.map((m) => {
        const role = m.sender_type === 'user' ? 'user' : 'assistant';

        if (role === 'user' && m.content) {
          const match = m.content.match(userImageRegex);
          if (match) {
            const imageUrl = match[1];
            const textContent = match[2] || '';
            return {
              role,
              content: [
                { type: 'text', text: textContent },
                { type: 'image_url', image_url: { url: imageUrl } }
              ]
            };
          }
        }

        return {
          role,
          content: m.content || '',
        };
      }),
    ];

    // 8. Call OpenAI Chat Completion with streaming enabled (using vision model)
    const streamResponse = await openai.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: openAIMessages as any,
      stream: true,
    });

    // 9. Stream responses using ReadableStream back to client
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = '';
        try {
          for await (const chunk of streamResponse) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              fullResponse += content;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();

          // 10. Execute out-of-band background processes
          handleBackgroundTasks(userId, characterId, conversationId, message, fullResponse).catch(
            (err) => console.error('[Background Task Runner Error]:', err)
          );
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error("CRITICAL CHAT API ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const characterId = searchParams.get('characterId');

    if (!userId || !characterId) {
      return NextResponse.json({ error: 'Missing userId or characterId' }, { status: 400 });
    }

    // Ensure user profile exists to prevent foreign key violations in conversations, etc.
    const { data: profileCheck, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.warn('[API/chat] Error checking profile existence in GET:', profileError);
    }

    if (!profileCheck) {
      const { error: insertProfileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          display_name: `User_${userId.slice(0, 8)}`,
          updated_at: new Date().toISOString()
        });
      if (insertProfileError) {
        console.error('[API/chat] Error creating profile row in GET:', insertProfileError);
      }
    }

    // Ensure relationship state exists (pre-initialize if missing)
    try {
      await getRelationshipState(userId, characterId);
    } catch (e) {
      console.error('[API/chat] Error pre-initializing relationship state in GET:', e);
    }

    // 1. Fetch conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId)
      .eq('character_id', characterId)
      .maybeSingle();

    if (convError) {
      return NextResponse.json({ error: convError.message }, { status: 500 });
    }

    if (!conversation) {
      return NextResponse.json([]); // Return empty list if no conversation exists yet
    }

    // 2. Fetch last 50 messages
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('id, sender_type, content, created_at')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(50);

    if (msgError) {
      return NextResponse.json({ error: msgError.message }, { status: 500 });
    }

    return NextResponse.json(messages || []);
  } catch (error: any) {
    console.error("GET CHAT HISTORY ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

