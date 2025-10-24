import React from 'react';
import type { GenerationStep } from '../types';
import { GenerationStep as StepEnum } from '../types';

interface StepIndicatorProps {
  currentStep: GenerationStep;
}

const steps = [
  { id: StepEnum.IDEA, name: 'Idea' },
  { id: StepEnum.SCRIPT, name: 'Script' },
  { id: StepEnum.IMAGE, name: 'Image' },
  { id: StepEnum.VOICE, name: 'Voice' },
  { id: StepEnum.VIDEO, name: 'Animation' },
];

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  const currentStepIndex = steps.findIndex(step => {
      if (currentStep === StepEnum.COMPLETE) return 4;
      if (currentStep === StepEnum.VIDEO_KEY_CHECK) return 4;
      return step.id === currentStep;
  });

  return (
    <nav aria-label="Progress">
      <ol role="list" className="flex items-center">
        {steps.map((step, stepIdx) => (
          <li key={step.name} className={`relative ${stepIdx !== steps.length - 1 ? 'pr-8 sm:pr-20' : ''}`}>
            {stepIdx < currentStepIndex ? (
              <>
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="h-0.5 w-full bg-indigo-600" />
                </div>
                <a
                  href="#"
                  className="relative flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-900"
                >
                  <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.052-.143z" clipRule="evenodd" />
                  </svg>
                </a>
              </>
            ) : stepIdx === currentStepIndex ? (
              <>
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="h-0.5 w-full bg-gray-300 dark:bg-gray-700" />
                </div>
                <a
                  href="#"
                  className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-indigo-600 bg-white dark:bg-gray-800"
                  aria-current="step"
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" aria-hidden="true" />
                </a>
              </>
            ) : (
              <>
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="h-0.5 w-full bg-gray-300 dark:bg-gray-700" />
                </div>
                <a
                  href="#"
                  className="group relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-400 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-500 dark:hover:border-gray-400"
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-transparent group-hover:bg-gray-400 dark:group-hover:bg-gray-500" aria-hidden="true" />
                </a>
              </>
            )}
             <span className="absolute top-10 w-max -ml-2 text-sm text-gray-500 dark:text-gray-400">{step.name}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default StepIndicator;