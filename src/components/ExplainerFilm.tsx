import { useEffect, useMemo, useRef, useState } from 'react';
import { records, coverage, recordById } from '../lib/corpus';
import { formatCompact } from '../lib/format';

const DURATION = 45;
// Release narration requires verified authorship, reuse rights and AI attribution.
const NARRATION_AVAILABLE = false;

const scenes = [
  {
    start: 0,
    end: 9,
    act: 'Act I',
    label: 'The problem',
    caption:
      `The corpus contains ${records.length} experiment records. ${coverage.pressure_reported} report total pressure. This is a gap in these tables; the summary report contains additional context.`,
  },
  {
    start: 9,
    end: 19,
    act: 'Act II',
    label: 'The missing axis',
    caption:
      'These records report oxygen fraction without per-test total pressure. Without both, an atmosphere cannot be placed — and this model refuses to invent the missing ordinate.',
  },
  {
    start: 19,
    end: 29,
    act: 'Act III',
    label: 'The honest answer',
    caption:
      'Ask for a pressure and the assistant abstains. It retrieves the table, shows the absent field and cites PSI-25 and PSI-98 instead of producing a number.',
  },
  {
    start: 29,
    end: 38,
    act: 'Act IV',
    label: 'The plan',
    caption:
      'The solution is not a better guess. The Gap Planner turns missing record fields into a planning checklist: pressure, per-test gravity, flow basis and a standardized outcome.',
  },
  {
    start: 38,
    end: 45,
    act: 'End',
    label: 'Evidence has an address',
    caption:
      'Retrieve what was measured. Expose what was not. That is the entire product: an evidence workspace that can say no.',
  },
] as const;

function formatTime(value: number): string {
  const seconds = Math.max(0, Math.floor(value));
  return `00:${String(seconds).padStart(2, '0')}`;
}

function typed(text: string, progress: number, from = 0.06, to = 0.46): string {
  if (progress <= from) return '';
  const ratio = Math.min(1, (progress - from) / (to - from));
  return text.slice(0, Math.ceil(text.length * ratio));
}

const rows = ['BASS2-B1', 'BASS2-B2', 'BASS2-P22b', 'SAFFIRE1-S1'].map((id) => {
  const record = recordById.get(id)!;
  return [id, formatCompact(record.oxygen_initial_pct), formatCompact(record.total_pressure_psia), `${record.gravity_regime.value}*`];
});

function Cursor({ scene, progress }: { scene: number; progress: number }) {
  const positions = [
    { left: 27, top: 49 },
    { left: 63, top: 36 },
    { left: 26, top: 57 },
    { left: 38, top: 34 },
    { left: 59, top: 80 },
    { left: 69, top: 45 },
    { left: 58, top: 42 },
    { left: 76, top: 72 },
    { left: 50, top: 62 },
  ];
  let index = 0;
  if (scene === 0) index = progress > 0.42 ? 1 : 0;
  if (scene === 1) index = progress > 0.34 ? 3 : 2;
  if (scene === 2) index = progress > 0.3 ? 5 : 4;
  if (scene === 3) index = progress > 0.34 ? 7 : 6;
  if (scene === 4) index = 8;
  const point = positions[index];

  return (
    <span
      className="film__cursor"
      style={{ left: `${point.left}%`, top: `${point.top}%` }}
      aria-hidden="true"
    >
      <svg width="19" height="22" viewBox="0 0 19 22" fill="none">
        <path
          d="M1.2 1.1 17 10.9l-7.1 1.5-3.4 6.6L1.2 1.1Z"
          fill="#ffffff"
          stroke="#000000"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      <span className="film__cursor-label">TRACE</span>
    </span>
  );
}

function Nav({ active }: { active: string }) {
  return (
    <div className="fm-nav" aria-hidden="true">
      <span className="fm-brand">
        fıretrace<sup>&reg;</sup>
      </span>
      <span className="fm-links">
        <span className={active === 'atlas' ? 'is-on' : ''}>02 Atlas</span>
        <span className={active === 'atmosphere' ? 'is-on' : ''}>01 Atmosphere</span>
        <span className={active === 'assistant' ? 'is-on' : ''}>05 Assistant</span>
        <span className={active === 'gap' ? 'is-on' : ''}>04 Gap</span>
      </span>
      <span className="fm-op">
        <i aria-hidden="true" /> AI operator / trace
      </span>
    </div>
  );
}

function SceneProblem({ progress }: { progress: number }) {
  return (
    <div className="fm-scene fm-scene--atlas">
      <div className="fm-main">
        <div className="fm-eyebrow">02 / Evidence Atlas</div>
        <div className="fm-h">
          Every record, <em>every gap.</em>
        </div>
        <div className="fm-statrow">
          <span>
            <strong>{records.length}</strong> records
          </span>
          <span>
            <strong>{coverage.pressure_reported}</strong> record pressure values
          </span>
          <span>
            <strong>0</strong> per-test g
          </span>
        </div>
        <div className="fm-table">
          <div className="fm-tr fm-tr--head">
            <span>Record</span>
            <span>Initial O2</span>
            <span>Pressure</span>
            <span>Gravity</span>
          </div>
          {rows.map(([id, o2, pressure, gravity], index) => (
            <div
              className={`fm-tr ${index === 0 && progress > 0.3 ? 'is-target' : ''} ${
                index > 1 ? 'fm-optional' : ''
              }`}
              key={id}
            >
              <span className="fm-id">{id}</span>
              <span>{o2}</span>
              <span className="fm-missing">{pressure}</span>
              <span className="fm-dim">{gravity}</span>
            </div>
          ))}
        </div>
        <div className="fm-note fm-optional">
          * Gravity is investigation-level context, not a per-test measurement.
        </div>
      </div>
      <aside className="fm-drawer fm-optional">
        <div className="fm-eyebrow">Record detail</div>
        <div className="fm-drawer-id">BASS2-B1</div>
        <div className="fm-field">
          <span>Total pressure</span>
          <strong className="fm-missing">Not reported</strong>
        </div>
        <div className="fm-field">
          <span>O2 partial pressure</span>
          <strong className="fm-missing">Not calculable</strong>
        </div>
        <div className="fm-field">
          <span>Gravity regime</span>
          <strong>microgravity</strong>
          <small>investigation level</small>
        </div>
        <div className="fm-field">
          <span>Source</span>
          <strong>{recordById.get('BASS2-B1')!.source_locator}</strong>
        </div>
        <div className="fm-stamp">{coverage.pressure_reported} / {records.length}</div>
      </aside>
    </div>
  );
}

function SceneAtmosphere({ progress }: { progress: number }) {
  const pressure = 10.2;
  const oxygen = 30;
  const ppO2 = (pressure * oxygen) / 100;
  const sliderProgress = Math.min(1, progress / 0.45);
  return (
    <div className="fm-scene fm-scene--atmosphere">
      <div className="fm-main">
        <div className="fm-eyebrow">01 / Atmosphere Explorer</div>
        <div className="fm-h">
          An atmosphere is <em>two numbers.</em>
        </div>
        <div className="fm-sliders">
          <div className="fm-slider-head">
            <span>Total pressure</span>
            <strong>{pressure.toFixed(1)} psia</strong>
          </div>
          <div className="fm-slide">
            <span style={{ width: `${44 + sliderProgress * 14}%` }} />
            <i style={{ left: `${44 + sliderProgress * 14}%` }} />
          </div>
          <div className="fm-slider-head">
            <span>Oxygen fraction</span>
            <strong>{oxygen}% vol</strong>
          </div>
          <div className="fm-slide">
            <span style={{ width: '30%' }} />
            <i style={{ left: '30%' }} />
          </div>
        </div>
        <div className="fm-readout">
          <span>ppO2</span>
          <strong>{ppO2.toFixed(2)}</strong>
          <small>psi</small>
        </div>
        <div className="fm-note">Dalton law composition only. Not a flammability boundary.</div>
      </div>
      <div className="fm-side fm-optional">
        <div className="fm-chart">
          <div className="fm-chart-grid" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
          <svg viewBox="0 0 320 210" className="fm-chart-svg" aria-hidden="true">
            <line x1="34" y1="182" x2="304" y2="182" stroke="rgba(255,255,255,.28)" />
            <line x1="34" y1="18" x2="34" y2="182" stroke="rgba(255,255,255,.28)" />
            <path d="M 52 26 C 130 40, 210 84, 292 146" fill="none" stroke="rgba(255,255,255,.35)" strokeDasharray="3 4" />
            <circle cx="152" cy="94" r="3.5" fill="#fff" />
            <circle cx="240" cy="130" r="3.5" fill="#fff" />
            <circle cx="214" cy="72" r="4" fill="#c6f432" />
            <line x1="214" y1="182" x2="214" y2="72" stroke="rgba(255,255,255,.16)" />
            <line x1="34" y1="72" x2="304" y2="72" stroke="rgba(255,255,255,.16)" />
            <text x="152" y="112" fill="rgba(255,255,255,.55)" fontSize="9" textAnchor="middle">Earth</text>
            <text x="272" y="144" fill="rgba(255,255,255,.55)" fontSize="9" textAnchor="end">Suit</text>
            <text x="222" y="62" fill="#ffffff" fontSize="9">Target</text>
          </svg>
          <div className="fm-chart-label">
            <span>Pressure</span>
            <span>O2 fraction</span>
          </div>
        </div>
        <div className="fm-stamp">Cannot place a record</div>
        <div className="fm-stamp-sub">{coverage.pressure_reported} of {records.length} have a pressure value</div>
      </div>
    </div>
  );
}

function SceneAssistant({ progress }: { progress: number }) {
  return (
    <div className="fm-scene fm-scene--assistant">
      <div className="fm-eyebrow">05 / Evidence Assistant</div>
      <div className="fm-assistant">
        <div className="fm-query">
          <span className="fm-role">You</span>
          <span>
            {typed('What pressure was BASS-II run at?', progress)}
            <i className="fm-caret" aria-hidden="true" />
          </span>
        </div>
        <div className={`fm-answer ${progress > 0.5 ? 'is-shown' : ''}`}>
          <div className="fm-answer-top">
            <span className="fm-badge">Evidence absent</span>
            <span className="fm-dim">2 citations</span>
          </div>
          <div className="fm-answer-h">
            The corpus does not report a total pressure for BASS-II.
          </div>
          <p>
            <strong>{coverage.pressure_reported} of {records.length}</strong> records carry a pressure value. The experimental table has no
            pressure column, so no per-test pressure can be retrieved.
          </p>
          <div className="fm-cites">
            <span>PSI-25 · experimental table</span>
            <span>PSI-98 · experimental table</span>
          </div>
          <div className="fm-answer-foot">
            No external model was called. Answer constructed from bundled fields.
          </div>
        </div>
      </div>
    </div>
  );
}

function SceneGap({ progress }: { progress: number }) {
  return (
    <div className="fm-scene fm-scene--gap">
      <div className="fm-main">
        <div className="fm-eyebrow">04 / Gap Planner</div>
        <div className="fm-h">
          Design the test <em>the evidence is missing.</em>
        </div>
        <div className="fm-form">
          <div className="fm-form-row">
            <span>Objective</span>
            <strong>Model validation</strong>
          </div>
          <div className="fm-form-row">
            <span>Target</span>
            <strong>10.2 psia · 30% O2 · lunar</strong>
          </div>
          <div className="fm-form-row">
            <span>ppO2</span>
            <strong>3.06 psi</strong>
          </div>
          <button type="button" className="fm-plan" tabIndex={-1}>
            Download plan <span aria-hidden="true">&darr;</span>
          </button>
        </div>
      </div>
      <aside className="fm-side fm-optional">
        <div className="fm-checks">
          <div className="fm-check">
            <span>Total pressure per test</span>
            <strong>Absent</strong>
          </div>
          <div className="fm-check">
            <span>Per-test gravity</span>
            <strong>Absent</strong>
          </div>
          <div className="fm-check">
            <span>Standardized outcome</span>
            <strong>Absent</strong>
          </div>
          <div className="fm-check is-ready">
            <span>Required fields</span>
            <strong>Defined</strong>
          </div>
        </div>
        <div className="fm-note">A planning checklist — not a prediction or certification.</div>
        {progress > 0.45 && <div className="fm-stamp">Plan ready</div>}
      </aside>
    </div>
  );
}

function SceneEnd() {
  return (
    <div className="fm-scene fm-scene--end">
      <div className="fm-end-mark">
        fıretrace<sup>&reg;</sup>
      </div>
      <div className="fm-end-title">
        Evidence has <em>an address.</em>
      </div>
      <p className="fm-end-lede">Retrieve what was measured. Expose what wasn't.</p>
      <div className="fm-end-foot">
        <span>{records.length} records</span>
        <span>0 pressure values</span>
        <span>1 honest answer</span>
      </div>
    </div>
  );
}

export function ExplainerFilm() {
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(
    () =>
      typeof window === 'undefined' ||
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [inView, setInView] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Unverified narration is excluded from the submission release.
  const [voiceOn, setVoiceOn] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [audioFailures, setAudioFailures] = useState<number[]>([]);
  const [sync, setSync] = useState(0);
  const rootRef = useRef<HTMLElement | null>(null);
  const audioRefs = useRef<Array<HTMLAudioElement | null>>([]);
  const elapsedRef = useRef(0);
  elapsedRef.current = elapsed;

  const sceneIndex = useMemo(() => {
    const found = scenes.findIndex((scene) => elapsed >= scene.start && elapsed < scene.end);
    return found === -1 ? scenes.length - 1 : found;
  }, [elapsed]);
  const scene = scenes[sceneIndex];
  const progress = Math.min(1, Math.max(0, (elapsed - scene.start) / (scene.end - scene.start)));

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => setInView(entries.some((entry) => entry.isIntersecting)),
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!playing || !inView) return;
    const timer = window.setInterval(() => {
      setElapsed((value) => (value + 0.1 >= DURATION ? 0 : value + 0.1));
    }, 100);
    return () => window.clearInterval(timer);
  }, [playing, inView]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    return () => {
      audioRefs.current.forEach((audio) => audio?.pause());
    };
  }, []);

  // Keep narration locked to the current act. One clip per act, played only while
  // the film is running and visible; pause, seek, replay and chapter jumps re-sync it.
  useEffect(() => {
    audioRefs.current.forEach((audio, index) => {
      if (audio && index !== sceneIndex) audio.pause();
    });
    const audio = audioRefs.current[sceneIndex];
    if (!audio) return;

    if (!playing || !inView || !voiceOn) {
      audio.pause();
      return;
    }

    const offset = Math.max(0, elapsedRef.current - scene.start);
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      const target = Math.min(offset, Math.max(0, audio.duration - 0.05));
      if (Math.abs(audio.currentTime - target) > 0.35) {
        audio.currentTime = target;
      }
    }

    void audio
      .play()
      .then(() => setAudioBlocked(false))
      .catch((error: unknown) => {
        // Pausing a pending play() rejects with AbortError; only a real
        // autoplay block (NotAllowedError) should surface the sound prompt.
        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          setAudioBlocked(true);
        }
      });
  }, [playing, inView, voiceOn, sceneIndex, scene.start, sync]);

  function seek(value: number) {
    setElapsed(Math.min(DURATION - 0.1, Math.max(0, value)));
    setSync((token) => token + 1);
  }

  function enableSound() {
    setVoiceOn(true);
    setAudioBlocked(false);
    const audio = audioRefs.current[sceneIndex];
    if (audio) {
      void audio.play().catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          setAudioBlocked(true);
        }
      });
    }
    setSync((token) => token + 1);
  }


  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await rootRef.current?.requestFullscreen?.();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* fullscreen can be blocked by the host; controls still work */
    }
  }

  const activeNav =
    sceneIndex === 0 ? 'atlas' : sceneIndex === 1 ? 'atmosphere' : sceneIndex === 2 ? 'assistant' : 'gap';

  return (
    <section className="film" ref={rootRef} aria-label="FIRETRACE explanatory film">
      <div className="film__head">
        <div>
          <span className="kicker">The explainer / 00:45</span>
          <h2>
            Evidence, <em>not vibes.</em>
          </h2>
        </div>
        <div className="film__head-meta">
          <span>5 acts</span>
          <span>{NARRATION_AVAILABLE ? (voiceOn ? (audioBlocked ? 'Tap for sound' : 'Voiceover') : 'Muted') : 'Captions only'}</span>
          <span>Record-layer narration; report context in Sources</span>
        </div>
      </div>

      {NARRATION_AVAILABLE && <div className="film__audio" aria-hidden="true">
        {scenes.map((item, index) => (
          <audio
            key={item.label}
            ref={(node) => {
              audioRefs.current[index] = node;
            }}
            src={`${import.meta.env.BASE_URL}audio/act-${index + 1}.mp3`}
            preload="auto"
            onError={() => setAudioFailures(failed => failed.includes(index) ? failed : [...failed, index])}
          />
        ))}
      </div>}

      <div className="film__frame">
        <div className="film__chrome">
          <span>FIRETRACE / EXPLAINER</span>
          <span className="film__chrome-mid">A guided run through the evidence</span>
          <span>
            <i aria-hidden="true" />
            AI operator: TRACE
          </span>
        </div>

        <div className="film__stage" aria-hidden="true">
          <Nav active={activeNav} />
          {sceneIndex === 0 && <SceneProblem progress={progress} />}
          {sceneIndex === 1 && <SceneAtmosphere progress={progress} />}
          {sceneIndex === 2 && <SceneAssistant progress={progress} />}
          {sceneIndex === 3 && <SceneGap progress={progress} />}
          {sceneIndex === 4 && <SceneEnd />}
          <Cursor scene={sceneIndex} progress={progress} />
          <div className="film__caption">
            <span className="film__caption-tag">{scene.act}</span>
            <span className="film__caption-label">{scene.label}</span>
            <span className="film__caption-line" />
          </div>
        </div>

        <div className="film__subtitle" aria-live="polite">
          {scene.caption}
        </div>

        {audioBlocked && voiceOn && (
          <button type="button" className="film__unmute" onClick={enableSound}>
            <span className="film__unmute-icon" aria-hidden="true">
              &#9654;
            </span>
            <span>
              <strong>Sound on</strong>
              <small>Hear the 45-second walkthrough</small>
            </span>
          </button>
        )}
      </div>

      {!NARRATION_AVAILABLE && <p role="status">Caption-only release: narration is excluded until its authorship and reuse rights are verified.</p>}
      {audioFailures.includes(sceneIndex) && <p role="status">Narration audio is unavailable for this act. The visual explainer and captions remain available.</p>}
      <div className="film__controls">
        <div className="film__controls-left">
          <button
            type="button"
            className="film__button film__button--play"
            onClick={() => setPlaying((value) => !value)}
          >
            <span aria-hidden="true">{playing ? '\u275A\u275A' : '\u25B6'}</span>
            {playing ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            className="film__button"
            onClick={() => {
              seek(0);
              setPlaying(true);
            }}
          >
            <span aria-hidden="true">&#8635;</span> Replay
          </button>
          <button
            type="button"
            className={`film__button film__sound ${voiceOn ? 'is-on' : ''}`}
            disabled={!NARRATION_AVAILABLE}
            aria-pressed={voiceOn}
            onClick={() => {
              if (voiceOn) {
                setVoiceOn(false);
              } else {
                enableSound();
              }
            }}
          >
            <span className="film__sound-dot" aria-hidden="true" />
            {NARRATION_AVAILABLE ? (voiceOn ? 'Sound on' : 'Sound off') : 'Captions only'}
          </button>
          <span className="film__time">
            {formatTime(elapsed)} <span>/ 00:45</span>
          </span>
        </div>

        <div className="film__chapters" aria-label="Film chapters">
          {scenes.map((item, index) => (
            <button
              type="button"
              key={item.label}
              className={`film__chapter ${index === sceneIndex ? 'is-active' : ''}`}
              onClick={() => {
                seek(item.start);
                setPlaying(true);
              }}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              {item.label}
            </button>
          ))}
        </div>

        <button type="button" className="film__button film__fullscreen" onClick={toggleFullscreen}>
          {isFullscreen ? 'Exit full screen' : 'Full screen'} <span aria-hidden="true">&#x26F6;</span>
        </button>
      </div>

      <div className="film__progress" aria-hidden="true">
        <span className="film__progress-fill" style={{ width: `${(elapsed / DURATION) * 100}%` }} />
        {scenes.map((item) => (
          <i key={item.label} style={{ left: `${(item.start / DURATION) * 100}%` }} />
        ))}
      </div>

      <div className="film__foot">
        <span className="hand">[ the model is the messenger — not the evidence ]</span>
        <button
          type="button"
          className="text-link"
          onClick={() => {
            const target = document.getElementById('live-model');
            target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        >
          Try the live model &darr;
        </button>
      </div>
    </section>
  );
}
