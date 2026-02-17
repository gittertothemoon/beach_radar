# KML Intake

Store raw beach KML exports in this folder.

Conventions:
- Keep original filenames from source exports when possible.
- Treat files here as input artifacts (do not edit manually).
- After any import/update, run:

```bash
npm run seed:sync
```

That command also runs `seed:validate` and fails on inconsistencies.
