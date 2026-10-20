# Animations: Spotify: Streaming and the Music Business

## follow-the-money
- Where: intuition › who-gets-paid › beats 1–3 (stage widget `anim`, region top)
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
- Must not show: the 70-million pool while the beat-2 predict gate is open
- Segments: beats 1–2 rest on 0–1 (the $100M channel only), beat 3 sets 1–6, hidden from beat 4
- 3D: the sky only (Three.js points + gradient); actors are flat SVG
- Source: `animations/clips/case-spotify/follow-the-money.html` · render and convert with `pnpm anim:render follow-the-money`

## freemium-funnel
- Where: intuition › how-spotify-earns › beats 1–5 (stage widget `anim`, region top; above the existing readouts)
- Idea: the free tier is a funnel; one in four listeners pays, and paying listeners × price × 12 months is the year's Premium revenue.
- Length: 5 s, no loop · Shape: 16:9 · Background: the shared sky
- Storyboard:
  - 0.0–0.8 s: little listeners stream into a glowing funnel. "The free tier is a funnel".
  - 0.8–1.4 s: two exits draw: "Free · with ads" (a gold megaphone) and "Premium · $9.99 a month". "Two ways to listen".
  - 1.4–2.4 s: "50 million active" counts up at the top, "12.5 million paying" at the Premium exit. "Who pays?". No share.
  - 2.4–3.6 s: a "1 in 4 · 25%" badge; "× $9.99 × 12 months" and twelve month squares light teal. "Paying share, then a year of fees". No total.
  - 3.6–5.0 s: teal coins pour into a gold bar that counts to "$1,498.5 million a year". "Premium revenue for the year"; hold.
- Numbers: the scene's (50M, 12.5M, $9.99, 12 months → 25%, $1,498.5M). The QA brief's ad bar ($150M) and "~90% of revenue" are not in the case module, so they are left out.
- Must not show: 25% during beat 3, or 1,498.5 during beat 4 (their predicts)
- Segments: beat 1 plays 0–0.8, beat 2 sets 0.8–1.4, beat 3 sets 1.4–2.4, beat 4 sets 2.4–3.6, beat 5 sets 3.6–5, hidden on beat 6
- Source: `animations/clips/case-spotify/freemium-funnel.html`

## windowing-vs-day-and-date
- Where: intuition › the-swift-takedown › beats 1–2 (stage widget `anim`, region top)
- Idea: day-and-date puts new music on every channel at once; windowing keeps it off the free tier for a while to sell albums first; Spotify refused, and the label pulled the catalogue.
- Length: 5 s, no loop · Shape: 16:9 · Background: the shared sky
- Storyboard:
  - 0.0–1.7 s: "Day-and-date" row: Album, Premium and Free doors open together; most listeners take Free; the album-sales bar barely grows. "Day-and-date · every channel on day one".
  - 1.7–3.4 s: "Windowing" row: the Free door is padlocked ("free tier later"); listeners take Album and Premium; the album-sales bar grows tall. "Windowing · paid channels first".
  - 3.4–5.0 s: a teal "Same for everyone" stamp lands on the day-and-date row; three album cards slide off their shelf ("Catalogue pulled"). "Spotify said no, so the label pulled out"; hold.
- Numbers: none (no month count: the case doesn't give one)
- Must not show: Swift's share of payouts (beat 2's predict); anything during beat 4's windowing practice
- Segments: beat 1 plays 0–3.4, beat 2 sets 3.4–5, hidden from beat 3 (the takedown callout and readout)
- Source: `animations/clips/case-spotify/windowing-vs-day-and-date.html`
