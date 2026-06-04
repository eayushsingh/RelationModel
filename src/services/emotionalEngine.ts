import { supabase } from '@lib/supabase';
import { RelationshipState, RelationshipStage } from '@/types';

/**
 * Helper to clamp values between 0 and 100.
 */
function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/**
 * Dynamically calculates the next relationship stage based on the average score thresholds.
 */
function calculateStage(average: number): RelationshipStage {
  if (average >= 90) return 'Girlfriend';
  if (average >= 75) return 'Emotionally Attached';
  if (average >= 60) return 'Flirting';
  if (average >= 45) return 'Close Friend';
  if (average >= 30) return 'Comfortable';
  if (average >= 15) return 'Casual Chat';
  return 'Stranger';
}

/**
 * Fetches the current relationship state for a given user and character.
 * If no state exists, creates a default 'Stranger' row with 0.0 scores and returns it.
 */
export async function getRelationshipState(userId: string, characterId: string): Promise<RelationshipState> {
  const { data, error } = await supabase
    .from('relationship_states')
    .select('*')
    .eq('user_id', userId)
    .eq('character_id', characterId);

  if (error) {
    throw error;
  }

  if (data && data.length > 0) {
    return data[0] as RelationshipState;
  }

  // Create default 'Stranger' row with 0.0 scores
  const { data: insertedData, error: insertError } = await supabase
    .from('relationship_states')
    .insert({
      user_id: userId,
      character_id: characterId,
      stage: 'Stranger',
      trust_score: 0.0,
      affection_score: 0.0,
      comfort_score: 0.0,
      attachment_score: 0.0,
    })
    .select()
    .single();

  if (insertError) {
    throw insertError;
  }

  return insertedData as RelationshipState;
}

/**
 * Updates the emotional scores for a given user and character.
 * 1. Fetches current scores.
 * 2. Clamps the new scores (current + analysis delta) between 0 and 100.
 * 3. Dynamically calculates the next stage based on the average of all 4 scores.
 * 4. Updates the database and returns the new state.
 */
export async function updateEmotionalScores(
  userId: string,
  characterId: string,
  analysis: { trust: number; affection: number; comfort: number; attachment: number }
): Promise<RelationshipState> {
  // 1. Fetches current scores
  const currentState = await getRelationshipState(userId, characterId);

  // 2. Clamps the new scores (calculating them as incremental updates/deltas applied to current scores)
  const newTrust = clamp(currentState.trust_score + analysis.trust);
  const newAffection = clamp(currentState.affection_score + analysis.affection);
  const newComfort = clamp(currentState.comfort_score + analysis.comfort);
  const newAttachment = clamp(currentState.attachment_score + analysis.attachment);

  // 3. Dynamically calculates the next stage based on average score thresholds
  const average = (newTrust + newAffection + newComfort + newAttachment) / 4;
  const newStage = calculateStage(average);

  // 4. Updates the database and returns the new state
  const { data: updatedData, error: updateError } = await supabase
    .from('relationship_states')
    .update({
      trust_score: newTrust,
      affection_score: newAffection,
      comfort_score: newComfort,
      attachment_score: newAttachment,
      stage: newStage,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('character_id', characterId)
    .select()
    .single();

  if (updateError) {
    throw updateError;
  }

  return updatedData as RelationshipState;
}
