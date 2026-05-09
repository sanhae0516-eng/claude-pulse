import { useEffect, useState } from "react";
import {
  type Settings,
  COLOR_PRESETS,
  type ColorScheme,
  SIZE_MIN,
  SIZE_MAX,
  SIZE_STEP,
} from "../lib/settings";
import { inTauri } from "../lib/tauri";

interface SettingsPanelProps {
  settings: Settings;
  onChange: (p: Partial<Settings>) => void;
  onClose: () => void;
}

export function SettingsPanel({ settings, onChange, onClose }: SettingsPanelProps) {
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [autostartReady, setAutostartReady] = useState(false);

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
            value={settings.size}
            onChange={(e) => onChange({ size: Number(e.target.value) })}
            className="settings-slider"
          />
          <span className="settings-value mono">{settings.size}</span>
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

        <Section label="Color">
          <div className="settings-colors">
            {(Object.keys(COLOR_PRESETS) as ColorScheme[]).map((key) => (
              <button
                key={key}
                className={`settings-color ${settings.colorScheme === key ? "active" : ""}`}
                onClick={() => onChange({ colorScheme: key })}
                aria-label={key}
              >
                <span style={{ background: COLOR_PRESETS[key].low }} />
                <span style={{ background: COLOR_PRESETS[key].mid }} />
                <span style={{ background: COLOR_PRESETS[key].high }} />
              </button>
            ))}
          </div>
        </Section>

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
