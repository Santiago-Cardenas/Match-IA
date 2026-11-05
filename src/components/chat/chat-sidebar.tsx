import { useMemo, useState, type FormEvent } from "react";
import { ListChecks, LogOut, Pencil, Search, SquarePen, Trash2, X } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

export type ChatRow = { id: string; titulo: string; herramienta: string; updated_at: string };

function groupLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.floor((today.getTime() - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return "Últimos 7 días";
  if (days < 30) return "Últimos 30 días";
  return "Anteriores";
}

export function ChatSidebar({
  chats,
  activeId,
  userName,
  userEmail,
  onSelect,
  onNew,
  onRename,
  onDelete,
  onTest,
  onLogout,
  onClose,
}: {
  chats: ChatRow[];
  activeId: string | undefined;
  userName: string;
  userEmail: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, titulo: string) => void;
  onDelete: (id: string) => void;
  onTest: () => void;
  onLogout: () => void;
  onClose?: (() => void) | undefined;
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: { label: string; items: ChatRow[] }[] = [];
    for (const c of chats) {
      if (q && !c.titulo.toLowerCase().includes(q)) continue;
      const label = groupLabel(c.updated_at);
      const g = out.find((x) => x.label === label);
      if (g) g.items.push(c);
      else out.push({ label, items: [c] });
    }
    return out;
  }, [chats, query]);

  function saveRename(e: FormEvent, id: string) {
    e.preventDefault();
    const titulo = draft.trim().slice(0, 80);
    if (titulo) onRename(id, titulo);
    setEditing(null);
  }

  const initials = (userName || userEmail).slice(0, 2).toUpperCase();

  return (
    <nav aria-label="Chats" className="flex h-full w-72 flex-col bg-[var(--sidebar)] text-foreground">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <BrandLogo className="text-xl" />
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Cerrar menú" className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden">
            <X className="size-5" aria-hidden />
          </button>
        )}
      </div>

      <div className="grid gap-1 px-2 py-2">
        <button type="button" onClick={onNew} className="flex h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-secondary">
          <SquarePen className="size-4" aria-hidden /> Nuevo chat
        </button>
        <button type="button" onClick={onTest} className="flex h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-secondary">
          <ListChecks className="size-4" aria-hidden /> Encuentra tu IA ideal
        </button>
        <label className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground focus-within:bg-secondary">
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="sr-only">Buscar chats</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar chats" className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground" />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {groups.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">{query ? "Sin resultados." : "Tus chats aparecerán aquí."}</p>}
        {groups.map((g) => (
          <div key={g.label} className="mt-4">
            <p className="px-3 pb-1 text-xs font-semibold text-muted-foreground">{g.label}</p>
            <ul>
              {g.items.map((c) => (
                <li key={c.id} className="group relative">
                  {editing === c.id ? (
                    <form onSubmit={(e) => saveRename(e, c.id)} className="px-1">
                      <input
                        autoFocus
                        value={draft}
                        maxLength={80}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={(e) => saveRename(e, c.id)}
                        onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
                        aria-label="Nuevo nombre del chat"
                        className="h-9 w-full rounded-lg border border-primary/60 bg-background px-2 text-sm outline-none"
                      />
                    </form>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onSelect(c.id)}
                        aria-current={c.id === activeId ? "page" : undefined}
                        className={cn(
                          "flex h-9 w-full cursor-pointer items-center rounded-lg px-3 pr-16 text-left text-sm transition-colors",
                          c.id === activeId ? "bg-secondary text-foreground" : "text-foreground/85 hover:bg-secondary/70",
                        )}
                      >
                        <span className="truncate">{c.titulo}</span>
                      </button>
                      <span className={cn("absolute right-1 top-1/2 flex -translate-y-1/2 gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100", c.id === activeId && "opacity-100")}>
                        <button type="button" onClick={() => { setDraft(c.titulo); setEditing(c.id); }} aria-label={`Renombrar ${c.titulo}`} className="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-background/60 hover:text-foreground">
                          <Pencil className="size-3.5" aria-hidden />
                        </button>
                        <button type="button" onClick={() => onDelete(c.id)} aria-label={`Eliminar ${c.titulo}`} className="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-background/60 hover:text-[#FF8A6E]">
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 border-t border-border px-3 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground" aria-hidden>{initials}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{userName || userEmail}</span>
          {userName && <span className="block truncate text-xs text-muted-foreground">{userEmail}</span>}
        </span>
        <button type="button" onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión" className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground">
          <LogOut className="size-4" aria-hidden />
        </button>
      </div>
    </nav>
  );
}
