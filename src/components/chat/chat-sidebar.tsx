import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Building2, Check, ChevronRight, Folder, FolderInput, FolderMinus, FolderOpen, FolderPlus, Loader2, LogOut, MoreHorizontal, Pencil, Search, SquarePen, Trash2, X, type LucideIcon } from "lucide-react";

import { AiIcon } from "@/components/ai-icon";
import { BrandLogo } from "@/components/brand-logo";
import { aiIdsOf } from "@/lib/ais";
import { formatTokens } from "@/lib/plans";
import { cn } from "@/lib/utils";

export type ChatRow = { id: string; titulo: string; herramienta: string; updated_at: string; project_id: string | null };
export type ProjectRow = { id: string; nombre: string };

function groupLabel(iso: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.floor((today.getTime() - new Date(iso).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return "Últimos 7 días";
  if (days < 30) return "Últimos 30 días";
  return "Anteriores";
}

/** Fila editable (chat o proyecto): muestra el nombre o un input para renombrar. */
function Row({
  label,
  editing,
  onRename,
  onCancel,
  children,
}: {
  label: string;
  editing: boolean;
  onRename: (v: string) => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  const [draft, setDraft] = useState(label);
  useEffect(() => {
    if (editing) setDraft(label);
  }, [editing, label]);
  if (!editing) return <>{children}</>;
  const save = (e: FormEvent) => {
    e.preventDefault();
    const v = draft.trim().slice(0, 80);
    if (v && v !== label) onRename(v);
    else onCancel();
  };
  return (
    <form onSubmit={save} className="px-1">
      <input
        autoFocus
        value={draft}
        maxLength={80}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
        aria-label="Nuevo nombre"
        className="h-9 w-full rounded-lg border border-primary/60 bg-background px-2 text-sm outline-none"
      />
    </form>
  );
}

type MenuItem = { label: string; icon: LucideIcon; onSelect: () => void; danger?: boolean } | { group: string; items: { label: string; onSelect: () => void }[] };

/**
 * Botón "⋯" con las acciones de un chat o proyecto. El menú es fijo en pantalla para que no lo corte el scroll
 * de la lista. En pantallas táctiles el botón siempre se ve; con mouse aparece al pasar por la fila.
 */
function RowMenu({ label, items, alwaysVisible }: { label: string; items: MenuItem[]; alwaysVisible: boolean }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !btn.current || !menu.current) return;
    const r = btn.current.getBoundingClientRect();
    const h = menu.current.offsetHeight;
    const top = r.bottom + 4 + h > window.innerHeight - 8 ? Math.max(8, r.top - 4 - h) : r.bottom + 4;
    setPos({ top, left: Math.max(8, Math.min(r.right - 224, window.innerWidth - 232)) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    const hide = () => setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    window.addEventListener("resize", hide);
    document.addEventListener("scroll", hide, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
      window.removeEventListener("resize", hide);
      document.removeEventListener("scroll", hide, true);
    };
  }, [open]);

  const pick = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={() => { setPos(null); setOpen(!open); }}
        aria-label={`Opciones de ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "absolute right-1 top-1/2 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-opacity hover:bg-background/60 hover:text-foreground focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100",
          (open || alwaysVisible) && "md:opacity-100",
        )}
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </button>
      {open && (
        <div
          ref={menu}
          role="menu"
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
          className="fixed z-50 max-h-[60svh] w-56 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-2xl"
        >
          {items.map((it) =>
            "group" in it ? (
              <div key={it.group} className="border-y border-border/60 py-1">
                <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold text-muted-foreground">{it.group}</p>
                {it.items.map((sub) => (
                  <button key={sub.label} type="button" role="menuitem" onClick={pick(sub.onSelect)} className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-3 text-left text-sm hover:bg-secondary">
                    <Folder className="size-3.5 shrink-0 text-primary" aria-hidden /> <span className="truncate">{sub.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                onClick={pick(it.onSelect)}
                className={cn("flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 text-left text-sm hover:bg-secondary", it.danger && "text-[#FF8A6E]")}
              >
                <it.icon className="size-4 shrink-0" aria-hidden /> {it.label}
              </button>
            ),
          )}
        </div>
      )}
    </>
  );
}

export function ChatSidebar(props: {
  chats: ChatRow[];
  projects: ProjectRow[];
  activeId: string | undefined;
  plan: string;
  empresa: string;
  tokens: number;
  userName: string;
  userEmail: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, titulo: string) => void;
  onDelete: (id: string) => void;
  onCreateProject: (chatIds: string[]) => Promise<void>;
  onAddToProject: (projectId: string, chatIds: string[]) => Promise<void>;
  onRenameProject: (id: string, nombre: string) => void;
  onDeleteProject: (id: string) => void;
  onRemoveFromProject: (chatId: string) => void;
  onProfile: () => void;
  onLogout: () => void;
  onClose?: (() => void) | undefined;
}) {
  const { chats, projects, activeId } = props;
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null); // id de chat o "p:" + id de proyecto
  // Elegir chats: para un proyecto nuevo ("nuevo") o para agregarlos a uno existente (su id).
  const [selecting, setSelecting] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<string[]>([]);

  const q = query.trim().toLowerCase();
  const visible = (c: ChatRow) => !q || c.titulo.toLowerCase().includes(q);
  const target = selecting && selecting !== "nuevo" ? projects.find((p) => p.id === selecting) : null;

  const groups = useMemo(() => {
    const out: { label: string; items: ChatRow[] }[] = [];
    for (const c of chats) {
      if (selecting ? c.project_id === selecting : c.project_id) continue;
      if (!visible(c)) continue;
      const label = groupLabel(c.updated_at);
      const g = out.find((x) => x.label === label);
      if (g) g.items.push(c);
      else out.push({ label, items: [c] });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats, q, selecting]);

  function startSelecting(mode: string) {
    setSelected([]);
    setSelecting(mode);
  }

  async function confirmSelection() {
    if (!selected.length || !selecting) return;
    setCreating(true);
    if (selecting === "nuevo") await props.onCreateProject(selected);
    else {
      await props.onAddToProject(selecting, selected);
      setOpen((o) => (o.includes(selecting) ? o : [...o, selecting]));
    }
    setCreating(false);
    setSelecting(null);
    setSelected([]);
  }

  function chatItem(c: ChatRow, inProject: boolean) {
    if (selecting) {
      const on = selected.includes(c.id);
      const other = c.project_id ? projects.find((p) => p.id === c.project_id)?.nombre : null;
      return (
        <li key={c.id}>
          <button
            type="button"
            role="checkbox"
            aria-checked={on}
            onClick={() => setSelected((s) => (on ? s.filter((x) => x !== c.id) : [...s, c.id]))}
            className="flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 text-left text-sm hover:bg-secondary/70"
          >
            <span className={cn("flex size-4 shrink-0 items-center justify-center rounded border", on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/60")}>
              {on && <Check className="size-3" aria-hidden />}
            </span>
            <span className="truncate">{c.titulo}</span>
            {other && <span className="ml-auto shrink-0 truncate text-[11px] text-muted-foreground">en {other}</span>}
          </button>
        </li>
      );
    }
    const destinos = projects.filter((p) => p.id !== c.project_id);
    const items: MenuItem[] = [
      { label: "Renombrar", icon: Pencil, onSelect: () => setEditing(c.id) },
      ...(destinos.length ? [{ group: inProject ? "Mover a otro proyecto" : "Agregar a un proyecto", items: destinos.map((p) => ({ label: p.nombre, onSelect: () => void props.onAddToProject(p.id, [c.id]) })) }] : []),
      ...(inProject ? [{ label: "Sacar del proyecto", icon: FolderMinus, onSelect: () => props.onRemoveFromProject(c.id) }] : []),
      { label: "Eliminar chat", icon: Trash2, onSelect: () => props.onDelete(c.id), danger: true },
    ];
    const icon = aiIdsOf(c.herramienta)[0];
    return (
      <li key={c.id} className="group relative">
        <Row label={c.titulo} editing={editing === c.id} onRename={(v) => { props.onRename(c.id, v); setEditing(null); }} onCancel={() => setEditing(null)}>
          <button
            type="button"
            onClick={() => props.onSelect(c.id)}
            aria-current={c.id === activeId ? "page" : undefined}
            className={cn(
              "flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-3 pr-9 text-left text-sm transition-colors",
              inProject && "pl-8",
              c.id === activeId ? "bg-secondary text-foreground" : "text-foreground/85 hover:bg-secondary/70",
            )}
          >
            {icon && <AiIcon id={icon} boxed={false} />}
            <span className="truncate">{c.titulo}</span>
          </button>
          <RowMenu label={c.titulo} items={items} alwaysVisible={c.id === activeId} />
        </Row>
      </li>
    );
  }

  const initials = (props.userName || props.userEmail).slice(0, 2).toUpperCase();
  const projectChats = (id: string) => chats.filter((c) => c.project_id === id && visible(c));

  return (
    <nav aria-label="Chats" className="flex h-full w-72 flex-col bg-[var(--sidebar)] text-foreground">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <BrandLogo className="text-xl" />
        {props.onClose && (
          <button type="button" onClick={props.onClose} aria-label="Cerrar menú" className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden">
            <X className="size-5" aria-hidden />
          </button>
        )}
      </div>

      {selecting ? (
        <div className="mx-2 my-2 rounded-lg border border-primary/40 bg-primary/10 p-3">
          <p className="truncate text-sm font-semibold">{target ? `Agregar chats a “${target.nombre}”` : "Nuevo proyecto"}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {target ? "Elige los chats que quieres agregar. Si ya estaban en otro proyecto, se mueven a este." : "Elige los chats que quieres juntar. El nombre se propone solo y luego lo puedes cambiar."}
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => { setSelecting(null); setSelected([]); }} className="h-8 flex-1 cursor-pointer rounded-md text-sm text-muted-foreground hover:bg-secondary hover:text-foreground">Cancelar</button>
            <button
              type="button"
              disabled={!selected.length || creating}
              onClick={() => void confirmSelection()}
              className="flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : `${target ? "Agregar" : "Crear"} (${selected.length})`}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-1 px-2 py-2">
          <button type="button" onClick={props.onNew} className="flex h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-secondary">
            <SquarePen className="size-4" aria-hidden /> Nuevo chat
          </button>
          <button type="button" onClick={() => startSelecting("nuevo")} disabled={!chats.length} className="flex h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50">
            <FolderPlus className="size-4" aria-hidden /> Nuevo proyecto
          </button>
        </div>
      )}

      <label className="mx-2 flex h-10 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground focus-within:bg-secondary">
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="sr-only">Buscar chats</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar chats" className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground" />
      </label>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {!selecting && projects.length > 0 && (
          <div className="mt-4">
            <p className="px-3 pb-1 text-xs font-semibold text-muted-foreground">Proyectos</p>
            <ul>
              {projects.map((p) => {
                const isOpen = open.includes(p.id) || (!!q && projectChats(p.id).length > 0);
                const items = projectChats(p.id);
                const menu: MenuItem[] = [
                  { label: "Cambiar nombre", icon: Pencil, onSelect: () => setEditing(`p:${p.id}`) },
                  ...(chats.some((c) => c.project_id !== p.id) ? [{ label: "Agregar chats", icon: FolderInput, onSelect: () => startSelecting(p.id) }] : []),
                  { label: "Eliminar proyecto", icon: Trash2, onSelect: () => props.onDeleteProject(p.id), danger: true },
                ];
                return (
                  <li key={p.id}>
                    <div className="group relative">
                      <Row label={p.nombre} editing={editing === `p:${p.id}`} onRename={(v) => { props.onRenameProject(p.id, v); setEditing(null); }} onCancel={() => setEditing(null)}>
                        <button
                          type="button"
                          onClick={() => setOpen((o) => (o.includes(p.id) ? o.filter((x) => x !== p.id) : [...o, p.id]))}
                          aria-expanded={isOpen}
                          className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-3 pr-9 text-left text-sm font-medium text-foreground/90 hover:bg-secondary/70"
                        >
                          <ChevronRight className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-90")} aria-hidden />
                          {isOpen ? <FolderOpen className="size-4 shrink-0 text-primary" aria-hidden /> : <Folder className="size-4 shrink-0 text-primary" aria-hidden />}
                          <span className="truncate">{p.nombre}</span>
                        </button>
                        <RowMenu label={`el proyecto ${p.nombre}`} items={menu} alwaysVisible={false} />
                      </Row>
                    </div>
                    {isOpen && (
                      <ul>
                        {items.length ? (
                          items.map((c) => chatItem(c, true))
                        ) : (
                          <li className="py-1.5 pl-8 text-xs text-muted-foreground">
                            Sin chats ·{" "}
                            <button type="button" onClick={() => startSelecting(p.id)} className="cursor-pointer text-primary hover:underline">Agregar chats</button>
                          </li>
                        )}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {groups.length === 0 && (!projects.length || selecting) && <p className="px-3 py-4 text-sm text-muted-foreground">{q ? "Sin resultados." : selecting ? "No hay más chats para agregar." : "Tus chats aparecerán aquí."}</p>}
        {groups.map((g) => (
          <div key={g.label} className="mt-4">
            <p className="px-3 pb-1 text-xs font-semibold text-muted-foreground">{g.label}</p>
            <ul>{g.items.map((c) => chatItem(c, false))}</ul>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1 border-t border-border px-2 py-2">
        <button type="button" onClick={props.onProfile} title="Perfil, empresa y tu match" className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-secondary">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground" aria-hidden>{initials}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{props.userName || props.userEmail}</span>
            <span className="flex items-center gap-1 truncate text-xs text-muted-foreground"><Building2 className="size-3 shrink-0" aria-hidden /> <span className="truncate">{props.empresa}</span></span>
            <span className="mt-0.5 flex flex-wrap gap-1">
              <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[11px] font-semibold text-primary">Pack {props.plan}</span>
              {props.tokens > 0 && <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{formatTokens(props.tokens)} tokens</span>}
            </span>
          </span>
        </button>
        <button type="button" onClick={props.onLogout} aria-label="Cerrar sesión" title="Cerrar sesión" className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground">
          <LogOut className="size-4" aria-hidden />
        </button>
      </div>
    </nav>
  );
}
