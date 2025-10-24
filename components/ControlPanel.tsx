import React from 'react';
import { useSettings, type ModelPreference } from '../contexts/SettingsContext';

const ControlPanel: React.FC = () => {
    const { settings, setSettings, clearAllData } = useSettings();

    const handleSettingChange = (key: string, value: string) => {
        setSettings(prev => ({...prev, [key]: value }));
    };

    const modelOptions: { value: ModelPreference, label: string }[] = [
        { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Fast & Efficient)' },
        { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Advanced & Powerful)' },
    ];

    return (
        <div className="w-full max-w-2xl bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg">
            <h2 className="text-2xl font-bold mb-6 text-indigo-600 dark:text-indigo-400 border-b border-gray-200 dark:border-gray-700 pb-3">Control Panel</h2>

            <div className="space-y-8">
                {/* Theme Settings */}
                <section>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Appearance</h3>
                    <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
                        <label htmlFor="theme-select" className="font-medium">Theme</label>
                        <select
                            id="theme-select"
                            value={settings.theme}
                            onChange={(e) => handleSettingChange('theme', e.target.value)}
                            className="bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            title="Choose between a light or dark theme for the application."
                        >
                            <option value="light">Light</option>
                            <option value="dark">Dark</option>
                        </select>
                    </div>
                </section>

                {/* Model Settings */}
                <section>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Model Configuration</h3>
                    <div className="space-y-4 bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
                        <div className="flex items-center justify-between">
                             <label htmlFor="script-model" className="font-medium">Cartoon Forge Scripting</label>
                             <select id="script-model" value={settings.scriptModel} onChange={(e) => handleSettingChange('scriptModel', e.target.value)} className="bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[250px]" title="Select the model used for script generation in the Cartoon Forge. Pro is more creative, Flash is faster.">
                                {modelOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                             </select>
                        </div>
                        <div className="flex items-center justify-between">
                             <label htmlFor="chat-model" className="font-medium">Chat Bot</label>
                             <select id="chat-model" value={settings.chatModel} onChange={(e) => handleSettingChange('chatModel', e.target.value)} className="bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[250px]" title="Select the model for the Chat Bot. Pro provides more detailed answers, Flash is quicker.">
                                {modelOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                             </select>
                        </div>
                        <div className="flex items-center justify-between">
                             <label htmlFor="search-model" className="font-medium">Grounded Search</label>
                             <select id="search-model" value={settings.searchModel} onChange={(e) => handleSettingChange('searchModel', e.target.value)} className="bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[250px]" title="Select the model for Grounded Search. Pro performs deeper reasoning, Flash is faster for general queries.">
                                {modelOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                             </select>
                        </div>
                    </div>
                </section>

                {/* Data Management */}
                <section>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Data Management</h3>
                     <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
                        <p className="text-sm">Clear all saved settings and projects.</p>
                        <button
                            onClick={clearAllData}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                            title="Warning: This will permanently delete all your saved projects and settings."
                        >
                            Clear All Data
                        </button>
                     </div>
                </section>
            </div>
        </div>
    );
};

export default ControlPanel;