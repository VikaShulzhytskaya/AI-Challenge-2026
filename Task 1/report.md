# Report — Company Leader Board

A short write-up of how I approached building the leaderboard task.

## Goal

Recreate the leaderboard from the two reference screenshots as a frontend-only
Angular app: a 2-1-3 podium at the top, an expandable list of all employees
underneath, and filters by year, quarter, activity category, and employee
name. The app must be deployable to GitHub Pages with mock data only.

## Tools and techniques

- **Angular 18 (standalone components)** — scaffolded with the Angular CLI
  (`@angular/cli@18 new ... --standalone --style=scss --routing=false`). No
  NgModules; the app is a single standalone root that mounts
  `LeaderboardComponent`.
- **Signals + `computed`** for state and derived data
  ([`leaderboard.component.ts`](leaderboard/src/app/leaderboard.component.ts)):
  - filter inputs are signals (`year`, `quarter`, `category`, `search`),
  - `filteredUsers` is a `computed` that re-filters activities, recomputes
    totals and per-category counts, sorts by points, and assigns ranks,
  - `podium` is a `computed` returning the top 3 from `filteredUsers`,
  - `expanded` is a `Set<string>` signal toggled on row click.
- **New control-flow syntax** (`@if`, `@for`, `track`) instead of `*ngIf` /
  `*ngFor` — fits Angular 18 standalone style and is what `ng new` ships with.
- **Forms + `[ngModel]`** for the filter selects and the search input.
- **SCSS** for styling, with one component-scoped stylesheet per component.
  The podium uses CSS Grid with reordered slots (`order: 2/1/3`) so the
  visual layout is 2-1-3 while the DOM order remains logical. Category pills
  are colored with `[data-cat]` attribute selectors.
- **GitHub Pages packaging** — added a `build:ghpages` script that runs
  `ng build --base-href ./`, copies `index.html` to `404.html` (SPA fallback),
  and adds a `.nojekyll` marker so Pages serves the hashed asset filenames
  as-is. Output lands in `dist/leaderboard/browser/` ready to push to a
  `gh-pages` branch.
- **Build verification** — ran `npm run build:ghpages` after each major step
  to catch template/typing errors and budget violations early. Hit the default
  `anyComponentStyle` budget once and bumped it (10 kB warning / 20 kB error)
  in `angular.json` rather than artificially compressing the SCSS.

## Data model and replacement of the screenshot data

The screenshots show real-looking names, photos, positions and points. None
of that is available as a dataset, so I replaced it with deterministic mock
data while preserving the same shape and behavior the UI needs.

- **Types** ([`models.ts`](leaderboard/src/app/models.ts)) define `User`,
  `Activity`, `ActivityCategory` (`'Public Speaking' | 'Education' |
  'Partnership'`), and `Quarter`. A `UserView` extends `User` with computed
  fields (`rank`, `totalPoints`, `countsByCategory`) so the template stays
  declarative.
- **Generator** ([`mock-data.ts`](leaderboard/src/app/mock-data.ts)) uses:
  - Common US first/last names (40 of each — switched from the original
    Belarusian set on request),
  - A small dictionary of realistic engineering positions,
  - Per-category activity templates with plausible point values
    (e.g. *External Conference Talk* — 128, *Mentoring of Junior Engineers* —
    64),
  - A **seeded LCG** (linear congruential generator) so reloads produce the
    same dataset. This was important for verifying podium ordering and
    rendering without flicker between reloads.
  - Each user gets 8–25 activities spread over 2024–2025, sorted by date
    descending. Avatars come from `https://i.pravatar.cc/150?img=N` with
    deterministic indices.
- **Filtering pipeline** is intentionally pure: the component never mutates
  user records. `filteredUsers` builds a fresh list from the source on every
  filter change, applying year, quarter (derived from month: `Math.ceil(m/3)`),
  category, and a case-insensitive name match. Totals and per-category
  counters are recomputed from the filtered activities, so the podium and the
  collapsed-row counts always reflect the active filters.

This split — static source → pure computed view — meant the same data could
power both the podium and the expandable rows without duplication, and it
made adding the activity-table hover state, switching name pools, or changing
filter semantics low-risk single-spot edits.

## Things I deliberately kept simple

- No router, no service layer, no HTTP — the brief is frontend-only with mock
  data, so a single component with signals is the right size.
- No icon library — used emoji for the activity category icons (🎓 / 🎤 / 🤝)
  to avoid extra dependencies and keep the bundle small.
- No automated deployment workflow committed; the README explains the
  one-liner (`npx gh-pages -d dist/leaderboard/browser`) so the user can
  decide between manual push and a GitHub Action.

## How to run

```bash
cd leaderboard
npm install
npm start                # dev server on http://localhost:4200
npm run build:ghpages    # produces dist/leaderboard/browser/ for GitHub Pages
```
