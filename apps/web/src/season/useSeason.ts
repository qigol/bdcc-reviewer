import { useEffect, useState } from 'react';
import { api, type Season, type SeasonStatus } from '../lib/api';

// one fetch per page load, shared by the decorations, the dashboard greeting, the calendar and the Christmas decorations
let cached: Promise<SeasonStatus | null> | null = null;
const load = () => (cached ??= api.season().catch(() => { cached = null; return null; }));

/** Today's season status from the server's calendar; undefined while loading, null if the server can't be reached. */
export function useSeasonStatus(): SeasonStatus | null | undefined {
  const [s, setS] = useState<SeasonStatus | null>();
  useEffect(() => { let live = true; load().then((v) => live && setS(v)); return () => { live = false; }; }, []);
  return s;
}

/** Today's cosmetic theme; undefined while loading, null when there is none. */
export function useSeason(): Season | null | undefined {
  const s = useSeasonStatus();
  return s === undefined ? undefined : s?.season ?? null;
}

/** Puts the season on <html data-season> so styles.css can swap the theme tokens. */
export function useSeasonAttribute(season: Season | null | undefined) {
  useEffect(() => {
    const el = document.documentElement;
    if (season) el.dataset.season = season;
    else delete el.dataset.season;
  }, [season]);
}
