export type ChildImage = {
  originalUrl?: string|null;
  processedUrl?: string|null;
  framedUrl?: string|null;
  layoutUrl?: string|null;
  Config?: any;
  status?: string|null;
  createdAt?: string;
};

export function pickComposeInputsFromImages(images?: ChildImage[] | null) {
  if (!images || images.length === 0) return null;

  const ranked = [...images]
    .map((it) => {
      const score =
        (it.processedUrl ? 2 : it.originalUrl ? 1 : 0) +
        (it.layoutUrl ? 1 : 0) +
        (it.Config ? 1 : 0) +
        (it.status === 'COMPOSED' ? 0.2 : 0);
      return { it, score, ts: new Date(it.createdAt || 0).getTime() };
    })
    .sort((a,b)=> b.score - a.score || b.ts - a.ts);

  const best = ranked[0].it;

  const photoUrl = best.processedUrl || best.originalUrl || null;
  const layoutUrl = best.layoutUrl || null;
  const config    = best.Config || null;
  const fallback  = best.framedUrl || null;

  if (!photoUrl || !layoutUrl || !config) {
    // ainda assim devolve fallback se existir
    if (fallback) return { photoUrl: '', layoutUrl: '', config: null, fallbackUrl: fallback };
    return null;
  }

  return { photoUrl, layoutUrl, config, fallbackUrl: fallback };
}
