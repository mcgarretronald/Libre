'use client';

import { ReactNode, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface TipProps {
  label: string;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Tooltip that renders via a React portal into document.body so it is
 * never clipped by parent overflow:hidden containers.
 */
export function Tip({ label, children, side = 'top' }: TipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos]       = useState<{ top: number; left: number } | null>(null);
  const [visible, setVisible] = useState(false);

  const show = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const GAP = 8; // px between trigger and tooltip

    let top  = 0;
    let left = 0;

    switch (side) {
      case 'top':
        top  = r.top  + window.scrollY - GAP;
        left = r.left + window.scrollX + r.width / 2;
        break;
      case 'bottom':
        top  = r.bottom + window.scrollY + GAP;
        left = r.left   + window.scrollX + r.width / 2;
        break;
      case 'left':
        top  = r.top  + window.scrollY + r.height / 2;
        left = r.left + window.scrollX - GAP;
        break;
      case 'right':
        top  = r.top   + window.scrollY + r.height / 2;
        left = r.right + window.scrollX + GAP;
        break;
    }

    setPos({ top, left });
    setVisible(true);
  }, [side]);

  const hide = useCallback(() => setVisible(false), []);

  // CSS transform to anchor tooltip around the computed point
  const TRANSFORM: Record<string, string> = {
    top:    'translate(-50%, -100%)',
    bottom: 'translate(-50%, 0)',
    left:   'translate(-100%, -50%)',
    right:  'translate(0, -50%)',
  };

  return (
    <>
      <span
        ref={triggerRef}
        className="inline-flex items-center justify-center"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>

      {visible && pos && typeof document !== 'undefined' &&
        createPortal(
          <span
            role="tooltip"
            style={{
              position:  'fixed',
              top:       pos.top,
              left:      pos.left,
              transform: TRANSFORM[side],
              zIndex:    9999,
              pointerEvents: 'none',
            }}
            className="
              whitespace-nowrap px-2.5 py-1 rounded-lg
              bg-slate-800 dark:bg-slate-700
              text-white text-[11px] font-semibold tracking-wide
              shadow-xl
              animate-in fade-in zoom-in-95 duration-100
            "
          >
            {label}
          </span>,
          document.body
        )
      }
    </>
  );
}
