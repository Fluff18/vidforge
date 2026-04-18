export interface DimensionScore {
  key: string;
  label: string;
  score: number;       // 0–100
  direction: "higher" | "lower";
  reasoning: string;
}

export interface ScoredVariant {
  id: string;
  label: string;
  prompt: string;
  video_url: string;
  dimensions: DimensionScore[];
  quality_engagement_score: number;  // 0–100
}

export type UseCase = "product_ad" | "short_form" | "simulation" | "walkthrough";

export interface Session {
  session_id: string;
  questions: string[];
}

export type GenerationStatus = "generating" | "delivered" | "error";
