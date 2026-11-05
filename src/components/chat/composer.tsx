import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Loader2 } from "lucide-react";

import { MAX_MESSAGE_CHARS } from "@/lib/app-config";
import { cn } from "@/lib/utils";

export type ComposerHandle = { fill: (text: string) => void };

/** Barra de escritura: una línea que crece con el texto. Enter envía, Shift+Enter hace salto de línea. */
export const Composer = forwardRef<ComposerHandle, { placeholder: string; disabled: boolean; busy?: boolean; onSend: (text: string) => void; className?: string }>(
  function Composer({ placeholder, disabled, busy = false, onSend, className }, handle) {
    const [text, setText] = useState("");
    const ref = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(handle, () => ({
      fill(value: string) {
        setText(value);
        requestAnimationFrame(() => {
          ref.current?.focus();
          ref.current?.setSelectionRange(value.length, value.length);
        });
      },
    }));

    useLayoutEffect(() => {
      const el = ref.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
    }, [text]);

    function submit() {
      const value = text.trim();
      if (!value || disabled) return;
      onSend(value);
      setText("");
    }

    function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        submit();
      }
    }

    return (
      <form
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        className={cn("flex items-end gap-2 rounded-[26px] border border-border bg-surface py-2 pl-5 pr-2 shadow-lg shadow-black/20 focus-within:border-primary/60", className)}
      >
        <label htmlFor="composer" className="sr-only">Escribe tu mensaje</label>
        <textarea
          id="composer"
          ref={ref}
          rows={1}
          value={text}
          maxLength={MAX_MESSAGE_CHARS}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          className="max-h-[220px] min-h-10 flex-1 resize-none bg-transparent py-2 text-base text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          aria-label="Enviar"
          className="mb-0.5 flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-[#FF8466] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <ArrowUp className="size-5" aria-hidden />}
        </button>
      </form>
    );
  },
);
