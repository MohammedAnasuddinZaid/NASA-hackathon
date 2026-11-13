import { useEffect, useRef, useState } from 'react';

const slides = [
  {
    image: '/demo/overview.png',
    title: '01 / The gap',
    caption:
      'The corpus has 131 records and zero total-pressure or per-test gravity values. FIRETRACE makes that absence visible instead of hiding it.',
  },
  {
    image: '/demo/atmosphere.png',
    title: '02 / Atmosphere',
    caption:
      'ppO2 needs total pressure. A lunar planning point of 10.2 psi and 30 % O2 is 3.06 psi, but no record can be placed on that axis.',
  },
  {
    image: '/demo/atlas.png',
    title: '03 / Evidence',
    caption:
      'Every record keeps its measured value, raw field, quality flag and source locator. Missing values stay missing.',
  },
  {
    image: '/demo/compare.png',
    title: '04 / Compare',
    caption:
      'A side-by-side table reports blockers instead of a similarity score: pressure, gravity, flow basis and outcome.',
  },
  {
    image: '/demo/gap.png',
    title: '05 / Plan',
    caption:
      'The Gap Planner turns a target condition into an evidence audit and a downloadable test checklist.',
  },
  {
    image: '/demo/assistant.png',
    title: '06 / Retrieve',
    caption:
      'The assistant answers from reported values and cites sources. When the corpus cannot support an answer, it abstains.',
  },
] as const;

export function DemoReel() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    timer.current = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, 4200);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [playing]);

  const slide = slides[index];

  return (
    <section className="demo-reel" aria-label="FIRETRACE demo reel">
      <div className="demo-reel__frame">
        <img src={slide.image} alt={slide.title} className="demo-reel__image" />
        <div className="demo-reel__veil" aria-hidden="true" />
        <div className="demo-reel__caption">
          <div className="demo-reel__index">{slide.title}</div>
          <p>{slide.caption}</p>
        </div>
      </div>
      <div className="demo-reel__controls">
        <button
          type="button"
          className="demo-reel__button"
          onClick={() => setPlaying((value) => !value)}
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          className="demo-reel__button"
          onClick={() => setIndex((current) => (current + slides.length - 1) % slides.length)}
        >
          Prev
        </button>
        <button
          type="button"
          className="demo-reel__button"
          onClick={() => setIndex((current) => (current + 1) % slides.length)}
        >
          Next
        </button>
        <div className="demo-reel__progress" aria-hidden="true">
          {slides.map((item, itemIndex) => (
            <span
              key={item.title}
              className={itemIndex === index ? 'is-active' : ''}
              onClick={() => setIndex(itemIndex)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
