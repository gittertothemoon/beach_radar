# Review Pack Automation (Build 13)

## 1) Create or recreate dedicated App Review account

```bash
node scripts/review/create-build13-demo-user.mjs
```

Optional overrides:

```bash
REVIEW_EMAIL="appreview.build13@where2beach.com" \
REVIEW_PASSWORD="<custom-password>" \
REVIEW_CREDENTIALS_OUT="/Users/ivanpanto/Downloads/where2beach_build13_review_credentials.json" \
node scripts/review/create-build13-demo-user.mjs
```

## 2) Record simulated mobile review flow video

```bash
REVIEW_EMAIL="<review-email>" \
REVIEW_PASSWORD="<review-password>" \
node scripts/review/record-build13-review-sim.mjs
```

Optional overrides:

```bash
REVIEW_VIDEO_OUT="/Users/ivanpanto/Downloads/where2beach_build13_review_simulation.webm" \
REVIEW_BEACH_ID="BR-RN-001" \
REVIEW_BEACH_NAME="Bagno Uno" \
REVIEW_EMAIL="<review-email>" \
REVIEW_PASSWORD="<review-password>" \
node scripts/review/record-build13-review-sim.mjs
```

## 3) Generate App Store Connect notes text

```bash
REVIEW_EMAIL="<review-email>" \
REVIEW_PASSWORD="<review-password>" \
REVIEW_VIDEO_PATH="/Users/ivanpanto/Downloads/where2beach_build13_review_simulation.webm" \
node scripts/review/generate-build13-apple-notes.mjs
```

Optional output path:

```bash
REVIEW_NOTES_OUT="/Users/ivanpanto/Downloads/where2beach_build13_app_review_notes.txt" \
REVIEW_EMAIL="<review-email>" \
REVIEW_PASSWORD="<review-password>" \
REVIEW_VIDEO_PATH="/Users/ivanpanto/Downloads/where2beach_build13_review_simulation.webm" \
node scripts/review/generate-build13-apple-notes.mjs
```
