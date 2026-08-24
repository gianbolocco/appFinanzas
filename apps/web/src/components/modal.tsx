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
        className="max-h-[92vh] flex-col gap-0 overflow-hidden rounded-t-3xl p-0 bottom-0 top-auto translate-y-0 left-1/2 -translate-x-1/2 w-full max-w-[calc(100%-1.5rem)] sm:max-w-md md:max-w-md lg:top-1/2 lg:bottom-auto lg:-translate-y-1/2 lg:rounded-3xl"
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 lg:hidden">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        <DialogHeader className="flex-row items-center justify-between border-b border-border px-5 py-4">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
          <DialogClose
            render={
              <Button variant="ghost" size="icon-sm" className="ml-auto" />
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
