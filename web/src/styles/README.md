# Design tokens

The existing marketing page styles/tokens are in `src/styles.css`; preserve
its current palette and hash-page layout. The product PWA should centralize
tokens here for Beez yellow, ink, surfaces, borders, status colors, typography,
spacing and light/dark mode. Contrast and focus styles must remain accessible;
state colors must never be the only signal.

Do not move/change landing styles incidentally while building a product
feature. Extract shared variables in a dedicated change with visual
regression checks.
