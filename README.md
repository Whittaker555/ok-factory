# OK Factory

**okfactory.live** — A browser-based idle factory game inspired by Satisfactory.

## Play

Open `public/index.html` in any modern desktop browser, or visit [okfactory.live](https://okfactory.live).

## Project Structure

```
ok-factory/
├── public/           # Static site — deploy this folder
│   └── index.html    # Entire game (HTML + CSS + JS, zero dependencies)
├── tests/
│   └── test.js       # 92-test Node.js suite (no deps)
├── docs/
│   ├── ARCHITECTURE.md
│   └── GAME_DESIGN.md
├── .gitignore
└── README.md
```

## Tech Stack

- **Vanilla HTML/CSS/JS** — single file, zero dependencies, S3/static-host ready
- **Canvas** — conveyor belt animation via `requestAnimationFrame`
- **CSS Grid** — responsive 4-row layout (topbar, conveyor, content, statusbar)
- **LocalStorage** — auto-save with 24h TTL, export/import `.sav` files

## Running Tests

```bash
node tests/test.js
```

## Deploying

Upload the `public/` folder to any static host (S3, Cloudflare Pages, Netlify, Vercel, etc.). No build step required.

## License

All rights reserved © 2026
