# Certamen Romanum ⚔️

A 1v1 Roman-arena trivia duel built with Svelte 5.

- 10 seconds per question, 4 answers.
- First to 10 points wins. At 10–10 it's sudden death (*mors subita*): the first player to answer right while the other misses wins.
- Every 3 questions both players vote for the next theme out of 6. If the votes differ, Fortuna (a coin flip) decides.
- Difficulty is rolled on a 4–10 scale (bell curve peaking at 6–7; 9 is 5% and 10 is 2% of questions) and mapped to Open Trivia DB's easy/medium/hard.
- Questions come from [Open Trivia DB](https://opentdb.com) (CC BY-SA 4.0). A built-in bank of 168 questions is the fallback if the API is unreachable.

## How to play
1. Open the site, enter a name and click **Found an arena**.
2. Send the link to your rival. The match starts when they join.
3. Keep your tab open: the host's browser runs the match. Players connect peer-to-peer over WebRTC (PeerJS), so no server is needed.

## Develop
```bash
npm install
npm run dev
```
Pushing to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`.
