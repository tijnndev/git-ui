// All user-configurable preferences. Stored in localStorage under "git_ui_settings".

export interface AppSettings {
  // ── Graph ─────────────────────────────────────────────────
  graphRowHeight: number;      // px per row  (default 36)
  graphLaneWidth: number;      // px per lane (default 18)
  graphFontSize: number;       // px (default 13)
  graphMaxCommits: number;     // max commits to load (default 500)
  showAuthorCol: boolean;
  showDateCol: boolean;
  showHashCol: boolean;

  // ── Editor / Diff ─────────────────────────────────────────
  diffFontSize: number;        // px (default 12)
  monoFont: string;            // font-family string

  // ── Theme: CSS variable overrides ─────────────────────────
  themeBg0: string;
  themeBg1: string;
  themeBg2: string;
  themeBgPanel: string;
  themeAccent: string;
  themeAccentHover: string;
  themeTextPrimary: string;
  themeTextSecondary: string;
  themeTextMuted: string;
  themeGreen: string;
  themeRed: string;
  themeYellow: string;
  themeBorder: string;

  // ── Custom CSS ────────────────────────────────────────────
  customCss: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  graphRowHeight: 36,
  graphLaneWidth: 18,
  graphFontSize: 13,
  graphMaxCommits: 500,
  showAuthorCol: true,
  showDateCol: true,
  showHashCol: true,

  diffFontSize: 12,
  monoFont: '"Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, monospace',

  themeBg0: "#0d0d0d",
  themeBg1: "#141414",
  themeBg2: "#1a1a1a",
  themeBgPanel: "#181818",
  themeAccent: "#009280",
  themeAccentHover: "#00a890",
  themeTextPrimary: "#f0f0f0",
  themeTextSecondary: "#a8a8a8",
  themeTextMuted: "#606060",
  themeGreen: "#00c896",
  themeRed: "#f05050",
  themeYellow: "#e8b84b",
  themeBorder: "#262626",

  customCss: "",
};

const STORAGE_KEY = "git_ui_settings";

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

/** Inject CSS variables + custom CSS into a <style id="git-ui-theme"> element */
export function applySettings(s: AppSettings): void {
  let el = document.getElementById("git-ui-theme") as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = "git-ui-theme";
    document.head.appendChild(el);
  }
  el.textContent = `
:root {
  --bg-0: ${s.themeBg0};
  --bg-1: ${s.themeBg1};
  --bg-2: ${s.themeBg2};
  --bg-panel: ${s.themeBgPanel};
  --bg-hover: color-mix(in srgb, ${s.themeBg2} 60%, ${s.themeAccent} 10%);
  --bg-selected: color-mix(in srgb, ${s.themeBg2} 70%, ${s.themeAccent} 30%);
  --border: ${s.themeBorder};
  --border-light: color-mix(in srgb, ${s.themeBorder} 60%, white 40%);
  --text-primary: ${s.themeTextPrimary};
  --text-secondary: ${s.themeTextSecondary};
  --text-muted: ${s.themeTextMuted};
  --accent: ${s.themeAccent};
  --accent-hover: ${s.themeAccentHover};
  --accent-2: color-mix(in srgb, ${s.themeAccent} 60%, white 40%);
  --accent-dim: color-mix(in srgb, ${s.themeAccent} 15%, transparent);
  --green: ${s.themeGreen};
  --red: ${s.themeRed};
  --yellow: ${s.themeYellow};
  --font-mono: ${s.monoFont};
}
${s.customCss}
`.trim();
}
