import { useEffect, useState } from 'react';
import { api, type Season } from '../lib/api';

// one fetch per page load, shared by the decorations, the dashboard greeting and the Christmas decorations
let cached: Promise<Season | null> | null = null;
const load = () => (cached ??= api.season().then((s) => s.season ?? null).catch(() => { cached = null; return null; }));

/** Today's cosmetic theme, decided by the server's calendar; undefined while loading, null when there is none. */
export function useSeason(): Season | null | undefined {
  const [s, setS] = useState<Season | null>();
  useEffect(() => { let live = true; load().then((v) => live && setS(v)); return () => { live = false; }; }, []);
  return s;
}

/** Puts the season on <html data-season> so styles.css can swap the theme tokens. */
export function useSeasonAttribute(season: Season | null | undefined) {
  useEffect(() => {
    const el = document.documentElement;
    if (season) el.dataset.season = season;
    else delete el.dataset.season;
  }, [season]);
}
