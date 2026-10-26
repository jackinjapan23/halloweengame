# Midnight Candy

An offline, team-based Halloween English revision game for Japanese junior high school classrooms. The app uses plain browser JavaScript modules and needs no account, build step, database, or runtime network connection.

## Run on Windows

1. Open PowerShell in this folder.
2. Start Python's built-in local web server:

   ```powershell
   py -m http.server 8000
   ```

3. Open http://localhost:8000 in a modern browser.
4. Stop the server with Ctrl+C when the game is over.

The app uses ES modules, so serve this folder over localhost instead of opening `index.html` directly. Game state saves in this browser's local storage.

## Project structure

- `index.html`, `styles.css` - application shell and visual design
- `src/app.js` - screens, teacher controls, and interaction flow
- `src/questions.js` - 24 sample questions across five question types
- `src/outcomes.js` - configurable Trick or Treat outcomes
- `src/engine.js` - persistence, scoring effects, and turn rotation

## Teacher controls

- Setup supports 2-6 teams, starting Candy, and 1-20 pumpkins.
- The teacher reveals model answers and manually marks each response.
- Use Adjust scores or Undo last action on the scoreboard.
- Pause and resume at any time. New Game asks before replacing the active game.
