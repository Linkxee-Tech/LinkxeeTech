import React, { useState } from 'react';
import type { ImageStudioState } from '../types';
import * as geminiService from '../services/geminiService';
import Loader from './Loader';

const initialState: ImageStudioState = {
  mode: 'GENERATE',
  prompt: '',
  aspectRatio: '16:9',
  generatedImage: null,
  editedImage: null,
  analysisResult: null,
  isLoading: false,
  error: null,
};

const ImageStudio: React.FC = () => {
  const [state, setState] = useState<ImageStudioState>(initialState);
  const [editPrompt, setEditPrompt] = useState('');
  const [analysisPrompt, setAnalysisPrompt] = useState('');

  const handleGenerate = async () => {
    if (!state.prompt.trim()) {
        setState(s => ({...s, error: "Please enter a prompt."}));
        return;
    }
    setState(s => ({...s, isLoading: true, error: null, editedImage: null, analysisResult: null }));
    try {
        const imageBase64 = await geminiService.generateImage(state.prompt, "photorealistic", state.aspectRatio);
        setState(s => ({...s, generatedImage: imageBase64, isLoading: false, mode: 'EDIT' }));
    } catch (e) {
        console.error(e);
        setState(s => ({...s, isLoading: false, error: 'Failed to generate image. Please try again.'}));
    }
  };

  const handleEdit = async () => {
    if (!editPrompt.trim() || !state.generatedImage) return;
    setState(s => ({...s, isLoading: true, error: null }));
    try {
        const imageBase64 = await geminiService.editImage(editPrompt, state.generatedImage);
        setState(s => ({...s, editedImage: imageBase64, isLoading: false }));
    } catch (e) {
        console.error(e);
        setState(s => ({...s, isLoading: false, error: 'Failed to edit image. Please try again.'}));
    }
  };

  const handleAnalyze = async () => {
      if (!analysisPrompt.trim() || !state.generatedImage) return;
      setState(s => ({...s, isLoading: true, error: null}));
      try {
          const result = await geminiService.analyzeImage(analysisPrompt, state.generatedImage);
          setState(s => ({...s, analysisResult: result, isLoading: false}));
      } catch (e) {
          console.error(e);
          setState(s => ({...s, isLoading: false, error: 'Failed to analyze image. Please try again.'}));
      }
  };

  const handleStartOver = () => {
      setState(initialState);
      setEditPrompt('');
      setAnalysisPrompt('');
  }

  const handleDownloadImage = () => {
    const imageToDownload = state.editedImage || state.generatedImage;
    if (!imageToDownload) return;

    const a = document.createElement('a');
    a.href = `data:image/png;base64,${imageToDownload}`;
    const filename = state.prompt.substring(0, 30).replace(/[\s\W]/g, '_').toLowerCase() || 'generated_image';
    a.download = `${filename}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  
  const aspectRatios = ['16:9', '9:16', '1:1', '4:3', '3:4'];

  return (
    <div className="w-full max-w-4xl">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold mb-4 text-indigo-600 dark:text-indigo-400">Image Studio</h2>
            {state.error && <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 p-3 rounded-md mb-4">{state.error}</div>}

            {!state.generatedImage && (
                <div className="space-y-4">
                    <div>
                        <label htmlFor="image-prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Your Image Idea</label>
                        <textarea id="image-prompt" value={state.prompt} onChange={e => setState(s=>({...s, prompt: e.target.value}))} className="w-full h-24 p-2 bg-gray-50 dark:bg-gray-700 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500" placeholder="A robot holding a red skateboard." title="Describe the image you want to generate in detail."/>
                    </div>
                    <div>
                         <label htmlFor="aspect-ratio-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Aspect Ratio</label>
                         <select id="aspect-ratio-select" value={state.aspectRatio} onChange={(e) => setState(s => ({...s, aspectRatio: e.target.value}))} className="bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500" title="Choose the aspect ratio for your generated image.">
                            {aspectRatios.map(ar => (<option key={ar} value={ar}>{ar}</option>))}
                        </select>
                    </div>
                    <button onClick={handleGenerate} disabled={state.isLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-indigo-400" title="Generate an image based on your prompt and settings.">
                        {state.isLoading ? <Loader message="Generating..." /> : 'Generate Image'}
                    </button>
                </div>
            )}

            {state.generatedImage && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    <div className="space-y-4">
                       <h3 className="text-xl font-semibold">Your Image</h3>
                       <p className="text-sm text-gray-500 dark:text-gray-400">{state.prompt}</p>
                       <img src={`data:image/png;base64,${state.editedImage || state.generatedImage}`} alt="Generated content" className="rounded-lg border-2 border-gray-200 dark:border-gray-600 w-full" />
                       <div className="flex gap-4">
                         <button onClick={handleDownloadImage} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors" title="Download the current image as a PNG file.">Download Image</button>
                         <button onClick={handleStartOver} className="flex-1 bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors" title="Clear the current session and start a new image generation.">Start Over</button>
                       </div>
                    </div>
                    <div className="space-y-6">
                        {/* Edit Section */}
                        <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
                            <h4 className="text-lg font-semibold mb-2">Edit Image</h4>
                            <textarea value={editPrompt} onChange={e => setEditPrompt(e.target.value)} className="w-full h-20 p-2 bg-white dark:bg-gray-600 rounded-md" placeholder="e.g., Add a retro filter, remove the background..." title="Describe the changes you want to make to the image."/>
                            <button onClick={handleEdit} disabled={state.isLoading} className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-blue-400" title="Apply the described edit to your image.">
                                {state.isLoading && state.mode === 'EDIT' ? 'Editing...' : 'Apply Edit'}
                            </button>
                        </div>
                        {/* Analyze Section */}
                        <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
                            <h4 className="text-lg font-semibold mb-2">Analyze Image</h4>
                             <textarea value={analysisPrompt} onChange={e => setAnalysisPrompt(e.target.value)} className="w-full h-20 p-2 bg-white dark:bg-gray-600 rounded-md" placeholder="e.g., What is the main subject? Describe the style." title="Ask a question about the image (e.g., 'What is the main color?')."/>
                             <button onClick={handleAnalyze} disabled={state.isLoading} className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-green-400" title="Get a descriptive analysis or answer based on your question.">
                                {state.isLoading && state.mode === 'ANALYZE' ? 'Analyzing...' : 'Ask Question'}
                             </button>
                             {state.isLoading && state.analysisResult && <Loader message="Analyzing..." />}
                             {state.analysisResult && !state.isLoading && (
                                 <div className="mt-4 p-3 bg-gray-200 dark:bg-gray-800 rounded-md text-sm text-gray-700 dark:text-gray-300">
                                     <p>{state.analysisResult}</p>
                                 </div>
                             )}
                        </div>
                    </div>
                 </div>
            )}
        </div>
    </div>
  );
};

export default ImageStudio;