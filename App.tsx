import React, { useState } from 'react';
import { AppView } from './types';
import { SettingsProvider } from './contexts/SettingsContext';
import Nav from './components/Nav';
import CartoonForge from './components/CartoonForge';
import ImageStudio from './components/ImageStudio';
import ChatBot from './components/ChatBot';
import LiveConvo from './components/LiveConvo';
import GroundedSearch from './components/GroundedSearch';
import ControlPanel from './components/ControlPanel';


const AppContent: React.FC = () => {
    const [activeView, setActiveView] = useState<AppView>(AppView.CARTOON_FORGE);

    const renderActiveView = () => {
        switch (activeView) {
            case AppView.CARTOON_FORGE:
                return <CartoonForge />;
            case AppView.IMAGE_STUDIO:
                return <ImageStudio />;
            case AppView.CHATBOT:
                return <ChatBot />;
            case AppView.LIVE_CONVO:
                return <LiveConvo />;
            case AppView.GROUNDED_SEARCH:
                return <GroundedSearch />;
            case AppView.CONTROL_PANEL:
                return <ControlPanel />;
            default:
                return <CartoonForge />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 flex flex-col items-center p-4 sm:p-8 transition-colors duration-300">
            <header className="w-full max-w-4xl mb-8 text-center">
                <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white">
                  <span className="text-indigo-600 dark:text-indigo-400">CartoonForge</span> AI Studio
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">Your All-in-One Gemini-Powered Creative Suite.</p>
            </header>
            
            <Nav activeView={activeView} setActiveView={setActiveView} />

            <main className="w-full max-w-4xl flex flex-col items-center">
                {renderActiveView()}
            </main>
        </div>
    );
};

const App: React.FC = () => {
    return (
        <SettingsProvider>
            <AppContent />
        </SettingsProvider>
    );
}

export default App;
