/**
 * Tooltip — uses fixed positioning to escape card overflow clipping.
 */
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  side?: 'top' | 'bottom';
}

export default function Tooltip({ content, children }: TooltipProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      setPos({ x: rect.left + rect.width / 2, y: rect.bottom + 8 });
    }, 50);
  };

  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setPos(null);
  };

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <>
      <div ref={ref} onMouseEnter={show} onMouseLeave={hide} style={{ display: 'inline-block', zIndex: 10 }}>
        {children}
      </div>
      {pos && createPortal(
        <div style={{
          position: 'fixed',
          left: pos.x,
          top: pos.y,
          transform: 'translateX(-50%)',
          zIndex: 999999,
          pointerEvents: 'none',
          backgroundColor: '#111111',
          color: '#ffffff',
          fontSize: '12px',
          fontWeight: 500,
          lineHeight: 1.45,
          padding: '8px 12px',
          borderRadius: '12px',
          maxWidth: '240px',
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(17,17,17,0.25)',
          animation: 'tooltipIn 0.15s ease both',
          whiteSpace: 'normal',
          wordBreak: 'break-word',
        }}>
          {content}
        </div>,
        document.body
      )}
    </>
  );
}
