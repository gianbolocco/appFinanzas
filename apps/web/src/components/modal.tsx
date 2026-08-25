"use client";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[96vh] flex flex-col gap-0 overflow-hidden rounded-3xl p-0 top-auto bottom-2 left-1/2 -translate-x-1/2 translate-y-0 w-[calc(100%-1rem)] max-w-md sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 sm:w-full border border-border/50 bg-card shadow-2xl"
      >
        <DialogHeader className="flex-row items-center justify-between border-b border-border/50 px-6 py-4">
          <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          <DialogClose
            render={
              <Button variant="ghost" size="icon-sm" className="ml-auto rounded-full bg-muted/50 hover:bg-muted" />
            }
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Cerrar</span>
          </DialogClose>
        </DialogHeader>

        {description && (
          <DialogDescription className="px-5 pt-3 text-sm text-muted-foreground">
            {description}
          </DialogDescription>
        )}

        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
