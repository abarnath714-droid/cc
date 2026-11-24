import { useEffect, useRef } from 'react';

export function useLiveSync(onUpdate: () => void, enabled = true) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  useEffect(() => {
    if (!enabled) return;

    const es = new EventSource('/api/events');
    const handleUpdate = () => {
      callbackRef.current();
    };
    es.addEventListener('update', handleUpdate);

    return () => {
      es.removeEventListener('update', handleUpdate);
      es.close();
    };
  }, [enabled]);
}
