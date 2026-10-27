'use client';

import { MessageCircleQuestion, Check, Circle, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface WorkflowStep {
  label: string;
  icon?: LucideIcon;
  completed?: boolean;
  disabled?: boolean;
  action?: ReactNode;
}

export function WorkflowProgress({ steps, current, complete = false, stopped = false, attention = false, label = 'Work status', onStepClick }: {
  steps: WorkflowStep[];
  current: number;
  complete?: boolean;
  stopped?: boolean;
  attention?: boolean;
  label?: string;
  onStepClick?: (index: number) => void;
}) {
  return <ol aria-label={label} className="grid rounded-xl bg-stone-50 px-1 py-3 sm:px-3" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
    {steps.map((step, index) => {
      const done = step.completed ?? (complete || index < current);
      const active = index === current && !done;
      const Icon = done ? Check : active && attention ? MessageCircleQuestion : step.icon || Circle;
      const content = <><span aria-hidden="true" className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${done ? 'border-emerald-600 bg-emerald-600 text-white' : active && stopped ? 'border-red-300 bg-red-50 text-red-700' : active && attention ? 'border-orange-400 bg-orange-100 text-orange-800 ring-4 ring-orange-100' : active ? 'border-brand-600 bg-brand-600 text-white ring-4 ring-brand-100' : 'border-stone-200 bg-white text-stone-400'}`}><Icon className="h-4 w-4" strokeWidth={done ? 2.5 : 2} /></span><span className={`px-1 text-[10px] leading-4 sm:text-xs ${done ? 'font-medium text-emerald-700' : active && stopped ? 'font-semibold text-red-700' : active && attention ? 'font-semibold text-orange-800' : active ? 'font-semibold text-brand-800' : 'text-stone-500'}`}>{step.label}<span className="sr-only">{done ? ' ? completed' : active ? stopped ? ' ? stopped' : ' ? current step' : ' ? upcoming'}</span></span></>;
      return <li key={step.label} aria-current={active && !stopped ? 'step' : undefined} className="relative flex min-w-0 flex-col items-center gap-2 text-center">
        {index < steps.length - 1 && <span aria-hidden="true" className={`absolute left-1/2 top-4 h-0.5 w-full ${done && (complete || index < current) ? 'bg-emerald-400' : 'bg-stone-200'}`} />}
        {onStepClick ? <button type="button" disabled={step.disabled} onClick={() => onStepClick(index)} className="relative flex min-h-11 w-full flex-col items-center gap-2 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600 disabled:cursor-not-allowed">{content}</button> : content}
        {step.action}
      </li>;
    })}
  </ol>;
}
