import { Home, HardDrive, Newspaper, PackageSearch, Settings, ShieldCheck } from "lucide-react";
import type { Page } from "../App";

interface SidebarProps {
  page: Page;
  onNavigate: (page: Page) => void;
}

const items: Array<{ page: Page; label: string; icon: typeof Home }> = [
  { page: "home", label: "Home", icon: Home },
  { page: "instances", label: "Instances", icon: HardDrive },
  { page: "mods", label: "Mods", icon: PackageSearch },
  { page: "news", label: "News", icon: Newspaper },
  { page: "settings", label: "Settings", icon: Settings }
];

export function Sidebar({ page, onNavigate }: SidebarProps) {
  return (
    <nav className="sidebar" aria-label="Primary">
      {items.map(({ page: target, label, icon: Icon }) => (
        <button
          key={target}
          type="button"
          className={`side-item ${page === target ? "side-item-active" : ""}`}
          onClick={() => onNavigate(target)}
          aria-current={page === target ? "page" : undefined}
        >
          <Icon size={20} />
          <span>{label}</span>
        </button>
      ))}
      <div className="side-foot" title="Fair-play client. Vanilla-equivalent hitboxes only — no cheat modules.">
        <ShieldCheck size={18} />
        <span>Fair play</span>
      </div>
    </nav>
  );
}
