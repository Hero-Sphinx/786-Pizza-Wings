"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "../icons";

/**
 * Modal built on the native <dialog>: focus trapping, Esc to close and the backdrop come
 * from the browser. Bottom sheet on phones, centred card on larger screens.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  labelledBy: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      document.documentElement.style.overflow = "hidden";
    } else if (!open && d.open) {
      d.close();
    }
    if (!open) document.documentElement.style.overflow = "";
  }, [open]);

  useEffect(() => () => void (document.documentElement.style.overflow = ""), []);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={labelledBy}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the <dialog> element itself.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col sm:max-h-[88dvh]">
          <div className="flex items-start justify-between gap-3 border-b border-ink/10 px-5 py-4">
            <h2 id={labelledBy} className="h-display text-2xl leading-tight">
              {title}
            </h2>
            <button type="button" onClick={onClose} className="btn btn-ghost -mr-2 -mt-1 size-11 p-0" aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="border-t border-ink/10 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
