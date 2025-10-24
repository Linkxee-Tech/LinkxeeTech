import React, { createContext, useState, useEffect, useContext } from 'react';

export type ModelPreference = 'gemini-2.5-flash' | 'gemini-2.5-pro';
export type Theme = 'light' | 'dark';

interface Settings {
    theme: Theme;
    scriptModel: ModelPreference;
    chatModel: ModelPreference;
    searchModel: ModelPreference;
}

interface SettingsContextType {
    settings: Settings;
    setSettings: React.Dispatch<React.SetStateAction<Settings>>;
    clearAllData: () => void;
}

const defaultSettings: Settings = {
    theme: 'dark',
    scriptModel: 'gemini-2.5-pro',
    chatModel: 'gemini-2.5-flash',
    searchModel: 'gemini-2.5-flash',
};

export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<Settings>(() => {
        try {
            const saved = localStorage.getItem('appSettings');
            return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
        } catch {
            return defaultSettings;
        }
    });

    useEffect(() => {
        localStorage.setItem('appSettings', JSON.stringify(settings));
        if (settings.theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [settings]);
    
    const clearAllData = () => {
        if (window.confirm('Are you sure you want to clear all settings and saved projects? This action cannot be undone.')) {
            localStorage.clear();
            setSettings(defaultSettings);
            // Reload to ensure all state across the app is reset
            window.location.reload();
        }
    };

    return (
        <SettingsContext.Provider value={{ settings, setSettings, clearAllData }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
