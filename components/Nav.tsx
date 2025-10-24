import React from 'react';
import { AppView } from '../types';

interface NavProps {
  activeView: AppView;
  setActiveView: (view: AppView) => void;
}

const Nav: React.FC<NavProps> = ({ activeView, setActiveView }) => {
  const navItems = [
    { id: AppView.CARTOON_FORGE, label: 'Cartoon Forge' },
    { id: AppView.IMAGE_STUDIO, label: 'Image Studio' },
    { id: AppView.CHATBOT, label: 'Chat Bot' },
    { id: AppView.LIVE_CONVO, label: 'Live Conversation' },
    { id: AppView.GROUNDED_SEARCH, label: 'Grounded Search' },
    { id: AppView.CONTROL_PANEL, label: 'Control Panel' },
  ];

  return (
    <nav className="bg-white dark:bg-gray-800 rounded-lg p-2 mb-8 w-full max-w-4xl shadow-md border border-gray-200 dark:border-gray-700">
      <ul className="flex justify-center items-center gap-2 flex-wrap">
        {navItems.map((item) => (
          <li key={item.id}>
            <button
              onClick={() => setActiveView(item.id)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                activeView === item.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
              }`}
              title={`Switch to the ${item.label} view.`}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default Nav;