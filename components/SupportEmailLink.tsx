'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_SUPPORT_EMAIL, getSupportEmail } from '@/lib/support-email';

interface SupportEmailLinkProps {
  className?: string;
}

export function SupportEmailLink({ className }: SupportEmailLinkProps) {
  const [email, setEmail] = useState(DEFAULT_SUPPORT_EMAIL);

  useEffect(() => {
    let isMounted = true;
    getSupportEmail().then((supportEmail) => {
      if (isMounted) setEmail(supportEmail);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <a href={`mailto:${email}`} className={className}>
      {email}
    </a>
  );
}
