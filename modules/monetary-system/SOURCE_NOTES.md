# Source notes — The International Monetary System and Financial Forces
## Source
- File: INTB 3355 - Session 15 (M8).pptx | Session: 15 | Textbook module: 08 (McGraw Hill, Geringer, Livanis, McNett, 2025 release) | Slides: 36

## Concept inventory (lecture order)
1. Gold standard (Britain, 1717, Newton) — slide 2
2. Bretton Woods, fixed rates, par value, reserves, Triffin paradox, SDRs — slides 3-5
3. Floating rates, Smithsonian and Jamaica agreements — slide 7
4. IMF currency arrangements and Table 8.1 — slides 8-10
5. Fiat, digital, crypto, stablecoin, CBDC; the BIS — slides 11-13
6. FX market, intervention and vehicle currency, SWIFT, CHIPS, Fedwire, correspondent banks — slides 14-17
7. Table 8.2 quotes, reciprocal, spot, forward, bid, ask, spread — slides 18-21
8. Causes of rate movement: monetary and fiscal policy, law of one price, arbitrage, covered interest parity, Fisher, International Fisher, PPP — slides 22-24
9. Forecasting: efficient market, random walk, fundamental, technical — slides 26-27
10. Exchange controls, convertibility, taxation (income, VAT, withholding), inflation and interest rates — slides 28-32
11. Balance of payments: current, capital, official reserves — slides 33-36

## Formulas (verbatim, as TeX)
- Spread: `\text{ask} - \text{bid}` — slide 21 (words only)
- Reciprocal quote: `1 / rate` — slide 19 (words only)
- Covered interest parity: `\frac{F - S}{S} = i_{home} - i_{foreign}` — slide 23 (stated in words)
- Real rate: `r = i - \pi^e` — slide 23
- PPP: rate adjusts for equal purchasing power — slide 24 (words only)

## Worked examples (exact numbers)
- Table 8.1, 2009-2022 shares — slide 10 — see the dataset `regimes` (examples regimes-*)
- Table 8.2 quotes, Jan 8, 2024 — slide 18 — dataset `fxquotes` (examples eurusd-*, usdjpy-spread, usdcad-spread, eurgbp-cross)

## Conventions & ambiguities
- Table 8.1 text extracted column by column (each year gives group, then its parts). The 2014, 2019 and 2022 columns add to about 100 and each group matches its parts (evidence: 6.8 + 6.3 = 13.1, 13.1 + 43.5 + 34.0 + 9.4 = 100.0). The same reading is used for 2009.
- USD/EUR in Table 8.2 is 0.9126 / 0.9128; the exact reciprocals of EUR/USD are 0.91263 / 0.91283. The example tolerance is 0.0002.
- EUR/GBP in Table 8.2 reproduces from EUR/USD × USD/GBP (bid × bid, ask × ask): 0.8587 / 0.8589.
- The slides state interest rate parity as "percentage difference ... equal to the difference in nominal interest rates". The module uses the simple gap form F = S(1 + i_home − i_foreign); the exact form S(1+i_home)/(1+i_foreign) is returned as `exactForward`. The same convention is used for PPP (`exactExpected`).
- Quotes are read as "home units per foreign unit" (dollars per euro).

## Errata
- slide 10, 2009 column: hard peg printed 12.2, but its parts (6.8 + 6.9) add to 13.7; and the four 2009 groups add to 90.4, not 100.
- slide 10, 2022 column: floating parts (18.0 + 18.0) add to 36.0, but the group is printed 34.0.
- The module uses the printed values and teaches the check (scene peg-or-float).

## Beyond the slides
- Converting at bid or ask (section convert-fx): follows from slide 21's definitions of bid and ask.
- Worked forward, PPP and Fisher numbers: the slides give formulas in words only; numbers are illustrative.
- Random walk series and 3-month average (section random-walk): made-up numbers for the idea on slides 26-27.
- VAT chain numbers: slide 30 notes describe VAT in words; the chain is illustrative.
- Balance of payments table: illustrative numbers for slides 34-36.

## Image-only content not extracted
- Slide 15 (Figure 8.1, euro in dollars 1999-2024) and slide 31 (Figure 8.2, G20 corporate tax rates) are pictures; their numbers are not used.

## Skill map
- monetary-system: gold standard, Bretton Woods, pegs, digital money (slides 2-13)
- fx-quotes: FX market, bid, ask, spread, reciprocal, converting (slides 14-21)
- cross-rates: Table 8.2 cross quotes
- forward-parity: forward rate, covered interest parity, International Fisher (slides 20, 23-24)
- ppp: law of one price, arbitrage, PPP, inflation (slides 22-24, 32)
- fisher: nominal and real rates (slide 23)
- forecasting: slides 26-27
- govt-forces: exchange controls, convertibility, taxation (slides 28-30)
- bop: slides 33-36
