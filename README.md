# AI Conversation Shares

A small static site for publishing shareable AI conversation notes.

The repository is intentionally simple:

- `content/`: source Markdown posts with front matter.
- `public/`: generated static site output.
- `assets/images/`: share images and screenshots.
- `scripts/build.js`: converts Markdown posts into static HTML.
- `.github/workflows/deploy.yml`: publishes `public/` to GitHub Pages.

## Workflow

1. Add a Markdown post under `content/`.
2. Put images under `assets/images/`.
3. Run:

   ```bash
   node scripts/build.js
   ```

4. Commit and push.
5. GitHub Pages deploys the generated site.

## Privacy Rule

Before publishing, remove private information:

- account balances
- account screenshots
- phone numbers, emails, addresses
- private names
- credentials, local paths, tokens
- anything that should not be public

This repository is for sharing research workflows and educational notes. It is not investment advice.

