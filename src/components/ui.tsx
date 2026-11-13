import type { ReactNode } from 'react';
import type { DataValue, ValueStatus } from '../lib/types';
import { formatCompact, statusLabel, statusTone } from '../lib/format';

export function Badge({
  children,
  tone = 'neutral',
  dot = false,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'ember' | 'mint' | 'amber' | 'red' | 'muted';
  dot?: boolean;
}) {
  return (
    <span className={`badge badge--${tone}`}>
      {dot && <span className="badge__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: ValueStatus }) {
  const tone = statusTone(status);
  const map = {
    reported: 'mint',
    derived: 'amber',
    context: 'neutral',
    warning: 'red',
    missing: 'muted',
  } as const;
  return <Badge tone={map[tone]}>{statusLabel(status)}</Badge>;
}

export function PageHeader({
  index,
  eyebrow,
  title,
  lede,
  actions,
}: {
  index: string;
  eyebrow: string;
  title: ReactNode;
  lede: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header__meta">
        <span className="index-mark">{index}</span>
        <span className="eyebrow">{eyebrow}</span>
      </div>
      <div className="page-header__row">
        <h1>{title}</h1>
        {actions && <div className="page-header__actions">{actions}</div>}
      </div>
      <p className="lede">{lede}</p>
    </header>
  );
}

export function Panel({
  title,
  kicker,
  actions,
  children,
  className = '',
  as = 'section',
}: {
  title?: ReactNode;
  kicker?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article';
}) {
  const Tag = as;
  return (
    <Tag className={`panel ${className}`.trim()}>
      {(title || kicker || actions) && (
        <div className="panel__head">
          <div>
            {kicker && <div className="kicker">{kicker}</div>}
            {title && <h2 className="panel__title">{title}</h2>}
          </div>
          {actions && <div className="panel__actions">{actions}</div>}
        </div>
      )}
      <div className="panel__body">{children}</div>
    </Tag>
  );
}

export function Stat({
  value,
  label,
  detail,
  tone = 'paper',
}: {
  value: ReactNode;
  label: string;
  detail?: ReactNode;
  tone?: 'paper' | 'ember' | 'mint' | 'amber' | 'muted';
}) {
  return (
    <div className={`stat stat--${tone}`}>
      <div className="stat__value">{value}</div>
      <div className="stat__label">{label}</div>
      {detail && <div className="stat__detail">{detail}</div>}
    </div>
  );
}

export function DataCell({
  data,
  label,
  unit,
}: {
  data: DataValue;
  label?: string;
  unit?: string;
}) {
  const missing = data.value === null || data.value === undefined;
  return (
    <div className={`data-cell ${missing ? 'is-missing' : ''}`}>
      {label && <div className="data-cell__label">{label}</div>}
      <div className="data-cell__value">{missing ? 'Not reported' : formatCompact(data, unit)}</div>
      <div className="data-cell__meta">
        <StatusBadge status={data.status} />
        {data.raw && !missing && <span className="raw-inline">raw: {data.raw}</span>}
      </div>
      {data.note && <p className="data-cell__note">{data.note}</p>}
    </div>
  );
}

export function Callout({
  title,
  children,
  tone = 'neutral',
  icon,
}: {
  title: string;
  children: ReactNode;
  tone?: 'neutral' | 'ember' | 'mint' | 'amber';
  icon?: ReactNode;
}) {
  return (
    <div className={`callout callout--${tone}`}>
      {icon && <div className="callout__icon">{icon}</div>}
      <div>
        <div className="callout__title">{title}</div>
        <div className="callout__body">{children}</div>
      </div>
    </div>
  );
}

export function SourceLink({
  href,
  children,
  quiet = false,
}: {
  href: string;
  children: ReactNode;
  quiet?: boolean;
}) {
  return (
    <a
      className={`source-link ${quiet ? 'source-link--quiet' : ''}`}
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {children}
      <span aria-hidden="true"> ↗</span>
    </a>
  );
}

export function SectionRule({ label, meta }: { label: string; meta?: string }) {
  return (
    <div className="section-rule">
      <span className="kicker">{label}</span>
      <span className="section-rule__line" />
      {meta && <span className="section-rule__meta">{meta}</span>}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-state__mark">∅</div>
      <div>
        <h3>{title}</h3>
        <div className="muted">{children}</div>
      </div>
    </div>
  );
}

export function Arrow({ direction = 'right' }: { direction?: 'right' | 'down' | 'up-right' }) {
  const glyph = direction === 'down' ? '↓' : direction === 'up-right' ? '↗' : '→';
  return <span aria-hidden="true">{glyph}</span>;
}
