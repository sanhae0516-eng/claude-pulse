import { useEffect } from "react";
import { Widget } from "./components/Widget";
import { inTauri } from "./lib/tauri";
import "./styles/widget.css";

export default function App() {
  useEffect(() => {
    if (inTauri()) document.body.classList.add("tauri");
  }, []);

  return <Widget />;
}
