/**
 * ElevenLabs TTS helper — native fetch, no SDK.
 * Voice: FGY2WhTYpPnrIDTdsKH5  (Laura — soft, young, warm tone; free-tier compatible)
 * Model: eleven_flash_v2_5       (~75ms latency, optimised for real-time)
 *
 * Returns a base64-encoded MP3 string.
 * Throws a descriptive Error on any API failure so callers can handle it.
 */

const VOICE_ID = 'FGY2WhTYpPnrIDTdsKH5'; // Laura — softer, younger, warmer
const TTS_URL = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`;

export async function textToSpeechBase64(text: string): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not set in environment variables.');
  }

  const response = await fetch(TTS_URL, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_flash_v2_5',
      voice_settings: {
        stability: 0.3,
        similarity_boost: 0.85,
        style: 0.4,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error(`[ElevenLabs] ${response.status} error:`, errBody);
    throw new Error(`ElevenLabs TTS failed (${response.status}): ${errBody}`);
  }

  // Collect the streaming audio response into a single Buffer
  const chunks: Uint8Array[] = [];
  const reader = response.body!.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  const totalLength = chunks.reduce((sum, c) => sum + c.byteLength, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return Buffer.from(combined).toString('base64');
}
