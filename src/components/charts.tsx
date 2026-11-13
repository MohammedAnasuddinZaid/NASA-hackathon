import type { ExperimentRecord } from '../lib/types';
import { oxygenHistogram } from '../lib/atmosphere';
import type { FieldCoverage } from '../lib/records';

const W = 760;
const H = 440;
const M = { top: 28, right: 28, bottom: 52, left: 58 };
const PW = W - M.left - M.right;
const PH = H - M.top - M.bottom;

function sx(pressure: number): number {
  return M.left + ((pressure - 2) / 14) * PW;
}
function sy(oxygen: number): number {
  return M.top + (1 - oxygen / 100) * PH;
}

export interface PlanePoint {
  pressure: number;
  oxygen: number;
  label: string;
  kind: 'reference' | 'selected';
  caveat?: string;
}

export function AtmospherePlane({
  selected,
  references,
}: {
  selected: { pressure: number; oxygen: number };
  references: Array<{ id: string; label: string; pressure_psia: number; oxygen_pct: number; kind: string }>;
}) {
  const matchedReference = references.find(
    (reference) =>
      Math.abs(reference.pressure_psia - selected.pressure) < 0.02 &&
      Math.abs(reference.oxygen_pct - selected.oxygen) < 0.02,
  );
  const points: PlanePoint[] = [
    ...references
      .filter((reference) => reference !== matchedReference)
      .map((reference) => ({
        pressure: reference.pressure_psia,
        oxygen: reference.oxygen_pct,
        label: reference.label,
        kind: 'reference' as const,
      })),
    {
      pressure: selected.pressure,
      oxygen: selected.oxygen,
      label: matchedReference ? `Your target · ${matchedReference.label}` : 'Your target',
      kind: 'selected' as const,
    },
  ];

  const isoLevels = [2, 3.07, 4.3];

  return (
    <figure className="chart-figure">
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Pressure versus oxygen fraction chart. Iso-lines show oxygen partial pressure. Corpus records cannot be plotted because no record reports total pressure."
      >
        <rect x={M.left} y={M.top} width={PW} height={PH} className="chart__plot" />

        {[0, 20, 40, 60, 80, 100].map((value) => (
          <g key={`y-${value}`}>
            <line x1={M.left} x2={M.left + PW} y1={sy(value)} y2={sy(value)} className="chart__grid" />
            <text x={M.left - 12} y={sy(value) + 4} textAnchor="end" className="chart__tick">
              {value}
            </text>
          </g>
        ))}
        {[2, 4, 6, 8, 10, 12, 14, 16].map((value) => (
          <g key={`x-${value}`}>
            <line x1={sx(value)} x2={sx(value)} y1={M.top} y2={M.top + PH} className="chart__grid" />
            <text x={sx(value)} y={M.top + PH + 22} textAnchor="middle" className="chart__tick">
              {value}
            </text>
          </g>
        ))}

        {isoLevels.map((level) => {
          const pointsForLine: string[] = [];
          for (let oxygen = 5; oxygen <= 100; oxygen += 2.5) {
            const pressure = (level * 100) / oxygen;
            if (pressure < 2 || pressure > 16) continue;
            pointsForLine.push(`${sx(pressure)},${sy(oxygen)}`);
          }
          if (pointsForLine.length < 2) return null;
          return <polyline key={level} points={pointsForLine.join(' ')} className="chart__iso" />;
        })}

        {points.map((point) => {
          const x = sx(Math.min(16, Math.max(2, point.pressure)));
          const y = sy(Math.min(100, Math.max(0, point.oxygen)));
          const isSelected = point.kind === 'selected';
          const anchor = x > W - 220 ? 'end' : 'start';
          const dx = anchor === 'end' ? -12 : 12;
          const dy = point.oxygen > 85 ? 20 : -12;
          return (
            <g key={point.label}>
              <title>
                {point.label}: {point.pressure} psia, {point.oxygen}% O2
              </title>
              {isSelected && (
                <>
                  <line x1={x} x2={x} y1={M.top} y2={M.top + PH} className="chart__crosshair" />
                  <line x1={M.left} x2={M.left + PW} y1={y} y2={y} className="chart__crosshair" />
                </>
              )}
              <circle
                cx={x}
                cy={y}
                r={isSelected ? 7 : 5}
                className={isSelected ? 'chart__point chart__point--selected' : 'chart__point'}
              />
              <text
                x={x + dx}
                y={y + dy}
                textAnchor={anchor}
                className={isSelected ? 'chart__label chart__label--selected' : 'chart__label'}
              >
                {point.label}
              </text>
            </g>
          );
        })}

        <text x={M.left + PW / 2} y={H - 10} textAnchor="middle" className="chart__axis">
          Total pressure (psia)
        </text>
        <text
          x={16}
          y={M.top + PH / 2}
          textAnchor="middle"
          transform={`rotate(-90 16 ${M.top + PH / 2})`}
          className="chart__axis"
        >
          Oxygen fraction (% by volume)
        </text>

        <g className="chart__unplottable">
          <rect x={M.left + PW - 262} y={M.top + 14} width={252} height={44} rx="2" />
          <text x={M.left + PW - 250} y={M.top + 33}>
            CORPUS RECORDS CANNOT BE PLACED HERE
          </text>
          <text x={M.left + PW - 250} y={M.top + 48} className="chart__unplottable-sub">
            0 / 131 report total pressure
          </text>
        </g>
      </svg>
      <div className="chart-legend" aria-hidden="true">
        <span className="chart-legend__title">Iso-lines · ppO2</span>
        <span><i /> 2.0 psi</span>
        <span><i /> 3.07 psi</span>
        <span><i /> 4.3 psi</span>
      </div>
      <figcaption>
        Iso-lines are Dalton-law composition references, not flammability boundaries. Reference
        points come from the challenge text and Earth fact sheet; the target point is user input.
      </figcaption>
    </figure>
  );
}

export function OxygenDistribution({ records }: { records: ExperimentRecord[] }) {
  const bins = oxygenHistogram(records).filter((bin) => bin.count > 0);
  const max = Math.max(1, ...bins.map((bin) => bin.count));
  return (
    <div className="histogram" role="img" aria-label="Histogram of initial oxygen fraction across experiment records">
      <div className="histogram__plot">
        {bins.map((bin) => (
          <div className="histogram__col" key={bin.from}>
            <div className="histogram__count">{bin.count}</div>
            <div
              className="histogram__bar"
              style={{ height: `${Math.max(4, (bin.count / max) * 100)}%` }}
              title={`${bin.from}–${bin.to}% O2: ${bin.count} records`}
            />
            <div className="histogram__label">{bin.from}</div>
          </div>
        ))}
      </div>
      <div className="histogram__axis">
        <span>Initial O2 (% by volume)</span>
        <span className="mono">n = {bins.reduce((sum, bin) => sum + bin.count, 0)}</span>
      </div>
    </div>
  );
}

export function CoverageBars({ fields }: { fields: FieldCoverage[] }) {
  return (
    <div className="coverage">
      {fields.map((field) => {
        const percent = field.total ? (field.count / field.total) * 100 : 0;
        const tone = percent === 0 ? 'zero' : percent < 40 ? 'low' : percent < 90 ? 'mid' : 'high';
        return (
          <div className="coverage__row" key={field.key}>
            <div className="coverage__label">
              <span>{field.label}</span>
              <span className="mono">
                {field.count}/{field.total}
              </span>
            </div>
            <div className="coverage__track">
              <div className={`coverage__fill coverage__fill--${tone}`} style={{ width: `${percent}%` }} />
            </div>
            <div className="coverage__note">{field.note}</div>
          </div>
        );
      })}
    </div>
  );
}
