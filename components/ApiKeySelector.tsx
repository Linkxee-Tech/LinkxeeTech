import React from 'react';

// FIX: Removed conflicting global type declaration for 'window.aistudio'.
// A global type definition for this property is expected to exist elsewhere in the project,
// and redeclaring it here caused compilation errors.

interface ApiKeySelectorProps {
  onKeySelected: () => void;
}

const ApiKeySelector: React.FC<ApiKeySelectorProps> = ({ onKeySelected }) => {
    const handleSelectKey = async () => {
        try {
            await window.aistudio.openSelectKey();
            // Assume success after the dialog is closed by the user.
            // This mitigates a potential race condition where hasSelectedApiKey might not be updated instantly.
            onKeySelected();
        } catch (error) {
            console.error("Error opening API key selection dialog:", error);
            alert("Could not open the API key selection dialog. Please try again.");
        }
    };
    
    return (
        <div className="bg-gray-200 dark:bg-gray-800 border border-indigo-500 rounded-lg p-8 text-center max-w-lg mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">API Key Required for Animation</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
                Video generation with Veo requires a project API key. Please select a key to continue.
                Using this service may incur costs.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                For more information on billing, please visit the{' '}
                <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-indigo-500 dark:text-indigo-400 hover:underline">
                    official documentation
                </a>.
            </p>
            <button
                onClick={handleSelectKey}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-900"
                title="Opens a dialog to select your Gemini API key for video generation."
            >
                Select API Key
            </button>
        </div>
    );
};

export default ApiKeySelector;