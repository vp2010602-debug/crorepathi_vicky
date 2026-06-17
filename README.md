# Fixed Working Crorepati Quiz

This version is made to avoid common GitHub/local problems.

## Files
- `index.html` is fully standalone. It contains all 80 questions inside the page.
- `data/questions.json` and `data/questions.js` are included only for backup/editing.

## How to use on GitHub Pages
1. Upload `index.html` to the root of your repository.
2. Optional: upload the `data` folder too.
3. Open your GitHub Pages link.

## Why this version should work
- No `fetch()` call.
- No dependency on external JSON loading.
- No nested folder problem.
- Works by directly opening `index.html` also.
