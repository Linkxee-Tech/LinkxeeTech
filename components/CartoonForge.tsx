import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GenerationStep, type CartoonForgeState, type ScriptData } from '../types';
import * as geminiService from '../services/geminiService';
import { useSettings } from '../contexts/SettingsContext';
import StepIndicator from './StepIndicator';
import Loader from './Loader';
import ApiKeySelector from './ApiKeySelector';

const initialState: CartoonForgeState = {
  step: GenerationStep.IDEA,
  idea: '',
  character: '',
  script: null,
  image: null,
  imageStyle: '3D Render',
  imageAspectRatio: '16:9',
  videoAspectRatio: '16:9',
  audio: null,
  audioData: null,
  isUploadedAudio: false,
  videoUrl: null,
  videoQuality: '720p',
  animationStyle: 'cinematic',
  videoLength: '5s',
  isLoading: false,
  loadingMessage: '',
  error: null,
  videoPollCount: 0,
};

// --- Helper Functions ---
const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const createWavFile = (audioBuffer: AudioBuffer): Blob => {
    const numOfChan = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numOfChan * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let i, sample;
    let offset = 0;
    let pos = 0;

    const setUint16 = (data: number) => {
        view.setUint16(pos, data, true);
        pos += 2;
    }
    const setUint32 = (data: number) => {
        view.setUint32(pos, data, true);
        pos += 4;
    }

    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(audioBuffer.sampleRate);
    setUint32(audioBuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit
    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    for (i = 0; i < numOfChan; i++)
        channels.push(audioBuffer.getChannelData(i));

    while (pos < length) {
        for (i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
            view.setInt16(pos, sample, true);
            pos += 2;
        }
        offset++
    }
    return new Blob([view], { type: 'audio/wav' });
};


// Global audio context
let audioContext: AudioContext | null = null;
const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  }
  return audioContext;
};

const CartoonForge: React.FC = () => {
  const [state, setState] = useState<CartoonForgeState>(initialState);
  const [videoOperation, setVideoOperation] = useState<any>(null);
  const [savedProjectExists, setSavedProjectExists] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [dialogueForUpload, setDialogueForUpload] = useState('');

  const { settings } = useSettings();

  // State for custom video controls
  const [videoPlaybackState, setVideoPlaybackState] = useState({
    isPlaying: false,
    progress: 0,
    volume: 1,
    currentTime: 0,
    duration: 0,
  });
  const [showControls, setShowControls] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);


  useEffect(() => {
    if (localStorage.getItem('cartoonForgeProject')) {
      setSavedProjectExists(true);
    }
  }, []);
  
  useEffect(() => {
    // When the component unmounts or the videoUrl changes, revoke the old object URL to free up memory
    const currentVideoUrl = state.videoUrl;
    return () => {
        if (currentVideoUrl && currentVideoUrl.startsWith('blob:')) {
            URL.revokeObjectURL(currentVideoUrl);
        }
    };
  }, [state.videoUrl]);

  const setError = (message: string) => {
    setState(prevState => ({ ...prevState, error: message, isLoading: false }));
  };

  const saveProject = () => {
    const savableState = { ...state, audio: null }; // Don't save non-serializable AudioBuffer
    localStorage.setItem('cartoonForgeProject', JSON.stringify(savableState));
    setSavedProjectExists(true);
    setSaveMessage('Project saved!');
    setTimeout(() => setSaveMessage(''), 2500);
  };

  const loadProject = async () => {
    if (!window.confirm('This will overwrite your current progress. Are you sure?')) return;
    const savedStateJSON = localStorage.getItem('cartoonForgeProject');
    if (savedStateJSON) {
      setState(s => ({...s, isLoading: true, loadingMessage: 'Loading project...'}));
      try {
        const savedState = JSON.parse(savedStateJSON);
        
        // --- Backwards compatibility for projects saved with old quality settings ---
        if (savedState.videoResolution) { // For very old format
            savedState.videoQuality = savedState.videoResolution;
            delete savedState.videoResolution;
        } else if (savedState.videoQuality) { // For 'Standard'/'High Quality' format
            if (savedState.videoQuality === 'Standard') {
                savedState.videoQuality = '720p';
            } else if (savedState.videoQuality === 'High Quality') {
                savedState.videoQuality = '1080p';
            }
        }
        // --- End backwards compatibility ---

        let audioBuffer: AudioBuffer | null = null;
        if (savedState.audioData) {
          const audioBytes = base64ToUint8Array(savedState.audioData);
          const ctx = getAudioContext();
          if (savedState.isUploadedAudio) {
            audioBuffer = await ctx.decodeAudioData(audioBytes.buffer);
          } else {
            audioBuffer = await geminiService.decodeAudioData(audioBytes, ctx);
          }
        }
        setState({
          ...initialState,
          ...savedState,
          audio: audioBuffer,
          isLoading: false,
        });
      } catch (e) {
        console.error("Failed to load project:", e);
        setError("Could not load project. Data might be corrupted.");
        localStorage.removeItem('cartoonForgeProject');
        setSavedProjectExists(false);
      }
    }
  };

  const handleGenerateScript = async () => {
    if (!state.idea.trim()) {
      setError("Please enter an idea first.");
      return;
    }
    setState(prevState => ({ ...prevState, isLoading: true, loadingMessage: 'Crafting your script...', error: null }));
    try {
      const script = await geminiService.generateScript(state.idea, state.character, settings.scriptModel);
      setState(prevState => ({ ...prevState, script, isLoading: false, step: GenerationStep.SCRIPT }));
    } catch (error) {
      console.error(error);
      setError("Failed to generate script. Please try again.");
    }
  };

  const handleGenerateImage = async () => {
    if (!state.script) return;
    setState(prevState => ({ ...prevState, isLoading: true, loadingMessage: 'Creating your character...', error: null }));
    try {
      const imageBase64 = await geminiService.generateImage(state.script.enhancedPrompt, state.imageStyle, state.imageAspectRatio);
      setState(prevState => ({ ...prevState, image: imageBase64, isLoading: false, step: GenerationStep.IMAGE }));
    } catch (error) {
      console.error(error);
      setError("Failed to generate image. Please try again.");
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setState(prevState => ({ ...prevState, isLoading: true, loadingMessage: 'Processing image...' }));
    const reader = new FileReader();
    reader.onload = (e) => {
        const base64 = (e.target?.result as string).split(',')[1];
        setState(prevState => ({...prevState, image: base64, isLoading: false, step: GenerationStep.IMAGE, script: null }));
    };
    reader.onerror = () => {
        setError("Failed to read the image file.");
    };
    reader.readAsDataURL(file);
  };


  const handleGenerateAudio = async (dialogue: string) => {
    if (!dialogue.trim()) {
      setError("Please provide dialogue for the audio.");
      return;
    }
    setState(prevState => ({ ...prevState, isLoading: true, loadingMessage: 'Recording voiceover...', error: null }));
    try {
        const audioBytes = await geminiService.generateAudio(dialogue);
        const audioDataBase64 = uint8ArrayToBase64(audioBytes);
        const ctx = getAudioContext();
        const audioBuffer = await geminiService.decodeAudioData(audioBytes, ctx);
        
        const currentScript = state.script || { title: 'Uploaded Creation', enhancedPrompt: '', scene: 'As depicted in the image.', dialogue };

        setState(prevState => ({ 
            ...prevState, 
            script: currentScript,
            audio: audioBuffer, 
            audioData: audioDataBase64,
            isUploadedAudio: false,
            isLoading: false, 
            step: GenerationStep.VOICE 
        }));
    } catch (error) {
        console.error(error);
        setError("Failed to generate audio. Please try again.");
    }
  };

  const handleAudioUpload = async (event: React.ChangeEvent<HTMLInputElement>, dialogue?: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
        setError('Please upload a valid audio file (e.g., MP3, WAV).');
        return;
    }

    setState(prevState => ({ ...prevState, isLoading: true, loadingMessage: 'Processing your audio...' }));
    try {
        const audioDataArrayBuffer = await file.arrayBuffer();
        const audioDataBase64 = uint8ArrayToBase64(new Uint8Array(audioDataArrayBuffer));
        const ctx = getAudioContext();
        const audioBuffer = await ctx.decodeAudioData(audioDataArrayBuffer.slice(0));
        
        const finalDialogue = dialogue || state.script?.dialogue || "User provided audio.";
        const currentScript = state.script || { title: 'Uploaded Creation', enhancedPrompt: '', scene: 'As depicted in the image.', dialogue: finalDialogue };

        setState(prevState => ({
            ...prevState,
            script: currentScript,
            audio: audioBuffer,
            audioData: audioDataBase64,
            isUploadedAudio: true,
            isLoading: false,
            step: GenerationStep.VOICE
        }));

    } catch (error) {
        console.error("Error processing uploaded audio:", error);
        setError("Could not process the audio file. It might be corrupted or in an unsupported format.");
    }
  };
  
  const playAudio = () => {
    if (!state.audio) return;
    const ctx = getAudioContext();
    const source = ctx.createBufferSource();
    source.buffer = state.audio;
    source.connect(ctx.destination);
    source.start(0);
  };

  const handleDownloadScript = () => {
    if (!state.script) return;
    const { title, scene, dialogue, enhancedPrompt } = state.script;
    const content = `Title: ${title}\n\nScene: ${scene}\n\nDialogue: "${dialogue}"\n\n---\n\nImage Prompt:\n${enhancedPrompt}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[\s\W]/g, '_').toLowerCase()}_script.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadImage = () => {
    if (!state.image) return;
    const a = document.createElement('a');
    a.href = `data:image/png;base64,${state.image}`;
    const filename = state.script?.title.replace(/[\s\W]/g, '_').toLowerCase() || 'cartoonforge';
    a.download = `${filename}_image.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };


  const handleDownloadAudio = () => {
    if (!state.audioData) return;
    let blob: Blob;
    let filename: string;
    
    if (state.isUploadedAudio) {
        const audioBytes = base64ToUint8Array(state.audioData);
        blob = new Blob([audioBytes]);
        filename = 'uploaded_audio.mp3';
    } else if (state.audio) {
        blob = createWavFile(state.audio);
        filename = 'cartoonforge_voiceover.wav';
    } else {
        return;
    }
  
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleVideoKeySelected = async () => {
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (hasKey) {
        setState(prevState => ({ ...prevState, step: GenerationStep.VIDEO, error: null, videoPollCount: 0 }));
        await handleGenerateVideo();
    } else {
        setError("API key selection was not successful. Please try again.");
        setState(prevState => ({ ...prevState, step: GenerationStep.VIDEO_KEY_CHECK }));
    }
  };

  const handleGenerateVideo = async () => {
    if (!state.script || !state.image) return;
    setState(prevState => ({ ...prevState, isLoading: true, loadingMessage: 'Starting animation engine...', videoPollCount: 0 }));
    try {
        const resolution = state.videoQuality;

        const operation = await geminiService.generateVideo(state.script.scene, state.image, resolution, state.videoAspectRatio, state.animationStyle, state.videoLength);
        setVideoOperation(operation);
    } catch (err: any) {
        console.error(err);
        if (err.message?.includes("Requested entity was not found")) {
            setError("API Key verification failed. Please select a valid key.");
            setState(prevState => ({ ...prevState, step: GenerationStep.VIDEO_KEY_CHECK }));
        } else {
            setError("Failed to start video generation.");
        }
    }
  };
  
  const pollVideoStatus = useCallback(async () => {
    if (!videoOperation || videoOperation.done) return;
    
    const messages = [
        "Animating your world...",
        "Rendering frames...",
        "Adding final touches...",
        "Almost there..."
    ];
    const messageIndex = Math.floor(state.videoPollCount / 2);

    setState(prevState => ({
        ...prevState,
        loadingMessage: messages[Math.min(messageIndex, messages.length - 1)] || "Processing...",
        videoPollCount: prevState.videoPollCount + 1
    }));
    
    try {
        const updatedOp = await geminiService.pollVideoOperation(videoOperation);
        setVideoOperation(updatedOp);
    } catch (error) {
        console.error("Polling error:", error);
        setError("Error checking video status.");
        setVideoOperation(null);
    }
  }, [videoOperation, state.videoPollCount]);
  
  useEffect(() => {
    if (state.step === GenerationStep.VIDEO && videoOperation && !videoOperation.done) {
        const interval = setInterval(pollVideoStatus, 10000);
        return () => clearInterval(interval);
    }
    
    if (videoOperation?.done) {
        if (videoOperation.response?.generatedVideos?.[0]?.video?.uri) {
            const fetchAndSetVideo = async () => {
                setState(prevState => ({ ...prevState, isLoading: true, loadingMessage: 'Downloading final animation...' }));
                try {
                    const url = `${videoOperation.response.generatedVideos[0].video.uri}&key=${process.env.API_KEY}`;
                    const response = await fetch(url);
                    if (!response.ok) throw new Error(`Failed to fetch video file: ${response.statusText}`);
                    const videoBlob = await response.blob();
                    const blobUrl = URL.createObjectURL(videoBlob);
                    
                    setState(prevState => ({
                        ...prevState,
                        videoUrl: blobUrl,
                        isLoading: false,
                        step: GenerationStep.COMPLETE,
                    }));
                } catch (e) {
                     console.error("Video fetch error:", e);
                     setError("Failed to download the generated video. Please try again.");
                     setVideoOperation(null);
                }
            };
            fetchAndSetVideo();
        } else {
            setError("Video generation finished but no video was returned.");
            setVideoOperation(null);
        }
    }
  }, [state.step, videoOperation, pollVideoStatus]);

  const handleDownloadVideo = () => {
    if (!state.videoUrl) return;
    const a = document.createElement('a');
    a.href = state.videoUrl;
    a.download = "cartoonforge_animation.mp4";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleStartOver = () => {
      setVideoOperation(null);
      setState(initialState);
      setVideoPlaybackState({
        isPlaying: false,
        progress: 0,
        volume: 1,
        currentTime: 0,
        duration: 0,
      });
  }

  // --- Video Control Handlers ---
  const handleTimeUpdate = () => {
      if (videoRef.current) {
          const progress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
          setVideoPlaybackState(prevState => ({
              ...prevState,
              currentTime: videoRef.current!.currentTime,
              progress: isNaN(progress) ? 0 : progress,
          }));
      }
  };

  const handleLoadedMetadata = () => {
      if (videoRef.current) {
          setVideoPlaybackState(prevState => ({
              ...prevState,
              duration: videoRef.current!.duration,
          }));
      }
  };

  const togglePlayPause = () => {
      if (videoRef.current) {
          const isPlaying = !videoRef.current.paused;
          if (isPlaying) {
              videoRef.current.pause();
          } else {
              videoRef.current.play();
          }
          setVideoPlaybackState(s => ({ ...s, isPlaying: !isPlaying }));
      }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
      if (videoRef.current) {
          const progressBar = e.currentTarget;
          const rect = progressBar.getBoundingClientRect();
          const offsetX = e.clientX - rect.left;
          const newTime = (offsetX / progressBar.offsetWidth) * videoRef.current.duration;
          videoRef.current.currentTime = newTime;
      }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVolume = parseFloat(e.target.value);
      if (videoRef.current) {
          videoRef.current.volume = newVolume;
      }
      setVideoPlaybackState(s => ({ ...s, volume: newVolume }));
  };

  const formatTime = (timeInSeconds: number): string => {
      if (isNaN(timeInSeconds) || timeInSeconds === Infinity) {
          return '00:00';
      }
      const minutes = Math.floor(timeInSeconds / 60);
      const seconds = Math.floor(timeInSeconds % 60);
      return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };
  
  const renderContent = () => {
    if (state.isLoading) {
      if (state.step === GenerationStep.VIDEO) {
        const MAX_POLL_COUNT = 15; // Approx 2.5 minutes total wait time
        const progress = Math.min((state.videoPollCount / MAX_POLL_COUNT) * 100, 100);
        return (
          <div className="w-full max-w-lg text-center">
            <Loader message={state.loadingMessage} />
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-4">
              <div
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500 ease-linear"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Animation can take a few minutes. Please be patient.</p>
          </div>
        );
      }
      return <Loader message={state.loadingMessage} />;
    }

    switch (state.step) {
      case GenerationStep.IDEA:
        const archetypes = ['friendly robot', 'grumpy wizard', 'curious alien', 'brave knight'];
        return (
          <div className="w-full max-w-lg">
            <div className="flex justify-center mb-6">
                <div className="absolute top-4 right-4 flex items-center gap-2">
                    {saveMessage && <span className="text-green-500 dark:text-green-400 text-sm transition-opacity duration-300">{saveMessage}</span>}
                    <button onClick={saveProject} disabled={state.isLoading} className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 rounded-lg text-gray-800 dark:text-white transition-colors" title="Save your current progress to your browser's local storage.">Save Project</button>
                    <button onClick={loadProject} disabled={!savedProjectExists || state.isLoading} className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 rounded-lg text-gray-800 dark:text-white transition-colors" title="Load a previously saved project from your browser. This will overwrite current progress.">Load Project</button>
                </div>
            </div>
            <h2 className="text-2xl font-bold text-center mb-4">From Thought to Cartoon — Instantly.</h2>
            
            <label htmlFor="idea-input" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Your Story Idea</label>
            <textarea
              id="idea-input"
              className="w-full h-32 p-3 bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g., A brave squirrel astronaut searching for the galaxy's largest acorn."
              value={state.idea}
              onChange={(e) => setState({ ...state, idea: e.target.value })}
              title="Enter the main idea or concept for your cartoon."
            />

            <div className="mt-4">
              <label htmlFor="character-input" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Main Character (Optional)</label>
              <input id="character-input" type="text" className="w-full p-3 bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g., A small squirrel with a big helmet" value={state.character} onChange={(e) => setState({ ...state, character: e.target.value })} title="Describe your main character, or leave blank."/>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="text-sm text-gray-500 self-center">Or pick an archetype:</span>
                {archetypes.map(char => (<button key={char} onClick={() => setState({...state, character: char})} className="px-3 py-1 text-sm bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 rounded-full text-gray-800 dark:text-white transition-colors" title={`Set character to '${char}'`}>{char}</button>))}
              </div>
            </div>
            
             <div className="relative flex py-5 items-center">
              <div className="flex-grow border-t border-gray-400 dark:border-gray-600"></div>
              <span className="flex-shrink mx-4 text-gray-500 dark:text-gray-400">OR</span>
              <div className="flex-grow border-t border-gray-400 dark:border-gray-600"></div>
            </div>
            <label htmlFor="image-upload-start" className="w-full block bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-bold py-3 px-4 rounded-lg transition-colors cursor-pointer text-center" title="Bypass idea generation and start with an image you already have.">
                Start with Your Own Image
            </label>
            <input type="file" id="image-upload-start" className="hidden" accept="image/*" onChange={handleImageUpload} />

            <button onClick={handleGenerateScript} className="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-colors" title="Generate a script based on your idea and character.">Forge My Script</button>
          </div>
        );

      case GenerationStep.SCRIPT:
        const styles = ['3D Render', 'Anime', 'Fantasy Art', 'Cyberpunk', 'Watercolor'];
        const aspectRatios = ['16:9', '9:16', '1:1', '4:3', '3:4'];
        return state.script && (
          <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
            <h2 className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">{state.script.title}</h2>
            <div className="space-y-4 text-gray-600 dark:text-gray-300">
                <p><strong className="text-gray-900 dark:text-white">Scene:</strong> {state.script.scene}</p>
                <p className="italic"><strong className="text-gray-900 dark:text-white not-italic">Dialogue:</strong> "{state.script.dialogue}"</p>
                <details className="bg-gray-100 dark:bg-gray-700 p-3 rounded"><summary className="cursor-pointer font-semibold text-gray-900 dark:text-white" title="Click to view the detailed prompt sent to the image generator.">View Image Prompt</summary><p className="mt-2 text-sm">{state.script.enhancedPrompt}</p></details>
            </div>
            
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Select Image Style</h3>
                    <div className="flex flex-wrap gap-3">
                        {styles.map(style => (<button key={style} onClick={() => setState(s => ({...s, imageStyle: style}))} className={`px-4 py-2 text-sm rounded-full transition-colors ${state.imageStyle === style ? 'bg-indigo-600 text-white font-bold' : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-200'}`} title={`Set image style to ${style}`}>{style}</button>))}
                    </div>
                </div>
                 <div>
                    <label htmlFor="aspect-ratio-select" className="block text-lg font-semibold text-gray-900 dark:text-white mb-3">Aspect Ratio</label>
                    <select id="aspect-ratio-select" value={state.imageAspectRatio} onChange={(e) => setState(s => ({...s, imageAspectRatio: e.target.value}))} className="bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full" title="Select the aspect ratio for the generated image.">
                        {aspectRatios.map(ar => (<option key={ar} value={ar}>{ar}</option>))}
                    </select>
                </div>
            </div>

            <div className="mt-6 flex gap-4">
              <button onClick={handleDownloadScript} className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-bold py-3 px-4 rounded-lg transition-colors" title="Download the script as a .txt file.">Download Script</button>
              <button onClick={handleGenerateImage} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-colors" title="Generate the character image based on the script and style settings.">Create Cartoon Canvas</button>
            </div>
          </div>
        );
    
      case GenerationStep.IMAGE:
          if (state.image && !state.script) {
              // This is the new flow for user-uploaded images
              return (
                  <div className="w-full max-w-2xl text-center">
                      <h3 className="text-2xl font-bold mb-4">Your Image</h3>
                      <img src={`data:image/png;base64,${state.image}`} alt="Uploaded content" className="rounded-lg shadow-xl mb-6 border-4 border-gray-300 dark:border-gray-700" />
                      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
                          <h4 className="text-lg font-semibold">Add a Voiceover</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">What does your character say? Enter a short line of dialogue below.</p>
                          <textarea
                              className="w-full h-24 p-3 bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              placeholder="e.g., To the stars, and beyond!"
                              value={dialogueForUpload}
                              onChange={(e) => setDialogueForUpload(e.target.value)}
                              title="Enter the dialogue for the voiceover."
                          />
                          <button onClick={() => handleGenerateAudio(dialogueForUpload)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-colors" title="Use AI to generate a voiceover for your dialogue.">Generate AI Voiceover</button>
                           <div className="relative flex py-2 items-center">
                              <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div><span className="flex-shrink mx-4 text-gray-500 dark:text-gray-400">OR</span><div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                           </div>
                           <label htmlFor="audio-upload-alt" className="w-full block bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-bold py-3 px-4 rounded-lg transition-colors cursor-pointer" title="Upload your own pre-recorded audio file.">Upload Your Own Audio</label>
                           <input type="file" id="audio-upload-alt" className="hidden" accept="audio/*" onChange={(e) => handleAudioUpload(e, dialogueForUpload)} />
                      </div>
                  </div>
              );
          }
          return state.image && state.script && (
            <div className="w-full max-w-2xl text-center">
              <img src={`data:image/png;base64,${state.image}`} alt="Generated cartoon" className="rounded-lg shadow-xl mb-6 border-4 border-gray-300 dark:border-gray-700"/>
              <div className="space-y-4">
                <button onClick={() => handleGenerateAudio(state.script!.dialogue)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-colors" title="Use AI to generate a voiceover from the script's dialogue.">Generate AI Voiceover</button>
                <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div><span className="flex-shrink mx-4 text-gray-500 dark:text-gray-400">OR</span><div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                </div>
                <label htmlFor="audio-upload" className="w-full block bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-800 dark:text-white font-bold py-3 px-4 rounded-lg transition-colors cursor-pointer" title="Upload your own pre-recorded audio file.">Upload Your Own Audio</label>
                <input type="file" id="audio-upload" className="hidden" accept="audio/*" onChange={handleAudioUpload} />
              </div>
            </div>
          );

      case GenerationStep.VOICE:
        const qualityOptions = [
            { value: '720p', label: '720p (Standard)' },
            { value: '1080p', label: '1080p (High Quality)' },
        ];
        const animationStyles = ['cinematic', 'anime', 'stop-motion', 'action', 'storytelling', 'dynamic', 'smooth'];
        const lengthOptions = ['5s', '10s', '15s'];
        const videoAspectRatios = ['16:9', '9:16'];
        return (
            <div className="w-full max-w-2xl text-center">
                <img src={`data:image/png;base64,${state.image}`} alt="Generated cartoon" className="rounded-lg shadow-xl mb-6 border-4 border-gray-300 dark:border-gray-700"/>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg mb-4 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Confirmation</h3>
                    <p className="text-gray-600 dark:text-gray-400"><span className="font-bold text-gray-800 dark:text-gray-300">Style:</span> {state.imageStyle}</p>
                    <p className="text-gray-600 dark:text-gray-400 italic"><span className="font-bold text-gray-800 dark:text-gray-300 not-italic">Dialogue:</span> "{state.script?.dialogue}"</p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-lg italic text-gray-700 dark:text-gray-300 mb-4">"{state.script?.dialogue}"</p>
                    <div className="flex items-center justify-center gap-4 mb-4">
                      <button onClick={playAudio} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-full flex items-center justify-center" title="Play the generated or uploaded voiceover."><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Play Voice</button>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                        <button onClick={handleDownloadImage} className="text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-bold py-2 px-4 rounded-lg transition-colors" title="Download the generated character image as a PNG file.">Download Image</button>
                        <button onClick={handleDownloadAudio} className="text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-bold py-2 px-4 rounded-lg transition-colors" title="Download the voiceover audio file.">Download Audio</button>
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-300 dark:border-gray-600">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Animation Settings</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
                        <div>
                            <label htmlFor="quality-select" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Quality</label>
                            <select id="quality-select" value={state.videoQuality} onChange={(e) => setState(s => ({...s, videoQuality: e.target.value}))} className="bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full" aria-label="Video Quality" title="Select the output resolution for the video.">
                                {qualityOptions.map(quality => (<option key={quality.value} value={quality.value}>{quality.label}</option>))}
                            </select>
                        </div>
                         <div>
                            <label htmlFor="video-ar-select" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Aspect Ratio</label>
                            <select id="video-ar-select" value={state.videoAspectRatio} onChange={(e) => setState(s => ({ ...s, videoAspectRatio: e.target.value }))} className="bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full" aria-label="Video Aspect Ratio" title="Select the aspect ratio for the final video.">
                                {videoAspectRatios.map(ar => (<option key={ar} value={ar}>{ar}</option>))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="animation-style-select" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Animation Style</label>
                            <select id="animation-style-select" value={state.animationStyle} onChange={(e) => setState(s => ({ ...s, animationStyle: e.target.value }))} className="bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full" aria-label="Animation Style" title="Choose the visual style for the animation.">
                                {animationStyles.map(style => (<option key={style} value={style}>{style.charAt(0).toUpperCase() + style.slice(1)}</option>))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="length-select" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Length</label>
                            <select id="length-select" value={state.videoLength} onChange={(e) => setState(s => ({ ...s, videoLength: e.target.value }))} className="bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full" aria-label="Video Length" title="Set the approximate duration of the final animation.">
                                {lengthOptions.map(length => (<option key={length} value={length}>{length}</option>))}
                            </select>
                        </div>
                    </div>
                </div>

                <button onClick={() => setState(p => ({...p, step: GenerationStep.VIDEO_KEY_CHECK}))} className="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-colors" title="Start the final animation process.">Animate It!</button>
            </div>
        );

      case GenerationStep.VIDEO_KEY_CHECK:
        return <ApiKeySelector onKeySelected={handleVideoKeySelected} />;

      case GenerationStep.COMPLETE:
        return state.videoUrl && (
            <div className="w-full max-w-2xl text-center">
                <h2 className="text-3xl font-bold text-green-600 dark:text-green-400 mb-4">Your Cartoon is Complete!</h2>
                <div className="relative" onMouseEnter={() => setShowControls(true)} onMouseLeave={() => setShowControls(false)}>
                    <video ref={videoRef} loop playsInline poster={`data:image/png;base64,${state.image}`} src={state.videoUrl} className="w-full rounded-lg shadow-xl mb-6 border-4 border-gray-300 dark:border-gray-700" onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata} onPlay={() => setVideoPlaybackState(s => ({ ...s, isPlaying: true }))} onPause={() => setVideoPlaybackState(s => ({ ...s, isPlaying: false }))} onClick={togglePlayPause}/>
                    {(showControls || !videoPlaybackState.isPlaying) && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 p-2 text-white flex items-center gap-3 transition-opacity duration-300 rounded-b-lg">
                            <button onClick={togglePlayPause} className="hover:text-indigo-400 transition-colors" title={videoPlaybackState.isPlaying ? 'Pause' : 'Play'}>
                                {videoPlaybackState.isPlaying ? (<svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>) : (<svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>)}
                            </button>
                            <span className="text-sm font-mono">{formatTime(videoPlaybackState.currentTime)}</span>
                            <div className="flex-grow group flex items-center">
                                <div className="w-full h-1.5 bg-gray-600 rounded cursor-pointer" onClick={handleSeek} title="Seek video progress"><div className="h-full bg-indigo-500 rounded" style={{ width: `${videoPlaybackState.progress}%` }}></div></div>
                            </div>
                            <span className="text-sm font-mono">{formatTime(videoPlaybackState.duration)}</span>
                            <div className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                                <input type="range" min="0" max="1" step="0.01" value={videoPlaybackState.volume} onChange={handleVolumeChange} className="w-20 h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer" title="Adjust volume"/>
                            </div>
                        </div>
                    )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
                    <button onClick={handleDownloadImage} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors" title="Download the final character image as a PNG file.">Download Image</button>
                    <button onClick={handleDownloadVideo} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors" title="Download your completed animation as an MP4 file.">Download Video</button>
                    <button onClick={handleStartOver} className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-colors" title="Start a new project from scratch.">Create Another</button>
                </div>
            </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
        <div className="w-full mb-12 mt-4 h-20 flex justify-center">
          <StepIndicator currentStep={state.step} />
        </div>
        {state.error && <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 p-4 rounded-lg mb-6 w-full max-w-lg text-center">{state.error}</div>}
        <div className="w-full flex justify-center">
          {renderContent()}
        </div>
    </div>
  );
};

export default CartoonForge;