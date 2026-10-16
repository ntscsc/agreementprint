'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_SUPPORT_EMAIL, subscribeToSupportEmail } from '@/lib/support-email';

interface SupportEmailLinkProps {
  className?: string;
  children?: ReactNode;
}

export function SupportEmailLink({ className, children }: SupportEmailLinkProps) {
  const [email, setEmail] = useState(DEFAULT_SUPPORT_EMAIL);

  useEffect(() => subscribeToSupportEmail(setEmail), []);

  return (
    <a href={`mailto:${email}`} className={className}>
      {children ?? email}
    </a>
  );
}
