# Company Leader Board

Angular 18 standalone app — a mock leaderboard with podium, expandable user rows,
and filters by year, quarter, activity category, and employee name.

## Develop

```bash
npm install
npm start          # http://localhost:4200
```

## Build for GitHub Pages

```bash
npm run build:ghpages
```

This produces a static site in `dist/leaderboard/browser/` with:
- `--base-href ./` so paths work under any GitHub Pages sub-path,
- `404.html` (copy of `index.html`) for SPA fallback,
- `.nojekyll` so GitHub Pages serves all files as-is.

### Deploy

Easiest: push the contents of `dist/leaderboard/browser/` to the `gh-pages`
branch of your repository. With the `gh-pages` CLI:

```bash
npx gh-pages -d dist/leaderboard/browser
```

Or configure GitHub Pages to serve from the `gh-pages` branch (root). The
site will be available at `https://<user>.github.io/<repo>/`.

## Project layout

- `src/app/leaderboard.component.*` — main component (podium + list + filters)
- `src/app/mock-data.ts` — deterministic mock users and activities
- `src/app/models.ts` — types: `User`, `Activity`, `ActivityCategory`, `Quarter`

All data is mock; avatars come from `https://i.pravatar.cc/`.
