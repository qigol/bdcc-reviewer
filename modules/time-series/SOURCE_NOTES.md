# Source notes — Time Series Forecasting

## Source
- File: bsdsba2028_-_ml2_session_10_time_series.pdf | Session 10 | Date: 2026-09-18 | Pages: 28
- File: Session_11_Time_Series_Instructor.ipynb | Session 11 | naive → stationarity → ADF → differencing → ACF/PACF → ARIMA
- File: Session_12_Time_Series_ML_Student (Updated).ipynb | Session 12 | lag features → linear regression → leakage

## Concept inventory (lecture order)
1. A short history — S10 slides 3–4 — exponential smoothing (1950s), Box–Jenkins ARIMA (1970), ML with temporal features, deep learning, foundation models (TimesFM-3, zero-shot).
2. What a time series is — slide 5 — observations in time order at regular intervals; order is information.
3. You are the forecaster — slides 7–11 — Series A (level), B (direction), C (direction + last year's shape).
4. Trend, seasonality, remainder — slide 12 — seasonal ≠ cyclic (fixed calendar period vs no fixed length).
5. y_t ≈ T_t + S_t + R_t — slide 13 — "≈, not =": a way of looking, not a theory; some series multiply, some have several seasons.
6. Why time series are different — slide 14 — shuffling destroys everything while deleting nothing; never split at random.
7. Notation — slides 15–16 — t, y_t, y_(t−1), y_(t−k), k the lag, Δ; worked lag table for April–June 1999.
8. Stationarity — slides 17–18 — stable level, stable fluctuation, stable relationship with its own past; stationary ≠ flat (sunspots vs random walk gallery).
9. Differencing by hand — slides 19–22 — annual CO₂ 1959–1964; changes +0.9, +0.7, +0.8, +0.5, +0.6 (≈ 0.7); lose one observation; changes the question; seasonal difference Δ₁₂.
10. Correlation → autocorrelation — slides 23–24 — Niño 1+2 scatter at lags 1, 6, 12 (r = +0.87, −0.66, +0.75).
11. Exit ticket and conclusion — slides 25–26.
12. Baselines — S11 §2 — chronological split (468 / 48 months), naive and seasonal naive; MAE, RMSE, MAPE.
13. ADF test — S11 §3 — H₀ unit root; level 'c': 2.287, p 0.9989; level 'ct': −2.168, p 0.5077; differenced 'c': −4.237, p 0.0006; d = 1.
14. ACF and PACF — S11 §4 — total vs direct resemblance; AR(1)/MA(1) signatures; reading table; differenced CO₂ ACF lag 1 0.708, lag 12 0.916.
15. ARIMA(p, d, q) — S11 §5–6 — AR, I, MA; fitted ARIMA(1,1,1) with drift; forecasts; scores; residual ACF lag 12 ≈ 0.58.
16. The family — S11 §7 — SARIMA, SARIMAX, ARIMAX, VAR, GARCH.
17. From series to table — S12 §2–3 — lag features, rolling mean (shift first), month one-hot, dropna.
18. Three feature sets — S12 §4–5 — A, B, C; one-step comparison with naive and ARIMA.
19. Leakage — S12 §6 — leaky rolling mean (MAE 0; coefficients 3, −1, −1) and a random split for a random forest (0.515 vs 3.174).

## Formulas (verbatim, as TeX)
- Additive model: `y_t \approx T_t + S_t + R_t` — S10 slide 13
- First difference: `\Delta y_t = y_t - y_{t-1}` — slide 21; S11 §3
- Seasonal difference: `\Delta_{12}\, y_t = y_t - y_{t-12}` — slide 22
- Naive: `\hat{y}_{t+h \mid t} = y_t` — S11 §2
- Seasonal naive: `\hat{y}_{t+h \mid t} = y_{t+h-m}` — S11 §2 (with h ≤ m; for longer horizons the code repeats last season: index i mod 12)
- MAE `\frac{1}{n}\sum|y_t - \hat y_t|`; RMSE `\sqrt{\frac{\sum (y_t - \hat y_t)^2}{n}}`; MAPE `\frac{100}{n}\sum\left|\frac{y_t - \hat y_t}{y_t}\right|` — S11 §2
- Random walk (ADF null): `y_t = y_{t-1} + \varepsilon_t` — S11 §3
- ARIMA: `w_t = c + \phi_1 w_{t-1} + \dots + \phi_p w_{t-p} + \varepsilon_t + \theta_1 \varepsilon_{t-1} + \dots + \theta_q \varepsilon_{t-q}`, `w_t = \Delta^d y_t` — S11 §5
- Fitted: `\Delta y_t = 0.1156 + 0.5744\,\Delta y_{t-1} + \varepsilon_t + 0.3733\,\varepsilon_{t-1}` — S11 §5 (see Errata for the exact role of 0.1156)
- Leak-free rolling mean: `\frac{y_{t-1} + y_{t-2} + y_{t-3}}{3}` — S12 §3; leaky identity `y_t = 3\,\text{roll\_leaky}_t - y_{t-1} - y_{t-2}` — S12 §6

## Worked examples (exact numbers)
- Lag table — slide 16 — Apr/May/Jun 1999: y 371.0/370.8/370.2, y_(t−1) 369.6/371.0/370.8, y_(t−12) 368.5/369.1/368.8 (→ lag-jun-1999, lag-apr-1999-12)
- Annual differences — slides 19–20 — +0.9, +0.7, +0.8, +0.5, +0.6, average 0.7; 6 in, 5 out (→ annual-diff, annual-diff-walk)
- Niño autocorrelation — slide 24 — r(1) = +0.87, r(6) = −0.66, r(12) = +0.75 (→ nino-lag1, nino-lag6, nino-lag12)
- Split — S11 §2 — 468 train months (1959-01 → 1997-12), 48 test months (1998-01 → 2001-12) (→ split)
- Naive / seasonal naive — S11 §2 — naive = 364.25 (Dec 1997); seasonal naive Jan 1998 = 363.125; MAE 4.527 / 5.063, RMSE 5.103 / 5.312, MAPE 1.224 / 1.371 (→ naive-scores, snaive-scores, mae-walk)
- Monthly differences — S11 §3 — 467 values, mean 0.104 ppm (→ train-diff)
- ACF of the differenced series — S11 §4 — lags 1, 2, 3, 6, 11, 12, 13: 0.708, 0.253, −0.202, −0.531, 0.713, 0.916, 0.707 (→ acf-diff, acf-code)
- ARIMA forecasts — S11 §6 — 365.64, 366.49, 367.03; multi-step MAE 1.900, RMSE 2.403, MAPE 0.517 (→ arima-first3, arima-scores, arima-code)
- One-step scores — S12 §5 — naive 1.080 / 1.215 / 0.293; ARIMA 0.600 / 0.747 / 0.163; LR lag_1 1.067 (coefficient 0.9978); A 0.509; B 0.222; C 0.232 (→ naive1-scores, arima1-scores, lr-lag1, lr-a, lr-b, lr-c)
- Features — S12 §3 — roll_mean_3 at 1959-04 = 316.267; leaky at 1959-03 = 316.267, at 1959-04 = 316.992; 516 → 504 rows, first usable 1960-01 (→ features-first-rows, features-code)
- Leakage — S12 §6 — leaky MAE 0.0, coefficients lag_1 −1, lag_2 −1, lag_12 0, roll_mean_3_leaky 3 (→ lr-leaky)
- Random forest — S12 §6 — random split MAE 0.515 vs chronological 3.174; training max 366.68 vs forest max 366.06 (→ train-max; the forest itself is shown as data)

## Conventions & ambiguities
- Monthly series = statsmodels co2 weekly, `interpolate()`, monthly mean, 1959-01 … 2001-12 (516 values), exactly as both notebooks build it. Train ends 1997-12.
- ACF uses statsmodels' estimator: r_k = Σ_{t>k}(y_t − ȳ)(y_{t−k} − ȳ) / Σ_t (y_t − ȳ)², one overall mean and one denominator. Slide 24's scatter r is instead the Pearson correlation of the (y_t, y_{t−k}) pairs; both reproduce their own numbers (0.708 … and 0.87, −0.66, 0.75).
- ARIMA(1,1,1) with `trend="t"`: statsmodels treats the trend as a regression on time, so after one difference Δy_t has **mean** 0.1156 and (Δy_t − 0.1156) follows ARMA(1,1). Forecast recursion: Δŷ_{T+1} = c + φ(Δy_T − c) + θ ε_T, then Δŷ_{T+h} = c + φ(Δŷ_{T+h−1} − c). With the last training residual ε_T = 0.7249 this reproduces 365.64, 366.49, 367.03 and every score to 3 decimals. The one-step version runs the same recursion through the test months, updating ε with each real value (as `apply(co2).predict`).
- Seasonal naive for h > 12 repeats the last training year (index i mod 12), as the notebook's code does.
- MAPE is reported in percent.
- Linear regression: ordinary least squares with an intercept, solved on centred features. Scenario C contains lag_1, lag_2, lag_3 and roll_mean_3 = their mean, so its design matrix is exactly collinear; any least-squares solution gives the same predictions, so the scores (0.232) reproduce but the individual coefficients are not unique and are not shown.
- Leaky regression: the exact solution is roll_mean_3_leaky × 3 − lag_1 − lag_2, so the computed MAE is ~1e-11 (the notebook prints 0.0).

## Errata
- Slide 14 says chronological splits are built "properly in Session 4"; the deck's own slide 2 puts time series in Sessions 10–13, and the Session 11 notebook is where the chronological split is built. The lesson cites Session 11.
- Session 11 §5 reads x1 = 0.1156 as "the series tends to increase by 0.116 units per period" and writes it as the constant c in Δy_t = c + φΔy_{t−1} + …; in statsmodels' parametrization 0.1156 is the **mean** of Δy (the drift), so the equation's constant is 0.1156 × (1 − 0.5744) = 0.049: Δy_t = 0.049 + 0.5744 Δy_{t−1} + ε_t + 0.3733 ε_{t−1}, equivalently (Δy_t − 0.1156) = 0.5744 (Δy_{t−1} − 0.1156) + …. Plugging 0.1156 in as the constant would forecast 365.71 for January 1998 instead of the notebook's own 365.64. The lesson uses the mean form, which reproduces all of the notebook's forecasts and scores.

## Beyond the slides
- Synthetic series A, B, C and the six-panel stationarity gallery are regenerated from a fixed seed (the deck's are synthetic too, but their values are not given).
- Classical additive decomposition at one month (2×12 centred moving average, centred monthly means), the method behind statsmodels' seasonal_decompose cited in the deck's sources.
- Theoretical ACFs of AR(1) (φᵏ) and MA(1) (θ/(1+θ²) at lag 1, then 0) and the lag-2 partial autocorrelation (r₂ − r₁²)/(1 − r₁²), used to explain the notebook's "cuts off / decays" table.

## Skill map
- ts-structure: concepts 2–5
- lags: concept 7, 17
- chrono-split: concepts 6, 12, 19
- stationarity: concepts 8, 13
- differencing: concepts 9, 13
- autocorrelation: concepts 10, 14
- baselines: concept 12
- forecast-metrics: concept 12, 18
- arima: concepts 15, 16
- lag-features: concepts 17–19
