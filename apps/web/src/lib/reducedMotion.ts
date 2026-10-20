import { useEffect, useState } from 'react';
import { useSetting } from '../storage/progress';

const QUERY = '(prefers-reduced-motion: reduce)';

/** True when the in-app setting is on or the phone/computer asks for reduced motion (tracks changes of either). */
export function useReducedMotion(): boolean {
  const [setting] = useSetting('reducedMotion');
  const [system, setSystem] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(QUERY).matches);
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia(QUERY);
    const on = () => setSystem(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return !!setting || system;
}
