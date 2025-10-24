import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Chat } from "@google/genai";
import type { ChatMessage } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import Loader from './Loader';

const ChatBot: React.FC = () => {
    const [chat, setChat] = useState<Chat | null>(null);
    const [history, setHistory] = useState<ChatMessage[]>([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const { settings } = useSettings();

    useEffect(() => {
        setIsLoading(true);
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const chatSession = ai.chats.create({
            model: settings.chatModel,
            config: {
                systemInstruction: 'You are a friendly and helpful chatbot named Sparky. Keep your responses concise and friendly.',
            },
        });
        setChat(chatSession);
        setHistory([]);
        setIsLoading(false);
    }, [settings.chatModel]);

    useEffect(() => {
        // Scroll to the bottom of the chat container when history changes
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [history]);

    const handleSendMessage = async () => {
        if (!userInput.trim() || !chat || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', parts: [{ text: userInput }] };
        setHistory(prev => [...prev, userMessage]);
        setIsLoading(true);
        setUserInput('');

        try {
            const result = await chat.sendMessageStream({ message: userInput });
            
            let modelResponse = '';
            let firstChunk = true;
            for await (const chunk of result) {
                const chunkText = chunk.text;
                modelResponse += chunkText;
                if (firstChunk) {
                    setHistory(prev => [...prev, { role: 'model', parts: [{ text: modelResponse }] }]);
                    firstChunk = false;
                } else {
                    setHistory(prev => {
                        const newHistory = [...prev];
                        newHistory[newHistory.length - 1] = { role: 'model', parts: [{ text: modelResponse }]};
                        return newHistory;
                    });
                }
            }
        } catch (error) {
            console.error("Chat error:", error);
            setHistory(prev => [...prev, { role: 'model', parts: [{ text: "Oops! Something went wrong. Please try again." }] }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-2xl h-[70vh] flex flex-col bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg">
            <header className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-indigo-600 dark:text-indigo-400">Chat with AI</h2>
            </header>
            <div ref={chatContainerRef} className="flex-1 p-4 overflow-y-auto space-y-4">
                {history.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-lg ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}`}>
                            <p className="text-sm whitespace-pre-wrap">{msg.parts[0].text}</p>
                        </div>
                    </div>
                ))}
                {isLoading && history[history.length -1]?.role === 'user' && (
                     <div className="flex justify-start">
                        <div className="max-w-xs p-3 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                           <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-pulse"></div>
                                <div className="w-2 h-2 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-pulse delay-150"></div>
                                <div className="w-2 h-2 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-pulse delay-300"></div>
                           </div>
                        </div>
                    </div>
                )}
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2">
                    <input
                        type="text"
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        className="flex-1 p-2 bg-gray-100 dark:bg-gray-700 rounded-md border border-gray-300 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Ask me anything..."
                        disabled={isLoading}
                        title="Type your message here and press Enter to send."
                    />
                    <button onClick={handleSendMessage} disabled={isLoading || !userInput.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition-colors disabled:bg-indigo-400 disabled:cursor-not-allowed" title="Send your message to the chatbot.">
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatBot;