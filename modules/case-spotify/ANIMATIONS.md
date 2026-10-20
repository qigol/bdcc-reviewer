# Animations: Spotify: Streaming and the Music Business

## follow-the-money
- Where: intuition › who-gets-paid › beats 3–4 (stage widget `anim`, region top)
- Idea: of each listener dollar, most goes to rights holders, and only a thin share reaches the artist.
- Length: 6 s, no loop (`loop: false`, holds the last frame) · Shape: 16:9 · Background: opaque navy → indigo sky with drifting specks (Three.js), shared motion kit in `animations/kit/`
- Storyboard:
  - 0.0–1.0 s: a crowd of tiny listeners with headphones bobs to a beat; gold coins rain off them into a wide channel labelled $100M.
  - 1.0–2.0 s: the channel forks: a 30% branch peels off into a streaming building (a generic green play circle, not Spotify's logo), leaving a $70M pool.
  - 2.0–3.6 s: the pool is a pie of many rights holders; a 5% slice lifts out and flows down to a record label: $3.5M.
  - 3.6–5.0 s: a thin trickle runs on through a 20% gate to an artist with a guitar: $0.7M; the artist looks at it and blinks.
  - 5.0–6.0 s: hold; the camera eases out so the whole funnel is in view.
- On-screen words: "30%", "5%", "20%" and the amounts
- Numbers: $100M → $70M → $3.5M → $0.7M (royaltyPayout with the scene state)
- Must not show: the 70-million pool while the beat-2 predict gate is open (the clip appears on beat 3)
- 3D: the sky only (Three.js points + gradient); actors are flat SVG
- Source: `animations/clips/case-spotify/follow-the-money.html` · render and convert with `pnpm anim:render follow-the-money`
