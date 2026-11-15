import { useRef, type ReactNode } from 'react';
import { useMotionBoundary } from './motion';

// Original deterministic vector decoration. These coordinates are design, never evidence.
const stars = Array.from({ length: 38 }, (_, i) => ({
  x: (i * 113 + 29) % 800, y: (i * 67 + 41) % 480, r: i % 7 === 0 ? 1.6 : 0.8,
}));

export function SpaceScene({ paused, className = '', children }: {
  paused: boolean; className?: string; children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useMotionBoundary(ref, paused);
  return <div ref={ref} className={`cinema-space ${className}`} aria-hidden="true" data-motion="paused">
    <svg className="cinema-stars" viewBox="0 0 800 480" preserveAspectRatio="xMidYMid slice" focusable="false">
      {stars.map((star, index) => <circle key={index} cx={star.x} cy={star.y} r={star.r}
        fill={index % 11 === 0 ? '#C6F432' : '#FFFFFF'} opacity={index % 3 === 0 ? 0.65 : 0.28} />)}
    </svg>
    {children}
  </div>;
}

export function RocketTrajectory() {
  return <svg className="cinema-rocket" viewBox="0 0 400 310" fill="none" focusable="false">
    <circle cx="190" cy="170" r="112" className="cinema-orbit" />
    <ellipse cx="190" cy="170" rx="172" ry="72" transform="rotate(-32 190 170)" className="cinema-orbit" />
    <path className="cinema-flight-path" d="M48 258 C48 135 215 165 332 54" pathLength="1" />
    <circle cx="332" cy="54" r="4" fill="#C6F432" />
    <g className="cinema-vessel">
      <path d="M0-19 C-5-13-7-6-6 5 L0 9 L6 5 C7-6 5-13 0-19Z" fill="#0B0B0C" stroke="white" strokeWidth="1.5" />
      <path d="M-6-2 L-12 8 L-6 5 M6-2 L12 8 L6 5 M0 10 V18" stroke="#C6F432" strokeWidth="1.5" />
      <circle cy="-7" r="2.5" stroke="#C6F432" />
    </g>
  </svg>;
}
