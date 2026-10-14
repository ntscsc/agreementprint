'use client';

import React from 'react';
import { Check } from 'lucide-react';

interface ProgressIndicatorProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
  maxAccessibleStep: number;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  currentStep,
  onStepClick,
  maxAccessibleStep,
}) => {
  const steps = [
    { number: 1, label: 'Owner Details', shortLabel: 'Owner' },
    { number: 2, label: 'Tenant Details', shortLabel: 'Tenant' },
    { number: 3, label: 'Property Details', shortLabel: 'Property' },
    { number: 4, label: 'Agreement Terms', shortLabel: 'Terms' },
    { number: 5, label: 'Review & Pay', shortLabel: 'Review' },
  ];

  return (
    <div className="w-full">
      {/* Mobile step label bar */}
      <div className="sm:hidden flex items-center justify-between mb-3 px-1 text-xs">
        <span className="font-bold text-stone-900">
          Step {currentStep} of 5: {steps[currentStep - 1]?.label}
        </span>
        <span className="text-amber-800 font-mono text-[11px] bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
          {Math.round((currentStep / 5) * 100)}%
        </span>
      </div>

      {/* Step navigation bar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-stone-200 shadow-xs">
        <ol className="flex items-center justify-between w-full relative">
          {steps.map((st, idx) => {
            const isCompleted = currentStep > st.number;
            const isCurrent = currentStep === st.number;
            const isClickable = st.number <= maxAccessibleStep;

            return (
              <li key={st.number} className="relative flex-1 flex flex-col items-center group">
                {/* Connecting bar */}
                {idx > 0 && (
                  <div 
                    className={`absolute top-4 sm:top-4.5 -left-1/2 w-full h-0.5 -z-10 transition-colors ${
                      currentStep >= st.number ? 'bg-amber-500' : 'bg-stone-200'
                    }`}
                  />
                )}

                {/* Step Circle Badge */}
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => isClickable && onStepClick && onStepClick(st.number)}
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                    isCompleted
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer shadow-xs'
                      : isCurrent
                      ? 'bg-amber-500 text-stone-950 ring-4 ring-amber-100 shadow-sm'
                      : isClickable
                      ? 'bg-stone-100 text-stone-700 hover:bg-stone-200 cursor-pointer border border-stone-300'
                      : 'bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed'
                  }`}
                  aria-label={`Step ${st.number}: ${st.label}`}
                >
                  {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : st.number}
                </button>

                {/* Label */}
                <span
                  className={`mt-1.5 text-[11px] sm:text-xs text-center hidden xs:block transition-colors ${
                    isCurrent
                      ? 'font-bold text-stone-900'
                      : isCompleted
                      ? 'font-semibold text-emerald-800'
                      : 'text-stone-400 font-medium'
                  }`}
                >
                  <span className="hidden md:inline">{st.label}</span>
                  <span className="md:hidden">{st.shortLabel}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
};
