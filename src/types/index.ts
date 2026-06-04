export type RelationshipStage = 'Stranger' | 'Casual Chat' | 'Comfortable' | 'Close Friend' | 'Flirting' | 'Emotionally Attached' | 'Girlfriend';

export interface RelationshipState {
  id: string;
  user_id: string;
  character_id: string;
  stage: RelationshipStage;
  trust_score: number;
  affection_score: number;
  comfort_score: number;
  attachment_score: number;
  updated_at: string;
}
