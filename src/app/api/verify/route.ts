import { NextResponse } from 'next/server';
import { supabase } from '@lib/supabase';
import { openai } from '@lib/openai';

export async function GET() {
  const status = {
    database: 'unknown',
    openai: 'unknown',
    memory_rpc: 'unknown',
  };

  // 1. Verify Supabase connection & check for character seeding
  try {
    const { data, error } = await supabase
      .from('ai_characters')
      .select('id, name')
      .eq('name', 'Ananya')
      .maybeSingle();

    if (error) {
      status.database = `error: ${error.message}`;
    } else if (data) {
      status.database = 'ok';
    } else {
      status.database = 'ok (empty character table)';
    }
  } catch (err: any) {
    status.database = `error: ${err.message || err}`;
  }

  // 2. Verify OpenAI key configuration
  try {
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key') {
      status.openai = 'ok';
    } else {
      status.openai = 'error: OPENAI_API_KEY is not configured or still contains placeholder';
    }
  } catch (err: any) {
    status.openai = `error: ${err.message || err}`;
  }

  // 3. Confirm match_memories RPC is defined in Postgres
  try {
    const dummyEmbedding = new Array(1536).fill(0);
    const { error } = await supabase.rpc('match_memories', {
      query_embedding: dummyEmbedding,
      match_threshold: 0.4,
      match_count: 1,
      p_user_id: '11111111-1111-1111-1111-111111111111',
      p_character_id: '22222222-2222-2222-2222-222222222222',
    });

    if (error) {
      status.memory_rpc = `error: ${error.message}`;
    } else {
      status.memory_rpc = 'ok';
    }
  } catch (err: any) {
    status.memory_rpc = `error: ${err.message || err}`;
  }

  // Return status response
  const isHealthy =
    status.database.startsWith('ok') &&
    status.openai === 'ok' &&
    status.memory_rpc === 'ok';

  return NextResponse.json(status, { status: isHealthy ? 200 : 200 }); // Always respond with 200 so user can read status JSON
}
