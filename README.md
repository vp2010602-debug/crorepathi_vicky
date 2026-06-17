# Today Paper Crorepati Quiz - The Hindu International 17-06-2026

This zip contains a ready-to-play Crorepati/KBC-style current affairs quiz made from the uploaded newspaper PDF.

## Files
- `index.html` - game page
- `style.css` - design and mobile layout
- `app.js` - timer, lifelines, money ladder and non-repeat logic
- `data/questions.json` - 80 questions in clean JSON format
- `data/questions.js` - same questions as JS fallback, so the game can work locally and on GitHub Pages
- `data/questions.csv` - spreadsheet-friendly version

## How to use on GitHub
1. Upload all files and the `data` folder to your repository.
2. Keep the folder name exactly as `data`.
3. Open `index.html` through GitHub Pages.

## Add questions to your existing Crorepati game
Replace your old:
- `data/questions.json`
- `data/questions.js`

with the files from this zip.

Question format:
```json
{
  "id": "TH170626-001",
  "question": "Question text",
  "options": ["A", "B", "C", "D"],
  "answerIndex": 0,
  "category": "National",
  "difficulty": "Easy",
  "source": "Page 1",
  "explanation": "Short explanation"
}
```

`answerIndex` is zero-based: 0 = option A, 1 = option B, 2 = option C, 3 = option D.
