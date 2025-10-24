export enum AppView {
  CARTOON_FORGE = 'CARTOON_FORGE',
  IMAGE_STUDIO = 'IMAGE_STUDIO',
  CHATBOT = 'CHATBOT',
  LIVE_CONVO = 'LIVE_CONVO',
  GROUNDED_SEARCH = 'GROUNDED_SEARCH',
  CONTROL_PANEL = 'CONTROL_PANEL',
}

// === Cartoon Forge Types ===
export enum GenerationStep {
  IDEA = 'IDEA',
  SCRIPT = 'SCRIPT',
  IMAGE = 'IMAGE',
  VOICE = 'VOICE',
  VIDEO_KEY_CHECK = 'VIDEO_KEY_CHECK',
  VIDEO = 'VIDEO',
  COMPLETE = 'COMPLETE',
}

export interface ScriptData {
  title: string;
  enhancedPrompt: string;
  scene: string;
  dialogue: string;
}

export interface CartoonForgeState {
  step: GenerationStep;
  idea: string;
  character: string;
  script: ScriptData | null;
  image: string | null; // base64 string
  imageStyle: string;
  imageAspectRatio: string;
  videoAspectRatio: string;
  audio: AudioBuffer | null;
  audioData: string | null; // base64 representation of audio bytes
  isUploadedAudio?: boolean; // Flag to differentiate audio source
  videoUrl: string | null;
  videoQuality: string;
  animationStyle: string;
  videoLength: string;
  isLoading: boolean;
  loadingMessage: string;
  error: string | null;
  videoPollCount: number;
}


// === ChatBot Types ===
export interface ChatMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
}


// === Grounded Search Types ===
export interface GroundingChunk {
    web?: {
        uri: string;
        title: string;
    };
    maps?: {
        uri: string;
        title: string;
        placeAnswerSources?: {
            reviewSnippets: {
                uri: string,
                snippet: string
            }[];
        }
    };
}

export interface GroundedSearchResult {
    text: string;
    sources: GroundingChunk[];
}


// === Image Studio Types ===
export type ImageStudioMode = 'GENERATE' | 'EDIT' | 'ANALYZE';
export interface ImageStudioState {
    mode: ImageStudioMode;
    prompt: string;
    aspectRatio: string;
    generatedImage: string | null; // base64
    editedImage: string | null; // base64
    analysisResult: string | null;
    isLoading: boolean;
    error: string | null;
}

// === Live Convo Types ===
export interface TranscriptionEntry {
    speaker: 'user' | 'model';
    text: string;
}