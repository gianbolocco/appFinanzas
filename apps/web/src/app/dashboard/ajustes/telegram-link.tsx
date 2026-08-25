"use client";

import { useState, useEffect } from "react";
import { Bot, Link2, Unlink, RefreshCw, CheckCircle2 } from "lucide-react";
import { generatePairCode, unlinkTelegram } from "@/lib/telegram-actions";

interface TelegramLinkProps {
  initialStatus: {
    linked: boolean;
    username?: string;
    pendingCode?: string | null;
  };
}

export function TelegramLink({ initialStatus }: TelegramLinkProps) {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const code = await generatePairCode();
      setStatus({ ...status, pendingCode: code });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async () => {
    setLoading(true);
    try {
      await unlinkTelegram();
      setStatus({ linked: false, pendingCode: null });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold">Bot de Telegram</h3>
          <p className="text-sm text-muted-foreground">
            Cargá gastos mandando un mensaje.
          </p>
        </div>
      </div>

      {status.linked ? (
        <div className="flex flex-col gap-4 rounded-xl bg-muted/50 p-4 border border-border">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-500">
            <CheckCircle2 className="h-5 w-5" />
            Vinculado correctamente
          </div>
          <button
            onClick={handleUnlink}
            disabled={loading}
            className="flex h-10 items-center justify-center gap-2 rounded-xl bg-destructive/10 text-destructive text-sm font-medium transition hover:bg-destructive/20 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
            Desvincular
          </button>
        </div>
      ) : status.pendingCode ? (
        <div className="flex flex-col gap-4 rounded-xl bg-muted/50 p-4 border border-border">
          <p className="text-sm text-muted-foreground text-center">
            Entrá al bot y mandale este código:
          </p>
          <div className="text-center">
            <span className="text-3xl font-mono font-bold tracking-widest text-foreground select-all">
              {status.pendingCode}
            </span>
          </div>
          <a
            href={`https://t.me/GuitaAppBot?start=${status.pendingCode}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-500 text-white text-sm font-medium transition hover:bg-blue-600"
          >
            <Link2 className="h-4 w-4" />
            Abrir Telegram
          </a>
          <p className="text-xs text-muted-foreground text-center mt-1">
            Recargá esta página una vez que el bot te confirme.
          </p>
        </div>
      ) : (
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          Vincular cuenta
        </button>
      )}
    </div>
  );
}
