
export type StyleCategory = 'Realista' | 'Anime' | '3D' | 'Esboço Artístico' | 'História em Quadrinhos' | 'Geral/Misto';

export interface GeneratedPrompt {
  style: string;
  prompt: string;
  description: string;
  translatedPrompt?: string;
  translatedStyleDescription?: string;
}

export interface AnalysisResult {
  detailedDescription: string;
  translatedDescription?: string;
  prompts: GeneratedPrompt[];
  category?: StyleCategory;
}

export enum AppState {
  IDLE = 'IDLE',
  CAPTURING = 'CAPTURING',
  ANALYZING = 'ANALYZING',
  RESULT = 'RESULT',
  GENERATING_IMAGE = 'GENERATING_IMAGE'
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
