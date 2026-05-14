import { useEffect, useState } from "react";
import {
  type Settings,
  type Palette,
  COLOR_PRESETS,
  PALETTE_CHANNELS,
  type ColorScheme,
  DEFAULTS,
  SIZE_MIN,
  SIZE_MAX,
  SIZE_STEP,
} from "../lib/settings";
import { isValidHex, normalizeHex } from "../lib/color";
import { inTauri } from "../lib/tauri";
import { sound, setSoundsEnabled, tick, voice } from "../lib/sound";
import "../styles/settings.css";

interface SettingsPanelProps {
  settings: Settings;
  onChange: (p: Partial<Settings>) => void;
  onClose: () => void;
}

type SettingsTab = "display" | "custom" | "sound" | "system";

const TABS: ReadonlyArray<{ id: SettingsTab; label: string }> = [
  { id: "display", label: "Display" },
  { id: "custom",  label: "Custom" },
  { id: "sound",   label: "Sound" },
  { id: "system",  label: "System" },
];

export function SettingsPanel({ settings, onChange, onClose }: SettingsPanelProps) {
  const [tab, setTab] = useState<SettingsTab>("display");
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
    (autostartEnabled ? sound.toggleOff : sound.toggleOn)();
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
    sound.warn();
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
    // No click on commit — the drag tick stream already gave audible feedback.
    if (draftSize !== settings.size) onChange({ size: draftSize });
  };

  const updateChannel = (key: keyof Palette, hex: string) => {
    sound.select();
    onChange({
      colorScheme: "custom",
      customPalette: { ...settings.customPalette, [key]: hex },
    });
  };

  /** Selecting a preset also seeds the custom palette with its colors,
   *  so the channel rows below show the preset's values and the user can
   *  tweak from there. Editing any channel afterwards flips colorScheme
   *  back to "custom" automatically. */
  const selectPreset = (key: Exclude<ColorScheme, "custom">) => {
    sound.select();
    onChange({ colorScheme: key, customPalette: { ...COLOR_PRESETS[key] } });
  };

  const revert = () => {
    sound.warn();
    onChange(snapshot);
    onClose();
  };

  const resetToDefaults = () => {
    sound.warn();
    // Replace every field with its factory default. The snapshot is left
    // alone, so Revert can still bring back what was loaded when the panel
    // opened (if the user resets by mistake).
    onChange(DEFAULTS);
  };

  const done = () => {
    sound.confirm();
    onClose();
  };

  const closeSilent = () => {
    sound.click();
    onClose();
  };

  return (
    <div className="settings-panel" data-tauri-drag-region>
      <div className="settings-header" data-tauri-drag-region>
        <span className="settings-title">SETTINGS</span>
        <button
          className="settings-close"
          onClick={closeSilent}
          aria-label="close settings"
        >
          ✕
        </button>
      </div>

      <div className="settings-tabs" role="tablist">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={`settings-tab ${tab === id ? "active" : ""}`}
            onClick={() => {
              if (tab !== id) sound.select();
              setTab(id);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="settings-body">
        {tab === "display" && (
          <>
            <Section label="Size">
              <input
                type="range"
                min={SIZE_MIN}
                max={SIZE_MAX}
                step={SIZE_STEP}
                value={draftSize}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setDraftSize(v);
                  tick(v, SIZE_MIN, SIZE_MAX);
                }}
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
                onChange={(e) => {
                  const v = Number(e.target.value);
                  tick(v, 50, 100);
                  onChange({ opacity: v / 100 });
                }}
                className="settings-slider"
              />
              <span className="settings-value mono">{Math.round(settings.opacity * 100)}%</span>
            </Section>

            <Section label="Show">
              <label className="settings-check">
                <input
                  type="checkbox"
                  checked={settings.showCharacter}
                  onChange={(e) => {
                    (e.target.checked ? sound.toggleOn : sound.toggleOff)();
                    onChange({ showCharacter: e.target.checked });
                  }}
                />
                <span>Claw'd</span>
              </label>
              <label className="settings-check">
                <input
                  type="checkbox"
                  checked={settings.showWeek}
                  onChange={(e) => {
                    (e.target.checked ? sound.toggleOn : sound.toggleOff)();
                    onChange({ showWeek: e.target.checked });
                  }}
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
                    onClick={() => selectPreset(key)}
                    aria-label={key}
                    title={`Apply ${key} preset (also seeds the Custom tab)`}
                  >
                    <span style={{ background: COLOR_PRESETS[key].usageRing }} />
                    <span style={{ background: COLOR_PRESETS[key].timeRing }} />
                    <span style={{ background: COLOR_PRESETS[key].number }} />
                  </button>
                ))}
              </div>
            </Section>
          </>
        )}

        {tab === "custom" && (
          <Section label="Color · Custom">
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
          </Section>
        )}

        {tab === "sound" && (
          <>
            <label className="settings-row">
              <span>UI sounds</span>
              <Toggle
                checked={settings.soundsEnabled}
                onChange={(v) => {
                  // Play the toggle's own sound BEFORE we disable the system,
                  // otherwise turning sounds off makes no audible feedback.
                  if (v) {
                    setSoundsEnabled(true);
                    sound.toggleOn();
                  } else {
                    sound.toggleOff();
                    setSoundsEnabled(false);
                  }
                  onChange({ soundsEnabled: v });
                }}
              />
            </label>

            <label className="settings-row">
              <span>Claw'd voice</span>
              <Toggle
                checked={settings.voiceEnabled}
                onChange={(v) => {
                  (v ? sound.toggleOn : sound.toggleOff)();
                  onChange({ voiceEnabled: v });
                }}
              />
            </label>

            {settings.voiceEnabled && (
              <Section label="Voice volume">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round(settings.voiceVolume * 100)}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    onChange({ voiceVolume: v / 100 });
                    // Live audible preview at the new volume.
                    voice("가");
                  }}
                  className="settings-slider"
                />
                <span className="settings-value mono">
                  {Math.round(settings.voiceVolume * 100)}%
                </span>
              </Section>
            )}
          </>
        )}

        {tab === "system" && (
          <>
            <label className="settings-row">
              <span>Lock position</span>
              <Toggle
                checked={settings.locked}
                onChange={(v) => {
                  (v ? sound.toggleOn : sound.toggleOff)();
                  onChange({ locked: v });
                }}
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

            <button
              className="settings-reset"
              onClick={resetToDefaults}
              title="Restore every setting to factory defaults"
            >
              Reset to defaults
            </button>
          </>
        )}
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
          onClick={done}
        >
          Done
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
