import React, { useState } from 'react';
import type { GroundedSearchResult } from '../types';
import * as geminiService from '../services/geminiService';
import { useSettings } from '../contexts/SettingsContext';
import Loader from './Loader';

const GroundedSearch: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [searchType, setSearchType] = useState<'web' | 'maps'>('web');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GroundedSearchResult | null>(null);
  const [location, setLocation] = useState<GeolocationPosition | null>(null);
  const [copySuccess, setCopySuccess] = useState('');
  const { settings } = useSettings();

  const handleSearch = async () => {
    if (!prompt.trim()) {
      setError("Please enter a question.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    let current_location = location;
    if (searchType === 'maps' && !location) {
        try {
            current_location = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
            });
            setLocation(current_location);
        } catch (e) {
            setError("Could not get your location. Please enable location services in your browser.");
            setIsLoading(false);
            return;
        }
    }
    
    try {
      const response = await geminiService.getGroundedResponse(prompt, searchType === 'maps', settings.searchModel, current_location);
      setResult(response);
    } catch (e) {
      console.error(e);
      setError("Failed to get a response. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyToClipboard = () => {
    if (!result) return;

    let textToCopy = `Answer:\n${result.text}\n\n`;

    if (result.sources && result.sources.length > 0) {
        textToCopy += "Sources:\n";
        result.sources.forEach(source => {
            if (source.web) {
                textToCopy += `- ${source.web.title || 'Untitled'}: ${source.web.uri}\n`;
            }
            if (source.maps) {
                textToCopy += `- ${source.maps.title || 'Map View'}: ${source.maps.uri}\n`;
                 if (source.maps.placeAnswerSources?.reviewSnippets) {
                    source.maps.placeAnswerSources.reviewSnippets.forEach(review => {
                         textToCopy += `  - Review: "${review.snippet}" (${review.uri})\n`;
                    });
                }
            }
        });
    }

    navigator.clipboard.writeText(textToCopy).then(() => {
        setCopySuccess('Copied!');
        setTimeout(() => setCopySuccess(''), 2000);
    }, (err) => {
        setCopySuccess('Failed');
        console.error('Could not copy text: ', err);
        setTimeout(() => setCopySuccess(''), 2000);
    });
  };

  return (
    <div className="w-full max-w-3xl">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold mb-4 text-indigo-600 dark:text-indigo-400">Grounded Search</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Get up-to-date answers grounded in Google Search or Maps.</p>
        
        {error && <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 p-3 rounded-md mb-4">{error}</div>}
        
        <div className="space-y-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full h-24 p-2 bg-gray-50 dark:bg-gray-700 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="e.g., Who won the most recent F1 race? or What are some good cafes near me?"
            title="Enter your question for a fact-checked answer."
          />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Search using:</span>
                <div className="flex gap-2">
                     <button onClick={() => setSearchType('web')} className={`px-3 py-1 text-sm rounded-full ${searchType === 'web' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500'}`} title="Search the web for up-to-date information.">Web</button>
                     <button onClick={() => setSearchType('maps')} className={`px-3 py-1 text-sm rounded-full ${searchType === 'maps' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500'}`} title="Search Google Maps for location-based answers. Requires location permission.">Maps</button>
                </div>
            </div>
             <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                <p>Model selection is now in the Control Panel.</p>
            </div>
          </div>
          <button onClick={handleSearch} disabled={isLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-indigo-400" title="Submit your question to get a grounded answer.">
            {isLoading ? "Searching..." : "Get Answer"}
          </button>
        </div>

        {isLoading && <div className="mt-6"><Loader message={settings.searchModel === 'gemini-2.5-pro' ? "Thinking deeply..." : "Searching..."} /></div>}

        {result && (
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-semibold">Answer</h3>
                <button 
                  onClick={handleCopyToClipboard}
                  className="px-4 py-1 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-lg transition-colors"
                  title="Copy the answer and its sources to your clipboard."
                >
                  {copySuccess ? copySuccess : 'Copy'}
                </button>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none bg-gray-100 dark:bg-gray-700 p-4 rounded-md">
                <p>{result.text}</p>
            </div>
            {result.sources && result.sources.length > 0 && (
              <div className="mt-4">
                <h4 className="text-lg font-semibold mb-2">Sources</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {result.sources.map((source, index) => (
                    <li key={index}>
                      {source.web && <a href={source.web.uri} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">{source.web.title || source.web.uri}</a>}
                      {source.maps && <a href={source.maps.uri} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">{source.maps.title || 'View on Google Maps'}</a>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GroundedSearch;