/** Resolves a `public/assets/*` file to a URL that respects Vite's configured `base`. */
export function asset(path: string): string {
  return `${import.meta.env?.BASE_URL ?? '/'}assets/${path}`;
}
