import { useEffect, type RefObject } from 'react';

/** No scroll handlers or render loop. Unsupported observers produce a static scene. */
export function useMotionBoundary(ref: RefObject<HTMLElement | null>, paused: boolean) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mobile = window.matchMedia('(max-width: 640px)');
    let visible = false;
    const update = () => {
      node.dataset.motion = preference.matches || mobile.matches || !('IntersectionObserver' in window)
        ? 'static' : paused || document.hidden || !visible ? 'paused' : 'running';
    };
    update();
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      update();
    }, { threshold: 0.01 }) : null;
    observer?.observe(node);
    document.addEventListener('visibilitychange', update);
    preference.addEventListener('change', update);
    mobile.addEventListener('change', update);
    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', update);
      preference.removeEventListener('change', update);
      mobile.removeEventListener('change', update);
      delete node.dataset.motion;
    };
  }, [ref, paused]);
}
