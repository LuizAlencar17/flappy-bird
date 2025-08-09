
# 🐤 Flappy Bird+ — Canvas Edition with AI 🤖

A modernized **Flappy Bird clone** built with pure **HTML5 Canvas + JavaScript**.  
Includes **power-ups**, **score multipliers**, and a **self-playing AI mode** that can fly through the pipes automatically!

* You can access it via:
    * [Website](https://luizalencar17.github.io/flappy-bird) (main page 🏠)


---

## ✨ Features

- 🎮 **Classic Flappy Bird gameplay** — simple click/tap/space to flap.
- ⚡ **Power-ups**:
  - 🛡 **Shield** — survive one collision.
  - ⏳ **Slow-Mo** — slow down time for easier navigation.
  - ✖ **2× Score** — double points for a short time.
- 💰 **Coins** inside gaps for bonus points.
- 📈 **Score tracking** + **local high score** saved in your browser.
- 🤖 **AI Mode** — automatic play with smart gap prediction and restart.
- 🌤 **Animated background** with scrolling clouds and ground.

---

## 🕹 Controls

| Action             | Key / Mouse / Touch |
|--------------------|---------------------|
| **Flap**           | Space / Left Click / Tap |
| **Pause / Resume** | **P**               |
| **Restart**        | **R**               |
| **Toggle AI Mode** | **A** or click 🤖 button |

---

## 🚀 How to Run

1. **Download** or **clone** the project:
```bash
   git clone https://github.com/your-username/flappy-bird-plus.git
````

2. Open `index.html` in any modern browser.
3. Play or let the AI do the work! 🎯

![Example](https://github.com/LuizAlencar17/flappy-bird/blob/main/files/1.png?raw=true)
![Example](https://github.com/LuizAlencar17/flappy-bird/blob/main/files/2.png?raw=true)
![Example](https://github.com/LuizAlencar17/flappy-bird/blob/main/files/1.gif?raw=true)


---

## 📂 Project Structure

```plaintext
.
├── index.html   # Game layout & UI
├── styles.css   # Visual styles for game & HUD
├── flappy.js    # Game logic, rendering, physics, AI
└── README.md    # This file
```

---

## 🤖 AI Mode

Our AI uses:

* **Gap-centered targeting** — aims for the middle of the next pipe’s gap.
* **Trajectory prediction** — simulates where the bird will be with and without flapping.
* **Overshoot prevention** — won’t flap if it would cause the bird to hit the top.
* **Dynamic margin** — adjusts tolerance based on speed.
* **Flap cooldown** — avoids rapid spam-flapping.
* **Auto-restart** — keeps going indefinitely.

💡 *It’s good, but not perfect — for a more “human” feel, you can add small randomness or coin-chasing behavior.*

---

## 🛠 Customization

* Change game speed, gap size, and difficulty by tweaking constants in `flappy.js`.
* Adjust AI aggressiveness with:

  * `AI_BASE_MARGIN`
  * `AI_VY_CAP`
  * `AI_FLAP_COOLDOWN`
* Replace assets with your own graphics or add sound effects for a richer experience.

---

## 📜 License

MIT License © 2025 — Use, modify, and share freely.

---

### ❤️ Enjoy the game?

If you like it, drop a ⭐ on GitHub and share it with friends!
