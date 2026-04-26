import { useState, useCallback, useEffect } from "react";
import { X, RotateCcw, Palette, GitBranch, Type, Code, Github, Trash2, Plus } from "lucide-react";
import type { AppSettings } from "../settings";
import { DEFAULT_SETTINGS } from "../settings";
import type { GitHubAccount } from "../github-accounts";
import { loadAccounts, saveAccounts } from "../github-accounts";
import { nanoid } from "../nanoid";

interface Props {
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
  onClose: () => void;
}

type Section = "graph" | "theme" | "editor" | "css" | "accounts";

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: "graph",    label: "Graph",         icon: <GitBranch size={14} /> },
  { id: "theme",    label: "Theme",         icon: <Palette   size={14} /> },
  { id: "editor",   label: "Editor / Diff", icon: <Type      size={14} /> },
  { id: "css",      label: "Custom CSS",    icon: <Code      size={14} /> },
  { id: "accounts", label: "GitHub Accounts", icon: <Github  size={14} /> },
];

function ColorRow({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="settings-row">
      <label className="settings-label">{label}</label>
      <div className="settings-color-wrap">
        <input type="color" className="settings-color-swatch" value={value}
          onChange={(e) => onChange(e.target.value)} />
        <input type="text" className="settings-text-input settings-color-hex"
          value={value} onChange={(e) => onChange(e.target.value)}
          spellCheck={false} />
      </div>
    </div>
  );
}

function NumberRow({
  label, value, min, max, step = 1, onChange,
}: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div className="settings-row">
      <label className="settings-label">{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="range" className="settings-slider"
          min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))} />
        <span className="settings-value-badge">{value}</span>
      </div>
    </div>
  );
}

function ToggleRow({
  label, value, onChange,
}: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="settings-row">
      <label className="settings-label">{label}</label>
      <button
        className={`settings-toggle ${value ? "on" : ""}`}
        onClick={() => onChange(!value)}
        type="button"
      >
        <span className="settings-toggle-knob" />
      </button>
    </div>
  );
}

const EMPTY_NEW: Omit<GitHubAccount, "id"> = { label: "", username: "", token: "" };

export default function SettingsPage({ settings, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<AppSettings>({ ...settings });
  const [activeSection, setActiveSection] = useState<Section>("graph");
  const [accounts, setAccounts] = useState<GitHubAccount[]>([]);
  const [newAcc, setNewAcc] = useState<Omit<GitHubAccount, "id">>({ ...EMPTY_NEW });
  const [showToken, setShowToken] = useState<Record<string, boolean>>({});

  useEffect(() => { loadAccounts().then(setAccounts); }, []);

  const persistAccounts = (list: GitHubAccount[]) => {
    setAccounts(list);
    saveAccounts(list);
  };

  const addAccount = () => {
    if (!newAcc.username.trim() || !newAcc.token.trim()) return;
    persistAccounts([...accounts, { id: nanoid(), ...newAcc }]);
    setNewAcc({ ...EMPTY_NEW });
  };

  const removeAccount = (id: string) => persistAccounts(accounts.filter((a) => a.id !== id));

  const set = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleReset = () => {
    if (window.confirm("Reset all settings to defaults?")) {
      setDraft({ ...DEFAULT_SETTINGS });
    }
  };

  const handleSave = () => onSave(draft);

  return (
    <div className="settings-overlay">
      <div className="settings-modal">
        {/* Header */}
        <div className="settings-header">
          <span className="settings-title">Settings</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="settings-reset-btn" onClick={handleReset} title="Reset to defaults">
              <RotateCcw size={13} />
              Reset defaults
            </button>
            <button className="icon-btn" onClick={onClose} title="Close"><X size={14} /></button>
          </div>
        </div>

        <div className="settings-body">
          {/* Sidebar nav */}
          <nav className="settings-nav">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                className={`settings-nav-item ${activeSection === s.id ? "active" : ""}`}
                onClick={() => setActiveSection(s.id)}
              >
                {s.icon}
                {s.label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="settings-content">

            {/* ── Graph ─────────────────────────────────────── */}
            {activeSection === "graph" && (
              <div className="settings-section">
                <h3 className="settings-section-title">Graph</h3>

                <NumberRow label="Row height (px)" value={draft.graphRowHeight}
                  min={24} max={60} onChange={(v) => set("graphRowHeight", v)} />
                <NumberRow label="Lane width (px)" value={draft.graphLaneWidth}
                  min={12} max={36} onChange={(v) => set("graphLaneWidth", v)} />
                <NumberRow label="Font size (px)" value={draft.graphFontSize}
                  min={10} max={18} onChange={(v) => set("graphFontSize", v)} />
                <NumberRow label="Max commits to load" value={draft.graphMaxCommits}
                  min={50} max={5000} step={50} onChange={(v) => set("graphMaxCommits", v)} />

                <div className="settings-divider" />
                <h4 className="settings-sub-title">Visible columns</h4>
                <ToggleRow label="Author column" value={draft.showAuthorCol}
                  onChange={(v) => set("showAuthorCol", v)} />
                <ToggleRow label="Date column" value={draft.showDateCol}
                  onChange={(v) => set("showDateCol", v)} />
                <ToggleRow label="Hash column" value={draft.showHashCol}
                  onChange={(v) => set("showHashCol", v)} />
              </div>
            )}

            {/* ── Theme ─────────────────────────────────────── */}
            {activeSection === "theme" && (
              <div className="settings-section">
                <h3 className="settings-section-title">Theme</h3>

                <h4 className="settings-sub-title">Backgrounds</h4>
                <ColorRow label="Background (deepest)" value={draft.themeBg0}
                  onChange={(v) => set("themeBg0", v)} />
                <ColorRow label="Background" value={draft.themeBg1}
                  onChange={(v) => set("themeBg1", v)} />
                <ColorRow label="Background (raised)" value={draft.themeBg2}
                  onChange={(v) => set("themeBg2", v)} />
                <ColorRow label="Panel background" value={draft.themeBgPanel}
                  onChange={(v) => set("themeBgPanel", v)} />
                <ColorRow label="Border" value={draft.themeBorder}
                  onChange={(v) => set("themeBorder", v)} />

                <div className="settings-divider" />
                <h4 className="settings-sub-title">Accent</h4>
                <ColorRow label="Accent color" value={draft.themeAccent}
                  onChange={(v) => set("themeAccent", v)} />
                <ColorRow label="Accent hover" value={draft.themeAccentHover}
                  onChange={(v) => set("themeAccentHover", v)} />

                <div className="settings-divider" />
                <h4 className="settings-sub-title">Text</h4>
                <ColorRow label="Primary text" value={draft.themeTextPrimary}
                  onChange={(v) => set("themeTextPrimary", v)} />
                <ColorRow label="Secondary text" value={draft.themeTextSecondary}
                  onChange={(v) => set("themeTextSecondary", v)} />
                <ColorRow label="Muted text" value={draft.themeTextMuted}
                  onChange={(v) => set("themeTextMuted", v)} />

                <div className="settings-divider" />
                <h4 className="settings-sub-title">Status colors</h4>
                <ColorRow label="Green (added)" value={draft.themeGreen}
                  onChange={(v) => set("themeGreen", v)} />
                <ColorRow label="Red (deleted)" value={draft.themeRed}
                  onChange={(v) => set("themeRed", v)} />
                <ColorRow label="Yellow (modified)" value={draft.themeYellow}
                  onChange={(v) => set("themeYellow", v)} />

                {/* Live preview swatch strip */}
                <div className="settings-divider" />
                <h4 className="settings-sub-title">Preview</h4>
                <div className="theme-preview">
                  {[draft.themeBg0, draft.themeBg1, draft.themeBg2, draft.themeBgPanel,
                    draft.themeAccent, draft.themeAccentHover,
                    draft.themeGreen, draft.themeRed, draft.themeYellow].map((c, i) => (
                    <div key={i} className="theme-preview-swatch" style={{ background: c }} title={c} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Editor ────────────────────────────────────── */}
            {activeSection === "editor" && (
              <div className="settings-section">
                <h3 className="settings-section-title">Editor / Diff</h3>

                <NumberRow label="Diff font size (px)" value={draft.diffFontSize}
                  min={10} max={18} onChange={(v) => set("diffFontSize", v)} />

                <div className="settings-row" style={{ alignItems: "flex-start" }}>
                  <label className="settings-label" style={{ paddingTop: 6 }}>Monospace font</label>
                  <input
                    type="text"
                    className="settings-text-input"
                    value={draft.monoFont}
                    onChange={(e) => set("monoFont", e.target.value)}
                    style={{ flex: 1 }}
                    spellCheck={false}
                    placeholder='"Fira Code", Consolas, monospace'
                  />
                </div>
                <p className="settings-hint">
                  Comma-separated CSS font-family value. The first installed font will be used.
                </p>
              </div>
            )}

            {/* ── Custom CSS ────────────────────────────────── */}
            {activeSection === "css" && (
              <div className="settings-section">
                <h3 className="settings-section-title">Custom CSS</h3>
                <p className="settings-hint" style={{ marginBottom: 10 }}>
                  Injected after all theme variables. Overrides anything in the app.
                  Full CSS selector syntax supported.
                </p>
                <textarea
                  className="settings-css-editor"
                  value={draft.customCss}
                  onChange={(e) => set("customCss", e.target.value)}
                  spellCheck={false}
                  placeholder={`.commit-row { border-bottom: 1px solid var(--border); }\n\n/* Override any class or variable */`}
                />
              </div>
            )}

            {/* ── GitHub Accounts ───────────────────────────── */}
            {activeSection === "accounts" && (
              <div className="settings-section">
                <h3 className="settings-section-title">GitHub Accounts</h3>
                <p className="settings-hint" style={{ marginBottom: 12 }}>
                  Personal Access Tokens are used when pushing to GitHub. The matching
                  account is chosen by username; if none matches, the first is used.
                  Tokens are stored locally in localStorage.
                </p>

                {/* Saved accounts list */}
                {accounts.length === 0 ? (
                  <p className="settings-hint">No accounts added yet.</p>
                ) : (
                  <div className="gh-account-list">
                    {accounts.map((acc) => (
                      <div className="gh-account-row" key={acc.id}>
                        <div className="gh-account-info">
                          <span className="gh-account-username">
                            <Github size={12} />
                            {acc.username}
                          </span>
                          {acc.label && (
                            <span className="gh-account-label">{acc.label}</span>
                          )}
                        </div>
                        <div className="gh-account-token">
                          <span className="gh-token-value">
                            {showToken[acc.id]
                              ? acc.token
                              : acc.token.slice(0, 8) + "••••••••••••"}
                          </span>
                          <button
                            className="gh-token-toggle"
                            type="button"
                            onClick={() =>
                              setShowToken((prev) => ({
                                ...prev,
                                [acc.id]: !prev[acc.id],
                              }))
                            }
                          >
                            {showToken[acc.id] ? "Hide" : "Show"}
                          </button>
                        </div>
                        <button
                          className="gh-remove-btn"
                          type="button"
                          title="Remove account"
                          onClick={() => removeAccount(acc.id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add account form */}
                <div className="settings-divider" />
                <h4 className="settings-sub-title">Add account</h4>
                <div className="settings-row">
                  <label className="settings-label">Username</label>
                  <input
                    type="text"
                    className="settings-text-input"
                    placeholder="tijnndev"
                    value={newAcc.username}
                    onChange={(e) => setNewAcc((p) => ({ ...p, username: e.target.value }))}
                    autoComplete="off"
                  />
                </div>
                <div className="settings-row">
                  <label className="settings-label">Personal Access Token</label>
                  <input
                    type="password"
                    className="settings-text-input"
                    placeholder="ghp_…"
                    value={newAcc.token}
                    onChange={(e) => setNewAcc((p) => ({ ...p, token: e.target.value }))}
                    autoComplete="new-password"
                  />
                </div>
                <div className="settings-row">
                  <label className="settings-label">Label (optional)</label>
                  <input
                    type="text"
                    className="settings-text-input"
                    placeholder="work / personal / …"
                    value={newAcc.label}
                    onChange={(e) => setNewAcc((p) => ({ ...p, label: e.target.value }))}
                  />
                </div>
                <button
                  className="btn-primary"
                  style={{ alignSelf: "flex-start", marginTop: 4 }}
                  type="button"
                  onClick={addAccount}
                  disabled={!newAcc.username.trim() || !newAcc.token.trim()}
                >
                  <Plus size={13} />
                  Add account
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="settings-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Apply & Save</button>
        </div>
      </div>
    </div>
  );
}
