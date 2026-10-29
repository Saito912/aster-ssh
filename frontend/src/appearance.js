// Keep terminal output in the same muted range as the surrounding workspace.
const DARK_TERMINAL_THEME = {
  background: "#202834",
  foreground: "#cbd4df",
  cursor: "#aebdcd",
  cursorAccent: "#202834",
  selectionBackground: "#405165",
  selectionForeground: "#e0e6ed",
  black: "#657487",
  red: "#ca9695",
  green: "#a0bca8",
  yellow: "#cbbb96",
  blue: "#9fb5cd",
  magenta: "#b5a8bd",
  cyan: "#98b8bc",
  white: "#cbd4df",
  brightBlack: "#9aa8ba",
  brightRed: "#d5a7a4",
  brightGreen: "#b3cbb9",
  brightYellow: "#d7c9aa",
  brightBlue: "#b3c6da",
  brightMagenta: "#c7bbcc",
  brightCyan: "#aecbd0",
  brightWhite: "#e0e6ed",
};

const LIGHT_TERMINAL_THEME = {
  background: "#edf0f3",
  foreground: "#344253",
  cursor: "#506881",
  cursorAccent: "#edf0f3",
  selectionBackground: "#cedae5",
  selectionForeground: "#273849",
  black: "#344253",
  red: "#9a4f54",
  green: "#4a705a",
  yellow: "#806333",
  blue: "#4c6b8c",
  magenta: "#7e5e81",
  cyan: "#42727a",
  white: "#596778",
  brightBlack: "#6b7684",
  brightRed: "#aa5b60",
  brightGreen: "#4f7e63",
  brightYellow: "#8d703e",
  brightBlue: "#577c9f",
  brightMagenta: "#8b6a8e",
  brightCyan: "#4d8085",
  brightWhite: "#6a7582",
};

export function terminalTheme(theme) {
  return { ...(theme === "dark" ? DARK_TERMINAL_THEME : LIGHT_TERMINAL_THEME) };
}
