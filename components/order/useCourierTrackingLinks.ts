'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function useCourierTrackingLinks() {
  const [links, setLinks] = useState<Record<string, string>>({});
  useEffect(() => onSnapshot(doc(db, 'settings', 'couriers'), snapshot => {
    const value = snapshot.data()?.trackingLinks;
    setLinks(value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) : {});
  }, () => setLinks({})), []);
  return links;
}
