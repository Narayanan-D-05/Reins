/// Shared easing/timing constants (emil-design-eng: use custom curves,
/// not the weak built-in CSS easings; entrances use ease-out, on-screen
/// movement uses ease-in-out, nothing bounces on a technical/precise page).

export const EASE_OUT_STRONG: [number, number, number, number] = [0.23, 1, 0.32, 1];
export const EASE_IN_OUT_STRONG: [number, number, number, number] = [0.77, 0, 0.175, 1];

export const DURATION = {
  fast: 0.16,
  base: 0.3,
  reveal: 0.6,
  scene: 0.9,
} as const;

/// Standard scroll-reveal variants for Motion's whileInView (Section 5.C
/// pattern from the design-taste skill) — entrance only, never looping.
export const revealUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.3 },
  transition: { duration: DURATION.reveal, ease: EASE_OUT_STRONG },
};

export function revealUpStagger(index: number, step = 0.06) {
  return {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.3 },
    transition: { duration: DURATION.reveal, delay: index * step, ease: EASE_OUT_STRONG },
  };
}
