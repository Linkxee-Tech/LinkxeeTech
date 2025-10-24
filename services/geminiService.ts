import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { ScriptData, GroundingChunk } from '../types';

const SCRIPT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "A catchy, short title for the cartoon.",
    },
    enhancedPrompt: {
      type: Type.STRING,
      description: "A visually descriptive prompt for an image generator, focusing on a single character or scene in a '3D render, Pixar-style, cartoon, HD' style. Should be detailed and around 50-100 words.",
    },
    scene: {
        type: Type.STRING,
        description: "A brief description of the single scene for the animation.",
    },
    dialogue: {
      type: Type.STRING,
      description: "A single, short line of dialogue (10-15 words) that a character would say in the scene. This will be used for the voiceover.",
    },
  },
  required: ["title", "enhancedPrompt", "scene", "dialogue"],
};

export const generateScript = async (idea: string, character: string, model: string): Promise<ScriptData> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    let prompt = `Based on this idea, create a short cartoon concept: "${idea}".`;
    if (character && character.trim() !== '') {
        prompt += ` The main character is: "${character}". Make sure the enhanced image prompt strongly features this character description.`;
    }
    prompt += ` Generate a title, an enhanced image prompt, a scene description, and a single line of dialogue.`;

    const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: SCRIPT_SCHEMA,
            // Add thinking budget for more complex script generation
            thinkingConfig: { thinkingBudget: 8192 } 
        },
    });
    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
};

export const generateImage = async (prompt: string, style: string, aspectRatio: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const fullPrompt = `${prompt}, in the style of ${style}`;
    
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: fullPrompt,
        config: {
            numberOfImages: 1,
            aspectRatio: aspectRatio,
        }
    });
    if (!response.generatedImages || response.generatedImages.length === 0) {
        throw new Error("Image generation failed.");
    }
    return response.generatedImages[0].image.imageBytes;
};

export const editImage = async (prompt: string, imageBase64: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                {
                    inlineData: {
                        data: imageBase64,
                        mimeType: 'image/png',
                    },
                },
                { text: prompt },
            ],
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return part.inlineData.data;
        }
    }
    throw new Error("Image editing failed to produce an image.");
};

export const analyzeImage = async (prompt: string, imageBase64: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                {
                    inlineData: {
                        data: imageBase64,
                        mimeType: 'image/png',
                    },
                },
                { text: prompt },
            ],
        },
    });
    return response.text;
};


export const generateAudio = async (text: string): Promise<Uint8Array> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say with a friendly cartoon voice: ${text}` }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Puck' },
                },
            },
        },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
        throw new Error("Audio generation failed.");
    }

    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
};

export const decodeAudioData = async (
    data: Uint8Array,
    ctx: AudioContext
): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length; // Mono audio
    const buffer = ctx.createBuffer(1, frameCount, 24000); // 1 channel, 24kHz sample rate
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
};


export const generateVideo = async (prompt: string, imageBase64: string, resolution: string, aspectRatio: string, animationStyle: string, length: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const styledPrompt = `A ${animationStyle} style animation of: ${prompt}. The video should be ${length} long.`;

    const operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: styledPrompt,
        image: {
            imageBytes: imageBase64,
            mimeType: 'image/png',
        },
        config: {
            numberOfVideos: 1,
            resolution: resolution,
            aspectRatio: aspectRatio,
        }
    });
    return operation;
};

export const pollVideoOperation = async (operation: any) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return await ai.operations.getVideosOperation({ operation: operation });
};


export const getGroundedResponse = async (prompt: string, useMaps: boolean, model: string, location: GeolocationPosition | null) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const tools: any[] = useMaps ? [{ googleMaps: {} }] : [{ googleSearch: {} }];
    const toolConfig: any = {};

    if (useMaps && location) {
        toolConfig.retrievalConfig = {
            latLng: {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            }
        };
    }
    
    const thinkingConfig = model === 'gemini-2.5-pro' ? { thinkingBudget: 32768 } : {};

    const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
            tools: tools,
            toolConfig: toolConfig,
            thinkingConfig: thinkingConfig,
        },
    });

    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    return {
        text: response.text,
        sources: sources as GroundingChunk[]
    };
};