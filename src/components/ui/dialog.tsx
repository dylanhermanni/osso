"use client";
import { CopyScope } from "@/components/content-provider";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <CopyScope>
      {
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="dialog-overlay" />
            <DialogPrimitive.Content
              className={`dialog-content ${wide ? "dialog-wide" : ""}`}
            >
              <div className="dialog-header">
                <div>
                  <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
                  <DialogPrimitive.Description>
                    {description || "Alles voor ons thuis, op één plek."}
                  </DialogPrimitive.Description>
                </div>
                <DialogPrimitive.Close
                  className="icon-button"
                  aria-label="Sluiten"
                >
                  <X size={20} />
                </DialogPrimitive.Close>
              </div>
              {children}
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      }
    </CopyScope>
  );
}
