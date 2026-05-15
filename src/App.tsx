import { useEffect } from "react";
import { Widget } from "./components/Widget";
import { MusicWindow } from "./components/MusicWindow";
import { inTauri } from "./lib/tauri";
import "./styles/widget.css";
import "./styles/music.css";

/** Read the `?window=...` URL param at module load. The second Tauri window
 *  (label="music") opens with `?window=music`, so we mount a different root
 *  component for it. */
const params = new URLSearchParams(window.location.search);
const windowKind = params.get("window") ?? "main";

export default function App() {
  useEffect(() => {
    if (inTauri()) document.body.classList.add("tauri");
    document.body.classList.add(`window-${windowKind}`);
  }, []);

  if (windowKind === "music") {
    return <MusicWindow />;
  }
  return <Widget />;
}
