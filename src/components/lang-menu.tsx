import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

/**
 * Small globe button that opens the language list: native script with the
 * English name under it, current one ticked. Closes on outside click, Escape
 * or a pick; arrow keys move through the list. Keys pressed inside it never
 * reach the game (see the `.lang-menu` guard in the key handler).
 */
export function LangMenu<L extends string>({
  lang,
  langs,
  native,
  english,
  label,
  onPick,
  className = "",
}: {
  lang: L;
  langs: readonly L[];
  native: Record<L, string>;
  english: Record<L, string>;
  label: string;
  onPick: (next: L) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const focusList = useRef(false);
  const id = useId();
  const options = () => Array.from(list.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);

  useEffect(() => {
    if (!open) return;
    if (focusList.current) {
      focusList.current = false;
      const all = options();
      (all.find((el) => el.getAttribute("aria-pressed") === "true") ?? all[0])?.focus();
    }
    const outside = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [open]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      if (!open) return;
      event.preventDefault();
      setOpen(false);
      button.current?.focus();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        focusList.current = true;
        setOpen(true);
      }
      return;
    }
    const all = options();
    const i = all.indexOf(document.activeElement as HTMLButtonElement);
    const n =
      event.key === "Home" ? 0
      : event.key === "End" ? all.length - 1
      : event.key === "ArrowDown" ? (i + 1) % all.length
      : i <= 0 ? all.length - 1 : i - 1;
    all[n]?.focus();
  };

  return (
    <div
      ref={root}
      className={`lang-menu ${open ? "is-open" : ""} ${className}`}
      onKeyDown={onKeyDown}
      onKeyUp={(event) => event.stopPropagation()}
      onBlur={(event) => {
        if (open && event.relatedTarget && !root.current?.contains(event.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        ref={button}
        type="button"
        className="lang-menu-btn"
        aria-label={label}
        title={label}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={id}
        onClick={(event) => {
          focusList.current = event.detail === 0;
          setOpen((value) => !value);
        }}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
          <g fill="none" stroke="currentColor" strokeWidth="1.7">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9M12 3C9.5 5.6 8.2 8.6 8.2 12s1.3 6.4 3.8 9" />
          </g>
        </svg>
      </button>
      <div ref={list} id={id} className="lang-menu-list" role="group" aria-label={label} hidden={!open}>
        {langs.map((code) => (
          <button
            key={code}
            type="button"
            lang={code}
            className="lang-menu-item"
            aria-pressed={code === lang}
            onClick={() => {
              setOpen(false);
              button.current?.focus();
              if (code !== lang) onPick(code);
            }}
          >
            <b>{native[code]}</b>
            {english[code] !== native[code] ? <small lang="en">{english[code]}</small> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
