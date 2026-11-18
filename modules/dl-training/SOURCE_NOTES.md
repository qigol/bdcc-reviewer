# Source notes — Training Neural Networks: Hyperparameters and Regularization

## Source
- File: Session_20_Hyperparameter_Tuning_and_Regularization.ipynb (guided notebook, NumPy MLP) | Sessions: 19–20 | Date: 2026-10-16 / 2026-10-20
- Session 19 (training dynamics, diagnosing failed runs) and Session 20 (NumPy → PyTorch) have no separate files here; their ideas (loss-curve diagnosis, the training loop) are covered from this notebook's Part D table and Key takeaways, and from the CNN notebook's training loop (zero_grad, forward, loss, backward, step; train()/eval()).

## Concept inventory (lecture order)
1. Part A — parameters vs hyperparameters; three families (architecture, optimization & training, regularization); the 2–64–64–1 network has 4,417 parameters.
2. Running example — two moons; split 160 / 300 / 1000; standardize with training statistics only; BCE loss on logits; dropout off at inference.
3. B1 learning rate — bowl ½θ² from θ0 = 2 with η = 0.1, 0.8, 1.8, 2.1; network table for η = 0.003, 0.03, 0.3, 3.0; log-scale search; schedules.
4. B2 batch size — full-batch, SGD, mini-batch; steps per epoch ⌈N/B⌉; gradient scatter 1.48 / 0.69 / 0.29 for B = 4 / 16 / 64; table B = 4, 16, 160.
5. B3 epochs — 5 epochs underfit, best epoch, 1000 epochs overfit.
6. B4 momentum — v = βv + g, θ = θ − ηv; up to 10× with β = 0.9; valley L = ½(θ1² + 50θ2²); table β = 0, 0.5, 0.9 at η = 0.01.
7. B5 optimizer — Adam (per-parameter step sizes, bias correction); table SGD 0.1, Adam 0.003, Adam 0.1.
8. Part C — training / validation / test roles; 50 equally good configurations, the "best" scores 0.890 vs true 0.850.
9. Part D — under / good / overfit diagnosis table; regularization often helps, not guaranteed.
10. D1 early stopping — δ, patience, restore best weights; find_stopping_point; patience 50, δ = 1e-3; stopped run 136 epochs, val loss 0.235.
11. D2 dropout — rate p, random each step, survivors scaled by 1/(1 − p), off at inference; p = 0.3 helps, 0.9 underfits.
12. D3 L2 / weight decay — L_total = L_data + λ/2 Σw² (biases excluded); one weight: best w = 3/(1 + λ); weight sizes 373.9 / 23.4 / 4.1; AdamW note; λ = 0.05 underfits.

## Formulas (verbatim, as TeX)
- `\theta_{\text{new}} = \theta - \eta\,\nabla_\theta L(\theta)` — Part B
- `v_t = \beta\, v_{t-1} + g_t, \qquad \theta_t = \theta_{t-1} - \eta\, v_t` — B4
- `L_{\text{total}} = L_{\text{data}} + \frac{\lambda}{2}\sum w^2` — D3
- Steps per epoch: `N / B`, rounded up — B2
- BCE: `-\frac{1}{n}\sum [y\log\hat p + (1-y)\log(1-\hat p)]` — running example

## Worked examples (exact numbers)
- 4,417 parameters (192 + 4,160 + 65) (→ net-params, net-params-code)
- Bowl paths θ: η 0.1 → 1.8; η 0.8 → 0.4, 0.08; η 1.8 → −1.6, 1.28; η 2.1 → −2.2, 2.42 (→ bowl-*)
- Steps 40 / 10 / 1 per epoch; 8,000 / 2,000 / 200 total (→ steps-*)
- β = 0.9 steps grow up to ≈ 10× (→ momentum-ten)
- Adam first step = η (→ adam-first-step, adam-code)
- Tables B1, B2, B4, B5, D1 and weight sizes are datasets (lrruns, batchruns, momruns, optruns, stopruns, wsize); best val loss η = 0.03 (0.255), best train loss η = 0.3 (0.112) (→ lr-best-*)
- One-weight penalty: λ = 0.5 → w = 2; λ = 2 → w = 1 (→ best-weight*)

## Conventions & ambiguities
- Momentum is the notebook's form v = βv + g (no 1 − β factor); Adam uses (1 − β)g with bias correction.
- Early-stopping rule exactly as find_stopping_point: improvement means loss < best − δ; wait counts epochs without improvement; stop when wait ≥ patience; restore the best epoch.
- Inverted dropout as in `forward`: mask/keep_prob during training only.
- L2 penalty excludes biases; its gradient λw is added to the data gradient (SGD), giving w ← (1 − ηλ)w − ηg.

## Errata
- None found.

## Beyond the slides
- valhist: a 10-epoch validation history to replay the early-stopping rule by hand (illustrative).
- shapeCurves: stylized curve shapes for diagnosis practice (illustrative).
- Hand toys for momentum (constant gradient), dropout (4 units), weight decay (two weights), scaling (4 values).
- The application case (a bank's churn network) and its numbers.

## Skill map
- params-vs-hyper: A · learning-rate: B1 · batch-size: B2, B3, training loop · momentum: B4 · optimizers: B5 · hp-selection: C, data split · diagnose: D table, takeaways · early-stopping: D1 · dropout: D2 · l2: D3
