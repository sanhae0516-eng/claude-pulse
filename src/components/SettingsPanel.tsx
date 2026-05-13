import { useEffect, useState } from "react";
import {
  type Settings,
  type Palette,
  COLOR_PRESETS,
  PALETTE_CHANNELS,
  type ColorScheme,
  SIZE_MIN,
  SIZE_MAX,
  SIZE_STEP,
} from "../lib/settings";
import { isValidHex, normalizeHex } from "../lib/color";
import { inTauri } from "../lib/tauri";
import "../styles/settings.css";

interface SettingsPanelProps {
  settings: Settings;
  onChange: (p: Partial<Settings>) => void;
  onClose: () => void;
}

export function SettingsPanel({ settings, onChange, onClose }: SettingsPanelProps) {
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [autostartReady, setAutostartReady] = useState(false);

  // Snapshot for Revert.
  const [snapshot] = useState(() => settings);
  const dirty = JSON.stringify(snapshot) !== JSON.stringify(settings);

  // Slider draft — committed on pointer release to keep the thumb under the cursor.
  const [draftSize, setDraftSize] = useState(settings.size);
  useEffect(() => setDraftSize(settings.size), [settings.size]);

  useEffect(() => {
    if (!inTauri()) {
      setAutostartReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("@tauri-apps/plugin-autostart");
        const enabled = await mod.isEnabled();
        if (!cancelled) {
          setAutostartEnabled(enabled);
          setAutostartReady(true);
        }
      } catch {
        if (!cancelled) setAutostartReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleAutostart = async () => {
    if (!inTauri()) {
      setAutostartEnabled((v) => !v);
      return;
    }
    try {
      const mod = await import("@tauri-apps/plugin-autostart");
      if (autostartEnabled) await mod.disable();
      else await mod.enable();
      setAutostartEnabled(!autostartEnabled);
    } catch (e) {
      console.error(e);
    }
  };

  const quit = async () => {
    if (!inTauri()) {
      onClose();
      return;
    }
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("quit_app");
    } catch (e) {
      console.error(e);
    }
  };

  const commitSize = () => {
    if (draftSize !== settings.size) onChange({ size: draftSize });
  };

  const updateChannel = (key: keyof Palette, hex: string) =>
    onChange({
      colorScheme: "custom",
      customPalette: { ...settings.customPalette, [key]: hex },
    });

  const copyPresetToCustom = () =>
    onChange({
      colorScheme: "custom",
      customPalette: { ...COLOR_PRESETS[
        settings.colorScheme === "custom" ? "mint" : settings.colorScheme
      ] },
    });

  const revert = () => {
    onChange(snapshot);
    onClose();
  };

  return (
    <div className="settings-panel" data-tauri-drag-region>
      <div className="settings-header" data-tauri-drag-region>
        <span className="settings-title">SETTINGS</span>
        <button
          className="settings-close"
          onClick={onClose}
          aria-label="close settings"
        >
          ✕
        </button>
      </div>

      <div className="settings-body">
        <Section label="Size">
          <input
            type="range"
            min={SIZE_MIN}
            max={SIZE_MAX}
            step={SIZE_STEP}
            value={draftSize}
            onChange={(e) => setDraftSize(Number(e.target.value))}
            onPointerUp={commitSize}
            onKeyUp={commitSize}
            onBlur={commitSize}
            className="settings-slider"
          />
          <span className="settings-value mono">{draftSize}</span>
        </Section>

        <Section label="Opacity">
          <input
            type="range"
            min={50}
            max={100}
            step={5}
            value={Math.round(settings.opacity * 100)}
            onChange={(e) => onChange({ opacity: Number(e.target.value) / 100 })}
            className="settings-slider"
          />
          <span className="settings-value mono">{Math.round(settings.opacity * 100)}%</span>
        </Section>

        <Section label="Show">
          <label className="settings-check">
            <input
              type="checkbox"
              checked={settings.showCharacter}
              onChange={(e) => onChange({ showCharacter: e.target.checked })}
            />
            <span>Claw'd</span>
          </label>
          <label className="settings-check">
            <input
              type="checkbox"
              checked={settings.showWeek}
              onChange={(e) => onChange({ showWeek: e.target.checked })}
            />
            <span>weekly</span>
          </label>
        </Section>

        <Section label="Color · Presets">
          <div className="settings-colors">
            {(Object.keys(COLOR_PRESETS) as Exclude<ColorScheme, "custom">[]).map((key) => (
              <button
                key={key}
                className={`settings-color ${settings.colorScheme === key ? "active" : ""}`}
                onClick={() => onChange({ colorScheme: key })}
                aria-label={key}
              >
                <span style={{ background: COLOR_PRESETS[key].usageRing }} />
                <span style={{ background: COLOR_PRESETS[key].timeRing }} />
                <span style={{ background: COLOR_PRESETS[key].number }} />
              </button>
            ))}
          </div>
        </Section>

        <div className="settings-section">
          <div className="settings-label settings-custom-header">
            <span>Color · Custom</span>
            <button
              className="settings-mini-btn"
              onClick={copyPresetToCustom}
              title="Copy current preset values into custom"
            >
              Copy preset
            </button>
          </div>
          <div className="settings-palette-grid">
            {PALETTE_CHANNELS.map(({ key, label, hint }) => (
              <ChannelRow
                key={key}
                label={label}
                hint={hint}
                hex={settings.customPalette[key]}
                onChange={(hex) => updateChannel(key, hex)}
              />
            ))}
          </div>
        </div>

        <div className="settings-divider" />

        <label className="settings-row">
          <span>Lock position</span>
          <Toggle
            checked={settings.locked}
            onChange={(v) => onChange({ locked: v })}
          />
        </label>

        <label className="settings-row">
          <span>Start with system</span>
          <Toggle
            checked={autostartEnabled}
            onChange={toggleAutostart}
            disabled={!autostartReady}
          />
        </label>

        <button className="settings-quit" onClick={quit}>
          Quit
        </button>
      </div>

      <div className="settings-footer">
        <button
          className="settings-btn settings-btn-secondary"
          onClick={revert}
          disabled={!dirty}
          title={dirty ? "Discard changes since opening" : "No changes to revert"}
        >
          Revert
        </button>
        <button
          className="settings-btn settings-btn-primary"
          onClick={onClose}
        >
          Save
        </button>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="settings-section">
      <div className="settings-label">{label}</div>
      <div className="settings-control">{children}</div>
    </div>
  );
}

function ChannelRow({
  label,
  hint,
  hex,
  onChange,
}: {
  label: string;
  hint: string;
  hex: string;
  onChange: (hex: string) => void;
}) {
  const [draft, setDraft] = useState(hex);
  useEffect(() => setDraft(hex), [hex]);

  const commit = () => {
    if (isValidHex(draft)) onChange(normalizeHex(draft));
    else setDraft(hex);
  };

  return (
    <div className="settings-channel-row" title={hint}>
      <div className="settings-channel-meta">
        <span className="settings-channel-label">{label}</span>
        <span className="settings-channel-hint">{hint}</span>
      </div>
      <label className="settings-color settings-color-custom">
        <span style={{ background: hex }} />
        <svg
          className="settings-color-pick-icon"
          viewBox="0 0 12 12"
          width="10"
          height="10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 1.5l1.5 1.5L4.5 9l-2 .5.5-2 6-6z" />
        </svg>
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      <input
        type="text"
        className="settings-hex-input mono"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          else if (e.key === "Escape") setDraft(hex);
        }}
        maxLength={7}
        spellCheck={false}
      />
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`settings-toggle ${checked ? "on" : "off"}`}
    >
      <span className="settings-toggle-knob" />
    </button>
  );
}
