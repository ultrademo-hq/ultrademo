// favicon.mjs — the tab icon on every page the skill shows: the play-o (lime ring, pink play) on ink, the same mark as
// ultrademo.net's icons. Inlined as a data URI, so it works for served pages and for pages opened as files alike.
const RING = 'M-305.5 0A305.5 305.5 0 1 1 305.5 0A305.5 305.5 0 1 1 -305.5 0ZM-146.6 0A146.6 146.6 0 1 0 146.6 0A146.6 146.6 0 1 0 -146.6 0Z';
const PLAY = 'M-33.9 -95.7L109 -13.2A15.3 15.3 0 0 1 109 13.2L109 13.2L-33.9 95.7A15.3 15.3 0 0 1 -56.8 82.5L-56.8 82.5L-56.8 -82.5A15.3 15.3 0 0 1 -33.9 -95.7Z';

export const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-400 -400 800 800"><rect x="-400" y="-400" width="800" height="800" rx="176" fill="#0C0E09"/><path fill-rule="evenodd" fill="#DFFE02" d="${RING}"/><path fill="#FF2070" d="${PLAY}"/></svg>`;

export const FAVICON = `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(FAVICON_SVG)}">`;
