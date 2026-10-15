# CurveballNext

An independent, from-scratch reimplementation of **Curveball**, the 2002 Flash 3D-pong game: you and an opponent trade a ball across a glowing court, and the spin you put on it with the paddle bends its path.

**[Play it in your browser →](https://curveballnext.pages.dev)**

- **Classic** — the single-player campaign: ten levels, lives, score and time bonus, an AI opponent that gets harder.

A private online 1×1 mode existed from October 2026 and was retired on 15 October 2026; its code remains in the Git history (see [project status](docs/project-status.md)).

Everything is drawn with Canvas and synthesized with Web Audio. No original artwork, sound or code is used or distributed.

## How to play

- **Move the mouse** to steer your paddle (the near, cyan one).
- **Click** while the ball is on your paddle to serve.
- **Curve the ball** by moving the paddle as it hits: the ball bends toward the direction you were moving.
- Miss and you lose a life; make the opponent miss and they lose one. The opponent has three lives per level; take them all to move up a level.
- `Esc` pauses. The **Sound** button toggles the sound effects.

## How it was built

The goal was behavioral fidelity before anything else. The original SWF was studied to recover the game's rules (collision, curve physics, timing, difficulty tables), and the game logic was then written independently from that specification. The simulation is deterministic at 30 Hz and was checked frame by frame against the original running in [Ruffle](https://ruffle.rs). Adobe Flash Player equivalence itself is not proven.

## Run locally

Requires Node 22.12+ (22 line), 24, or 26+.

```bash
npm ci
npm test
npm run dev        # http://127.0.0.1:5173
```

Production build: `npm run build`, then `npm run preview`.

## Documentation

| | |
|---|---|
| [Project status](docs/project-status.md) | Milestones M1–M6, what was verified and what remains unverified |
| [Original behavior](docs/original-behavior.md) | The recovered rules of the original game |
| [Compatibility assumptions](docs/compatibility-assumptions.md) | Where this implementation deliberately differs or is uncertain |
| [Online runbook](docs/m5-runbook.md) | Historical: how the retired multiplayer server was run, and how it was shut down |
| [Project boundaries](docs/project-boundaries.md) | What is and is not taken from the original |
| [`docs/milestones/`](docs/milestones/) | Detailed per-milestone plans and evidence |

## Notes

The code is released under the [MIT License](LICENSE). The original game's SWF and assets are never distributed here; private reference files live in `reference-local/`, which Git ignores. This is an independent fan project and is not affiliated with the original authors.
