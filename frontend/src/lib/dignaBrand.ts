import type { CSSProperties } from "react";

type BrandStyle = CSSProperties & Record<`--${string}`, string>;

/**
 * Identidade visual do Portal Interno Digna Saúde.
 * Os tokens --xango-* alimentam as classes Tailwind xango-* definidas em globals.css.
 */
export const dignaBrandStyle: BrandStyle = {
  "--xango-primary": "#572A8F",
  "--xango-primary-hover": "#452170",
  "--xango-sidebar": "#351B57",
  "--xango-sidebar-hover": "#47246F",
  "--digna-green": "#98C538",
  "--xango-accent": "#5E7F1E",
  "--xango-background": "#F8F6F2",
  "--xango-border": "#E4DDE6",
  "--xango-text": "#2F2935",
  "--xango-muted": "#716A76",
};
