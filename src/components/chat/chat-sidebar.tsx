import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Building2, Check, ChevronRight, Folder, FolderMinus, FolderOpen, FolderPlus, Loader2, LogOut, Pencil, Search, SquarePen, Trash2, X } from "lucide-react";

import { AiIcon } from "@/components/ai-icon";
import { BrandLogo } from "@/components/brand-logo";
import { toAiId } from "@/lib/ais";
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

const iconBtn = "flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-background/60 hover:text-foreground";

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
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<string[]>([]);

  const q = query.trim().toLowerCase();
  const visible = (c: ChatRow) => !q || c.titulo.toLowerCase().includes(q);

  const groups = useMemo(() => {
    const out: { label: string; items: ChatRow[] }[] = [];
    for (const c of chats) {
      if ((!selecting && c.project_id) || !visible(c)) continue;
      const label = groupLabel(c.updated_at);
      const g = out.find((x) => x.label === label);
      if (g) g.items.push(c);
      else out.push({ label, items: [c] });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats, q, selecting]);

  async function createProject() {
    if (!selected.length) return;
    setCreating(true);
    await props.onCreateProject(selected);
    setCreating(false);
    setSelecting(false);
    setSelected([]);
  }

  function chatItem(c: ChatRow, inProject: boolean) {
    if (selecting) {
      const on = selected.includes(c.id);
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
          </button>
        </li>
      );
    }
    return (
      <li key={c.id} className="group relative">
        <Row label={c.titulo} editing={editing === c.id} onRename={(v) => { props.onRename(c.id, v); setEditing(null); }} onCancel={() => setEditing(null)}>
          <button
            type="button"
            onClick={() => props.onSelect(c.id)}
            aria-current={c.id === activeId ? "page" : undefined}
            className={cn(
              "flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-3 pr-[5.5rem] text-left text-sm transition-colors",
              inProject && "pl-8",
              c.id === activeId ? "bg-secondary text-foreground" : "text-foreground/85 hover:bg-secondary/70",
            )}
          >
            {toAiId(c.herramienta) && <AiIcon id={toAiId(c.herramienta)!} boxed={false} />}
            <span className="truncate">{c.titulo}</span>
          </button>
          <span className={cn("absolute right-1 top-1/2 flex -translate-y-1/2 gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100", c.id === activeId && "opacity-100")}>
            <button type="button" onClick={() => setEditing(c.id)} aria-label={`Renombrar ${c.titulo}`} className={iconBtn}><Pencil className="size-3.5" aria-hidden /></button>
            {inProject && (
              <button type="button" onClick={() => props.onRemoveFromProject(c.id)} aria-label={`Sacar ${c.titulo} del proyecto`} title="Sacar del proyecto" className={iconBtn}><FolderMinus className="size-3.5" aria-hidden /></button>
            )}
            <button type="button" onClick={() => props.onDelete(c.id)} aria-label={`Eliminar ${c.titulo}`} className={cn(iconBtn, "hover:text-[#FF8A6E]")}><Trash2 className="size-3.5" aria-hidden /></button>
          </span>
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
          <p className="text-sm font-semibold">Nuevo proyecto</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Elige los chats que quieres juntar. El nombre se propone solo y luego lo puedes cambiar.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => { setSelecting(false); setSelected([]); }} className="h-8 flex-1 cursor-pointer rounded-md text-sm text-muted-foreground hover:bg-secondary hover:text-foreground">Cancelar</button>
            <button
              type="button"
              disabled={!selected.length || creating}
              onClick={() => void createProject()}
              className="flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : `Crear (${selected.length})`}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-1 px-2 py-2">
          <button type="button" onClick={props.onNew} className="flex h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-secondary">
            <SquarePen className="size-4" aria-hidden /> Nuevo chat
          </button>
          <button type="button" onClick={() => setSelecting(true)} disabled={!chats.length} className="flex h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50">
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
                return (
                  <li key={p.id}>
                    <div className="group relative">
                      <Row label={p.nombre} editing={editing === `p:${p.id}`} onRename={(v) => { props.onRenameProject(p.id, v); setEditing(null); }} onCancel={() => setEditing(null)}>
                        <button
                          type="button"
                          onClick={() => setOpen((o) => (o.includes(p.id) ? o.filter((x) => x !== p.id) : [...o, p.id]))}
                          aria-expanded={isOpen}
                          className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg px-3 pr-16 text-left text-sm font-medium text-foreground/90 hover:bg-secondary/70"
                        >
                          <ChevronRight className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-90")} aria-hidden />
                          {isOpen ? <FolderOpen className="size-4 shrink-0 text-primary" aria-hidden /> : <Folder className="size-4 shrink-0 text-primary" aria-hidden />}
                          <span className="truncate">{p.nombre}</span>
                        </button>
                        <span className="absolute right-1 top-1/2 flex -translate-y-1/2 gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                          <button type="button" onClick={() => setEditing(`p:${p.id}`)} aria-label={`Renombrar proyecto ${p.nombre}`} className={iconBtn}><Pencil className="size-3.5" aria-hidden /></button>
                          <button type="button" onClick={() => props.onDeleteProject(p.id)} aria-label={`Eliminar proyecto ${p.nombre}`} className={cn(iconBtn, "hover:text-[#FF8A6E]")}><Trash2 className="size-3.5" aria-hidden /></button>
                        </span>
                      </Row>
                    </div>
                    {isOpen && (
                      <ul>
                        {items.length ? items.map((c) => chatItem(c, true)) : <li className="py-1.5 pl-8 text-xs text-muted-foreground">Sin chats</li>}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {groups.length === 0 && !projects.length && <p className="px-3 py-4 text-sm text-muted-foreground">{q ? "Sin resultados." : "Tus chats aparecerán aquí."}</p>}
        {groups.map((g) => (
          <div key={g.label} className="mt-4">
            <p className="px-3 pb-1 text-xs font-semibold text-muted-foreground">{g.label}</p>
            <ul>{g.items.map((c) => chatItem(c, false))}</ul>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1 border-t border-border px-2 py-2">
        <button type="button" onClick={props.onProfile} title="Perfil y empresa" className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-secondary">
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
