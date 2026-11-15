import { useEffect, useRef, type ReactNode } from 'react';

/** Content is visible before observation; the reveal is an optional one-shot accent. */
export function RevealOnScroll({ children, className = '', paused = false }: {
  children: ReactNode; className?: string; paused?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        node.dataset.revealed = 'true';
        observer.disconnect();
      }
    }, { threshold: 0.12 });
    observer.observe(node);
    return () => { observer.disconnect(); delete node.dataset.revealed; };
  }, [paused]);
  return <div ref={ref} className={`cinema-reveal ${className}`}>{children}</div>;
}
