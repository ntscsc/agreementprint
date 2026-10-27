'use client';

import { UserRound, Users, House, FileText, CreditCard } from 'lucide-react';
import { WorkflowProgress } from '@/components/ui/WorkflowProgress';

interface ProgressIndicatorProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
  maxAccessibleStep: number;
}

export function ProgressIndicator({ currentStep, onStepClick, maxAccessibleStep }: ProgressIndicatorProps) {
  return <WorkflowProgress current={currentStep - 1} label="Agreement order steps" onStepClick={onStepClick ? index => onStepClick(index + 1) : undefined} steps={[
    { label: 'Owner', icon: UserRound },
    { label: 'Tenant', icon: Users },
    { label: 'Property', icon: House },
    { label: 'Terms', icon: FileText },
    { label: 'Review & pay', icon: CreditCard },
  ].map((step, index) => ({ ...step, disabled: index + 1 > maxAccessibleStep }))} />;
}
