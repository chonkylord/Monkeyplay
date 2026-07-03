import type { AccountProfile } from "@shared/types";
import { ChevronDown, KeyRound, LogIn, Trash2, UserPlus } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

interface AccountMenuProps {
  accounts: AccountProfile[];
  busy: boolean;
  onSetActive: (accountId: string) => void;
  onDelete: (accountId: string) => void;
  onCreateOffline: (username: string) => void;
  onSignInMicrosoft: () => void;
}

export function Avatar({ account, size = 32 }: { account?: AccountProfile; size?: number }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [account?.uuid]);
  if (!account || broken) {
    return (
      <span className="avatar avatar-fallback" style={{ width: size, height: size }}>
        {(account?.username ?? "?").slice(0, 1).toUpperCase()}
      </span>
    );
  }
  // mc-heads falls back to the default Steve head for unknown (offline) UUIDs.
  return (
    <img
      className="avatar"
      style={{ width: size, height: size }}
      src={`https://mc-heads.net/avatar/${account.type === "microsoft" ? account.uuid : account.username}/${size * 2}`}
      alt=""
      onError={() => setBroken(true)}
    />
  );
}

export function AccountMenu({ accounts, busy, onSetActive, onDelete, onCreateOffline, onSignInMicrosoft }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const [offlineName, setOfflineName] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const active = accounts.find((account) => account.active);

  useEffect(() => {
    function onPointerDown(event: PointerEvent): void {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function handleOffline(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (offlineName.trim()) {
      onCreateOffline(offlineName.trim());
      setOfflineName("");
    }
  }

  return (
    <div className="account-menu" ref={menuRef} id="accounts">
      <button type="button" className="account-chip no-drag" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <Avatar account={active} />
        <span className="account-chip-name">
          <strong>{active?.username ?? "No account"}</strong>
          <small>{active ? (active.type === "microsoft" ? "Microsoft" : "Offline") : "Add one"}</small>
        </span>
        <ChevronDown size={16} />
      </button>

      {open ? (
        <div className="account-dropdown">
          {accounts.map((account) => (
            <div key={account.id} className={`account-row ${account.active ? "account-row-active" : ""}`}>
              <button
                type="button"
                className="account-pick"
                disabled={busy || account.active}
                onClick={() => onSetActive(account.id)}
              >
                <Avatar account={account} size={28} />
                <span>
                  <strong>{account.username}</strong>
                  <small>{account.type === "microsoft" ? "Microsoft" : "Offline"}</small>
                </span>
              </button>
              <button
                type="button"
                className="icon-button danger"
                aria-label={`Remove ${account.username}`}
                disabled={busy}
                onClick={() => onDelete(account.id)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          <button type="button" className="ms-signin" disabled={busy} onClick={onSignInMicrosoft}>
            <LogIn size={15} />
            Sign in with Microsoft
          </button>

          <form className="offline-form" onSubmit={handleOffline}>
            <KeyRound size={15} />
            <input
              aria-label="Offline username"
              placeholder="Offline username"
              value={offlineName}
              maxLength={16}
              onChange={(event) => setOfflineName(event.target.value)}
            />
            <button type="submit" className="icon-button" aria-label="Add offline account" disabled={busy || !offlineName.trim()}>
              <UserPlus size={15} />
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
