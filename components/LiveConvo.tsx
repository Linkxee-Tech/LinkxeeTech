import React, { useState, useRef, useEffect, useCallback } from 'react';
// FIX: Removed `LiveSession` as it is not an exported member of '@google/genai'.
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAI_Blob } from '@google/genai';
import { TranscriptionEntry } from '../types';

// Helper functions for audio encoding/decoding
function encode(bytes: Uint8Array) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}


const LiveConvo: React.FC = () => {
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [statusMessage, setStatusMessage] = useState('Click "Start Conversation" to begin.');
    const [transcription, setTranscription] = useState<TranscriptionEntry[]>([]);
    
    // FIX: Changed `LiveSession` to `any` as the type is not exported from the library.
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    const nextStartTimeRef = useRef(0);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

    const stopSession = useCallback(() => {
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => session.close());
            sessionPromiseRef.current = null;
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        
        setIsSessionActive(false);
        setStatusMessage('Session ended. Click "Start Conversation" to begin again.');
    }, []);

    const startSession = async () => {
        setIsSessionActive(true);
        setStatusMessage('Initializing session...');
        setTranscription([]);
        
        try {
            streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
            setStatusMessage('Microphone access granted. Connecting to AI...');

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

            let currentInputTranscription = '';
            let currentOutputTranscription = '';

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        setStatusMessage('Connected! Start speaking.');
                        
                        const source = inputAudioContextRef.current!.createMediaStreamSource(streamRef.current!);
                        mediaStreamSourceRef.current = source;
                        const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const l = inputData.length;
                            const int16 = new Int16Array(l);
                            for (let i = 0; i < l; i++) {
                                int16[i] = inputData[i] * 32768;
                            }
                            const pcmBlob: GenAI_Blob = {
                                data: encode(new Uint8Array(int16.buffer)),
                                mimeType: 'audio/pcm;rate=16000',
                            };
                            
                            if (sessionPromiseRef.current) {
                                sessionPromiseRef.current.then((session) => {
                                    session.sendRealtimeInput({ media: pcmBlob });
                                });
                            }
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current!.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                         if (message.serverContent?.inputTranscription) {
                            currentInputTranscription += message.serverContent.inputTranscription.text;
                         }
                         if (message.serverContent?.outputTranscription) {
                            currentOutputTranscription += message.serverContent.outputTranscription.text;
                         }
                         if (message.serverContent?.turnComplete) {
                            setTranscription(prev => [...prev, 
                                { speaker: 'user', text: currentInputTranscription },
                                { speaker: 'model', text: currentOutputTranscription }
                            ]);
                            currentInputTranscription = '';
                            currentOutputTranscription = '';
                         }

                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
                        if (base64Audio) {
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current!.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current!, 24000, 1);
                            const source = outputAudioContextRef.current!.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputAudioContextRef.current!.destination);
                            source.addEventListener('ended', () => { sourcesRef.current.delete(source); });
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            sourcesRef.current.add(source);
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Session error:', e);
                        setStatusMessage(`Error: ${e.message}. Please try again.`);
                        stopSession();
                    },
                    onclose: (e: CloseEvent) => {
                        stopSession();
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                },
            });

        } catch (error) {
            console.error('Failed to start session:', error);
            setStatusMessage('Error: Could not access microphone. Please check your permissions.');
            setIsSessionActive(false);
        }
    };
    
    useEffect(() => {
        // Cleanup on component unmount
        return () => {
            stopSession();
        };
    }, [stopSession]);


    return (
        <div className="w-full max-w-2xl h-[70vh] flex flex-col bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg">
            <header className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-bold text-indigo-600 dark:text-indigo-400">Live Conversation</h2>
                <button
                    onClick={isSessionActive ? stopSession : startSession}
                    className={`font-bold py-2 px-4 rounded-md transition-colors ${
                        isSessionActive ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                    title={isSessionActive ? 'End the live voice conversation.' : 'Start a live voice conversation with the AI.'}
                >
                    {isSessionActive ? 'End Conversation' : 'Start Conversation'}
                </button>
            </header>
            <div className="flex-1 p-4 flex flex-col">
                <div className="text-center p-3 bg-gray-100 dark:bg-gray-700 rounded-md mb-4">
                    <p className="text-gray-700 dark:text-gray-300">{statusMessage}</p>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
                    {transcription.map((entry, index) => (
                        <div key={index} className={`flex ${entry.speaker === 'user' ? 'justify-end' : 'justify-start'}`}>
                             <div className={`max-w-xs md:max-w-md p-3 rounded-lg ${entry.speaker === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}`}>
                                <p className="text-sm"><strong>{entry.speaker === 'user' ? 'You' : 'AI'}:</strong> {entry.text}</p>
                            </div>
                        </div>
                    ))}
                    {!transcription.length && (
                         <div className="text-center text-gray-400 dark:text-gray-500 pt-8">
                            <p>Conversation transcript will appear here.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LiveConvo;