import { Minus, Square, X } from "lucide-react";
import monkeyIcon from "../assets/monkey.png";

/**
 * Frameless-window chrome. The whole bar is a drag region; interactive
 * children opt out via `no-drag`. macOS keeps its native traffic lights
 * (titleBarStyle: hiddenInset), so custom controls render elsewhere only.
 */
export function Titlebar() {
  const isMac = window.monkeyplay.system.platform === "darwin";

  return (
    <header className={`titlebar ${isMac ? "titlebar-mac" : ""}`}>
      <div className="titlebar-brand">
        <img src={monkeyIcon} alt="" />
        <span>MONKEYPLAY</span>
      </div>
      {!isMac ? (
        <div className="titlebar-controls no-drag">
          <button type="button" aria-label="Minimize" onClick={() => void window.monkeyplay.window.minimize()}>
            <Minus size={14} />
          </button>
          <button type="button" aria-label="Maximize" onClick={() => void window.monkeyplay.window.toggleMaximize()}>
            <Square size={12} />
          </button>
          <button type="button" className="control-close" aria-label="Close" onClick={() => void window.monkeyplay.window.close()}>
            <X size={14} />
          </button>
        </div>
      ) : null}
    </header>
  );
}
