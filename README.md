# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Domain & Share Preview Verification
1. Open `https://www.beachradar.it` and confirm it returns a 301 redirect to `https://beachradar.it`.
2. Open `https://beach-radar.vercel.app` and confirm it returns a 301 redirect to `https://beachradar.it`.
3. Open `http://beachradar.it` and confirm it returns a 301 redirect to `https://beachradar.it`.
4. Paste `https://beachradar.it` in WhatsApp/Telegram/iMessage and confirm the preview shows the expected title, description, and image.

## Performance Profiling (Chrome)
1. Start the app with `npm run dev`.
2. Enable the dev performance overlay by visiting `/debug` or running `localStorage.setItem(\"br_debug_v1\", \"1\")` in the console, then refresh.
3. Open Chrome DevTools → Performance.
4. Click Record, then exercise the hotspots for 10–20 seconds:
   Pan/zoom the map, open/close the Lido modal, type quickly in search, and generate a share card.
5. Stop recording and check:
   Look for long main-thread tasks, repeated layout/paint work, and clustering spikes.
6. Open DevTools → React Profiler.
7. Record while repeating the same actions and confirm render counts align with the overlay:
   MapView should not re-cluster on selection changes in normal mode, and search renders should feel throttled while typing.
