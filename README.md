# RL Playground

> **A browser-based TypeScript lab for reinforcement learning combat simulation** — train, evaluate, and challenge agents in a fast mecha arena.

<p align="center">
  <a href="https://rl-playground-gamma.vercel.app/"><img src="assets/readme/live-cta.svg" alt="Launch RL Playground Live Demo" width="100%" /></a>
</p>

<p align="center">
  <a href="https://rl-playground-gamma.vercel.app/"><strong>🚀 Open the Live Application</strong></a>
</p>

## Overview

RL Playground is a React + TypeScript application focused on interactive reinforcement learning experiences. The current app centers on **Robo-Dojo**, where you can switch between human play, accelerated training, and evaluation workflows while observing agent behavior in real time.

## Key Capabilities

- **Human vs AI Dojo** with keyboard-driven controls.
- **DQN Training Studio** for rapid episode-based training.
- **Policy Evaluation Benchmarks** to compare agents over multiple rounds.
- **2D and 3D Arena Views** with real-time combat visualization.
- **Model Vault + Persistence** for saving/loading learned models.
- **Algorithm Insight Panels** for inspecting RL behavior and metrics.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite
- **State Management:** Zustand
- **Rendering:** Canvas + Three.js (3D mode)
- **Styling/UI:** Tailwind CSS, Lucide React
- **Testing:** `tsx --test` (unit tests in `src/tests`)

## Getting Started

### 1) Install dependencies

```bash
npm install
```

### 2) Run locally

```bash
npm run dev
```

The Vite dev server is configured for port **3000**.

### 3) Quality checks

```bash
npm run test
npm run lint
npm run build
```

## Usage

1. Open the app and start in **Dojo** mode to play against the AI.
2. Switch to **DQN Studio** to train agents at higher simulation speed.
3. Use benchmark/evaluation flows to compare policy performance.
4. Toggle **2D / 3D view** depending on your preferred visualization.

## Live Demo

- **Production URL:** https://rl-playground-gamma.vercel.app/

## License

This project is licensed under the **MIT License**. See [`LICENSE`](./LICENSE).
