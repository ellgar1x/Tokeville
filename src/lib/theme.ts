/** Parse a hex color and return r, g, b components 0–255. */
function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace("#", "");
  if (h.length !== 6) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function clamp(v: number) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("");
}

/** Lighten a hex color by a factor 0–1. */
function lighten(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(
    rgb[0] + (255 - rgb[0]) * amount,
    rgb[1] + (255 - rgb[1]) * amount,
    rgb[2] + (255 - rgb[2]) * amount,
  );
}

/** Darken a hex color by a factor 0–1. */
function darken(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(rgb[0] * (1 - amount), rgb[1] * (1 - amount), rgb[2] * (1 - amount));
}

/** Build CSS variable overrides for a workspace primary color. */
export function buildColorVars(primary: string, isDark: boolean): Record<string, string> {
  if (!primary || !hexToRgb(primary)) return {};
  const rgb = hexToRgb(primary)!;
  const softAlpha = isDark ? "0.12" : "0.10";
  const bright = isDark ? lighten(primary, 0.18) : lighten(primary, 0.12);
  const deep = isDark ? darken(primary, 0.18) : darken(primary, 0.12);
  return {
    "--gold": primary,
    "--gold-bright": bright,
    "--gold-deep": deep,
    "--gold-soft": `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${softAlpha})`,
    "--gold-ring": `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.4)`,
  };
}
