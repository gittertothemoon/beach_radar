# VIDEO BRIEF - Beach Radar (Handoff)

## Goal
Promo verticale 1080x1920, 12s, obiettivo: waitlist.

## Target
Riviera + Bologna. Persone che decidono all'ultimo dove andare al mare e vogliono evitare spiagge piene.

## Tone
Tech-summer, diretto, zero cringe.

## Palette
| Hex | Uso |
| --- | --- |
| `#020617` | Background deep (waitlist hero) |
| `#07090D` | Background app (map shell) |
| `#0B0F16` | Surface/panel |
| `#F8FAFC` | Testo primario/CTA light button |
| `#94A3B8` | Testo secondario |
| `#06B6D4` | Accent principale (glow, radar, highlights) |
| `#3B82F6` | Accent secondario (ocean blue) |
| `#22C55E` | Stato LIVE |
| `#F59E0B` | Stato RECENT |
| `#64748B` | Stato PRED/stima |
| `#FACC15` | Crowd level 2 |
| `#F97316` | Crowd level 3 |
| `#EF4444` | Crowd level 4 / warning |

## Typography
- Heading: `Space Grotesk` (500, 600, 700)
- Body/UI: `Inter` (300, 400, 500)
- Font locali: `MISSING` (nessun `.woff/.ttf` nel repo; font caricati da Google Fonts)

## Asset list
| Nome | Path nel repo | Note |
| --- | --- | --- |
| Logo principale (pin + radar) | `src/assets/logo.png` | PNG RGBA 1536x1024 |
| Wordmark "BEACH RADAR" | `src/assets/beach-radar-scritta.png` | PNG RGBA 1536x1024 |
| Logo waitlist (duplica logo main) | `public/waitlist/logo.png` | Gia pronto in `public/` |
| Wordmark waitlist | `public/waitlist/beach-radar-scritta.png` | Gia pronto in `public/` |
| Background hero sharecard | `src/assets/sharecard-bg.png` | Texture blu con onda light |
| Background initial | `src/assets/initial-bg.png` | Variante background |
| Pin beach livello 1 | `src/assets/markers/pin_beach.png` | Icona umbrella base |
| Pin beach livello 2 | `src/assets/markers/pin_beach_poco_affollata.png` | Poco affollata |
| Pin beach livello 3 | `src/assets/markers/pin_beach_affollata.png` | Affollata |
| Pin beach livello 4 | `src/assets/markers/pin_beach_piena.png` | Piena |
| Pin cluster | `src/assets/markers/pin_cluster.png` | Cluster count |
| OG fallback image | `public/og/og-default.png` | 1200x630, fallback statico |
| Logo SVG | `MISSING` | Fallback: usare `src/assets/logo.png` (dimensione gia alta) |
| Screenshot UI app verticale | `MISSING` | Fallback: usare composizione mock con `sharecard-bg` + pin assets |

## Storyboard 3 scene
### 0-3s
- Testo esatto: `Il radar per le tue spiagge.`
- Visual: reveal rapido di `logo.png` + wordmark su sfondo `sharecard-bg.png`, glow ciano (`#06B6D4`) e micro-radar pulse.

### 3-9s
- Testo esatto:
  - `Evita la folla.`
  - `Scopri dove c'è posto grazie alle segnalazioni della community, in tempo reale.`
  - `Early Access • Badge Founding Member • Priorità sulla tua zona`
- Visual: card-style UI con pin colorati (lvl 1-4) e stati LIVE/RECENT/PRED (verde/arancio/grigio), movimento verticale leggero tipo feed/map overlay.

### 9-12s
- Testo esatto:
  - `Prima ondata limitata.`
  - `OTTIENI ACCESSO ANTICIPATO`
- Visual: CTA button bianco su background deep, logo in alto, countdown/slots come elemento di scarsita (es. `Posti rimanenti`).

## Safe areas
- Canvas: `1080x1920` (9:16).
- Margine testo laterale consigliato: `>= 72px` per lato.
- Margine top consigliato: `>= 180px` (evita overlay UI piattaforme).
- Margine bottom consigliato: `>= 260px` (caption + CTA native Reels/TikTok).
- Mantieni hook e CTA nel blocco sicuro centrale: area indicativa `x:72..1008`, `y:180..1660`.

## Do/Don't
- Do: usare solo copy breve e leggibile in 1 passaggio.
- Do: mantenere contrasto alto (`#F8FAFC` su blu scuri).
- Do: usare accenti ciano/blu come segno brand.
- Do: mostrare segnali utili (LIVE/RECENT/PRED) prima della CTA.
- Don't: sovraccaricare la scena con troppi layer testuali.
- Don't: usare font diversi da Space Grotesk/Inter.
- Don't: usare palette estranee (viola/magenta non presenti nel brand core).
- Don't: trasformare il tone in meme/comedy; restare utility-first.
