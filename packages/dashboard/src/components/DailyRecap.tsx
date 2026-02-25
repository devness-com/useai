import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';

interface DailyRecapProps {
  sessions: number;
  hours: number;
  features: number;
  bugs: number;
  complex: number;
  topLanguage: string;
  topClient: string;
  peakHour: string;
}

function Strong({ children }: { children: React.ReactNode }) {
  return <span className="text-text-primary font-semibold">{children}</span>;
}

function buildRecap(props: DailyRecapProps): React.ReactNode {
  const { sessions, hours, features, bugs, complex, topLanguage, topClient, peakHour } = props;

  if (sessions === 0) {
    return <span className="text-text-muted">No sessions recorded today.</span>;
  }

  const parts: React.ReactNode[] = [];

  // Sessions and hours
  const hoursStr = hours < 1 ? `${Math.round(hours * 60)}` : hours.toFixed(1);
  const hoursUnit = hours < 1 ? 'min' : 'hrs';
  parts.push(
    <span key="core">
      Today: <Strong>{sessions}</Strong> {sessions === 1 ? 'session' : 'sessions'},{' '}
      <Strong>{hoursStr}</Strong> {hoursUnit}
    </span>,
  );

  // Features and bugs
  const shipParts: string[] = [];
  if (features > 0) {
    const complexNote = complex > 0 ? ` (${complex} complex)` : '';
    shipParts.push(`shipped ${features} ${features === 1 ? 'feature' : 'features'}${complexNote}`);
  }
  if (bugs > 0) {
    shipParts.push(`fixed ${bugs} ${bugs === 1 ? 'bug' : 'bugs'}`);
  }

  if (shipParts.length > 0) {
    parts.push(
      <span key="ship"> &mdash; {shipParts.join(', ')}</span>,
    );
  }

  // Peak hour
  if (peakHour) {
    parts.push(
      <span key="peak">
        . Most active: <Strong>{peakHour}</Strong>
      </span>,
    );
  }

  // Language and client
  if (topLanguage || topClient) {
    const primaryParts: string[] = [];
    if (topLanguage) primaryParts.push(topLanguage);
    if (topClient) primaryParts.push(`with ${topClient}`);

    parts.push(
      <span key="primary">
        . Primary: <Strong>{primaryParts.join(' ')}</Strong>
      </span>,
    );
  }

  parts.push(<span key="end">.</span>);

  return <>{parts}</>;
}

export function DailyRecap(props: DailyRecapProps) {
  const recap = buildRecap(props);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-xl bg-bg-surface-1 border border-border/50 px-4 py-3"
    >
      <div className="flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
        <p className="text-sm text-text-secondary leading-relaxed">{recap}</p>
      </div>
    </motion.div>
  );
}
