/**
 * @typedef {Object} ThemePalette
 * @property {string} primary
 * @property {string} secondary
 * @property {string} accent
 * @property {string} background
 * @property {string} surface
 * @property {string} surfaceMuted
 * @property {string} textPrimary
 * @property {string} textMuted
 * @property {string} statusOk
 * @property {string} statusWarning
 * @property {string} statusCritical
 */

/**
 * @typedef {Object} ArchetypeTheme
 * @property {string} id
 * @property {string} label
 * @property {ThemePalette} palette
 * @property {"woven-glow" | "horizon-drift" | "blueprint-grid" | "frost-shimmer" | "kiln-heat"} backgroundMotif
 * @property {"sharp" | "soft"} cardRadius
 * @property {string[]} iconSet
 * @property {"particle-warm" | "particle-organic" | "gauge-pulse" | "frost-pulse" | "heat-shimmer"} accentEffect
 */

export const THEME_ICONS = {
  "basket": "🧺",
  "rupee": "₹",
  "shelf": "📦",
  "leaf": "🌱",
  "water": "💧",
  "sun": "☀️",
  "gear": "⚙️",
  "conveyor": "🏭",
  "gauge": "⏱️",
  "cone": "🍦",
  "thermometer": "🌡️",
  "snowflake": "❄️",
  "flame": "🔥",
  "stacked-tile": "🧱"
};

/** @type {ArchetypeTheme[]} */
export const ARCHETYPES = [
  {
    id: "kirana-shop",
    label: "Kirana Shop",
    palette: {
      primary: "#D97B3F",
      secondary: "#8C5A2B",
      accent: "#E8B84B",
      background: "#1A140F",
      surface: "#241C15",
      surfaceMuted: "#1E1812",
      textPrimary: "#F5F3EE",
      textMuted: "#8B93A8",
      statusOk: "#10b981",
      statusWarning: "#f59e0b",
      statusCritical: "#ef4444"
    },
    backgroundMotif: "woven-glow",
    cardRadius: "soft",
    iconSet: ["basket", "rupee", "shelf"],
    accentEffect: "particle-warm"
  },
  {
    id: "farm",
    label: "Farm",
    palette: {
      primary: "#3B6B4A",
      secondary: "#6B4A32",
      accent: "#D4A73D",
      background: "#0F1A12",
      surface: "#17241B",
      surfaceMuted: "#121C15",
      textPrimary: "#F5F3EE",
      textMuted: "#8B93A8",
      statusOk: "#10b981",
      statusWarning: "#f59e0b",
      statusCritical: "#ef4444"
    },
    backgroundMotif: "horizon-drift",
    cardRadius: "soft",
    iconSet: ["leaf", "water", "sun"],
    accentEffect: "particle-organic"
  },
  {
    id: "paper-factory",
    label: "Paper Factory",
    palette: {
      primary: "#4A5568",
      secondary: "#2D3748",
      accent: "#F0A030",
      background: "#14181D",
      surface: "#1C222B",
      surfaceMuted: "#171C23",
      textPrimary: "#F5F3EE",
      textMuted: "#8B93A8",
      statusOk: "#10b981",
      statusWarning: "#f59e0b",
      statusCritical: "#ef4444"
    },
    backgroundMotif: "blueprint-grid",
    cardRadius: "sharp",
    iconSet: ["gear", "conveyor", "gauge"],
    accentEffect: "gauge-pulse"
  },
  {
    id: "ice-cream-factory",
    label: "Ice Cream Factory",
    palette: {
      primary: "#2FBFA0",
      secondary: "#C4547A",
      accent: "#F0E6D2",
      background: "#0D1A1D",
      surface: "#16262A",
      surfaceMuted: "#111D21",
      textPrimary: "#F5F3EE",
      textMuted: "#8B93A8",
      statusOk: "#10b981",
      statusWarning: "#f59e0b",
      statusCritical: "#ef4444"
    },
    backgroundMotif: "frost-shimmer",
    cardRadius: "soft",
    iconSet: ["cone", "thermometer", "snowflake"],
    accentEffect: "frost-pulse"
  },
  {
    id: "tiles-factory",
    label: "Tiles Factory",
    palette: {
      primary: "#D9622B",
      secondary: "#8C4A2F",
      accent: "#E8A33D",
      background: "#16110E",
      surface: "#211A15",
      surfaceMuted: "#1B1511",
      textPrimary: "#F5F3EE",
      textMuted: "#8B93A8",
      statusOk: "#10b981",
      statusWarning: "#f59e0b",
      statusCritical: "#ef4444"
    },
    backgroundMotif: "kiln-heat",
    cardRadius: "sharp",
    iconSet: ["flame", "stacked-tile", "thermometer"],
    accentEffect: "heat-shimmer"
  }
];

export function validateTheme(theme) {
  if (!theme) return false;
  const requiredKeys = ['id', 'label', 'palette', 'backgroundMotif', 'cardRadius', 'iconSet', 'accentEffect'];
  const paletteKeys = ['primary', 'secondary', 'accent', 'background', 'surface', 'surfaceMuted', 'textPrimary', 'textMuted', 'statusOk', 'statusWarning', 'statusCritical'];
  
  for (const key of requiredKeys) {
    if (!theme[key]) return false;
  }
  if (!theme.palette) return false;
  for (const pKey of paletteKeys) {
    if (!theme.palette[pKey]) return false;
  }
  return true;
}
