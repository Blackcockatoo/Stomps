/**
 * Promo / menu art (public/moss/promo). Pixel stills painted to the B$S style sheet,
 * downscaled nearest-neighbour to WebP. They dress the menu, mode tiles, LOOK preview
 * and Stage Cards only: the playfield is still engine-drawn and Moss in play keeps the
 * original sprite frames (promo "Damo" wears a cap and puffer; the sprites do not).
 * check-assets verifies each file is byte-identical in dist and the service worker
 * precaches them, so the menu works offline.
 */
export const PROMO = {
  splash: "/moss/promo/splash.webp",
  pier: "/moss/promo/pier.webp",
  station: "/moss/promo/station.webp",
  strip: "/moss/promo/strip.webp",
  royalRave: "/moss/promo/royal-rave.webp",
  mossquake: "/moss/promo/mossquake.webp",
  damoRed: "/moss/promo/damo-red.webp",
  damoCream: "/moss/promo/damo-cream.webp",
  poster: "/moss/promo/poster.webp",
} as const;
