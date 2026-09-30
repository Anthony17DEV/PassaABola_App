export type ConversationCard = {
  id: string;
  topic: string;
  moods: string[];
  question: string;
  followUp: string;
  groupFollowUp: string;
  kind: 'question' | 'challenge';
};
export type RecommendationFormat = 'filme' | 'serie' | 'musica' | 'video' | 'surpresa';
export type Recommendation = {
  id: string;
  type: Exclude<RecommendationFormat, 'surpresa'>;
  title: string;
  creator: string;
  reason: string;
  source: string;
  url: string;
};
export type GenerationInput = {
  mode: string;
  mood: string;
  topics: string[];
  exclude: string[];
};
