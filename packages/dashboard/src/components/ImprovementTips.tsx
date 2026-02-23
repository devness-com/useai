import { motion } from 'motion/react';
import { Lightbulb } from 'lucide-react';

interface EvaluationAverages {
  prompt_quality: number;
  context_provided: number;
  scope_quality: number;
  independence_level: number;
}

interface ImprovementTipsProps {
  evaluation: EvaluationAverages;
}

interface Tip {
  metric: string;
  score: number;
  message: string;
  priority: number;
}

function generateTips(evaluation: EvaluationAverages): Tip[] {
  const tips: Tip[] = [];

  if (evaluation.prompt_quality < 4) {
    tips.push({
      metric: 'Prompt Quality',
      score: evaluation.prompt_quality,
      priority: (4 - evaluation.prompt_quality) * 0.30,
      message:
        evaluation.prompt_quality < 3
          ? `Your prompt_quality score averages ${evaluation.prompt_quality.toFixed(1)}. Try including acceptance criteria and specific expected behavior in your prompts.`
          : `Your prompt_quality score averages ${evaluation.prompt_quality.toFixed(1)}. Adding edge cases and constraints to your prompts could push this higher.`,
    });
  }

  if (evaluation.context_provided < 4) {
    tips.push({
      metric: 'Context',
      score: evaluation.context_provided,
      priority: (4 - evaluation.context_provided) * 0.25,
      message:
        evaluation.context_provided < 3
          ? `Try providing more file context -- your context_provided score averages ${evaluation.context_provided.toFixed(1)}. Share relevant files, error logs, and constraints upfront.`
          : `Your context_provided score averages ${evaluation.context_provided.toFixed(1)}. Including related config files or architecture notes could help.`,
    });
  }

  if (evaluation.scope_quality < 4) {
    tips.push({
      metric: 'Scope',
      score: evaluation.scope_quality,
      priority: (4 - evaluation.scope_quality) * 0.20,
      message:
        evaluation.scope_quality < 3
          ? `Your scope_quality averages ${evaluation.scope_quality.toFixed(1)}. Try breaking large tasks into focused, well-defined subtasks before starting.`
          : `Your scope_quality averages ${evaluation.scope_quality.toFixed(1)}. Defining clear boundaries for what is in and out of scope could improve efficiency.`,
    });
  }

  if (evaluation.independence_level < 4) {
    tips.push({
      metric: 'Independence',
      score: evaluation.independence_level,
      priority: (4 - evaluation.independence_level) * 0.25,
      message:
        evaluation.independence_level < 3
          ? `Your independence_level averages ${evaluation.independence_level.toFixed(1)}. Providing a clear spec with decisions made upfront can reduce back-and-forth.`
          : `Your independence_level averages ${evaluation.independence_level.toFixed(1)}. Pre-deciding ambiguous choices in your prompt can help the AI execute autonomously.`,
    });
  }

  // Sort by priority (highest improvement potential first), take top 3
  tips.sort((a, b) => b.priority - a.priority);
  return tips.slice(0, 3);
}

function getScoreColor(score: number): string {
  if (score >= 4) return 'text-success';
  if (score >= 3) return 'text-accent';
  return 'text-warning';
}

export function ImprovementTips({ evaluation }: ImprovementTipsProps) {
  const tips = generateTips(evaluation);

  if (tips.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-xl bg-bg-surface-1 border border-border/50 p-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-success/10">
            <Lightbulb className="w-3.5 h-3.5 text-success" />
          </div>
          <h2 className="text-sm font-bold text-text-muted uppercase tracking-widest">
            Tips
          </h2>
        </div>
        <p className="text-xs text-success">
          All evaluation scores are 4+ -- great work! Keep it up.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-xl bg-bg-surface-1 border border-border/50 p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-bg-surface-2">
          <Lightbulb className="w-3.5 h-3.5 text-accent" />
        </div>
        <h2 className="text-sm font-bold text-text-muted uppercase tracking-widest">
          Improvement Tips
        </h2>
      </div>

      <ul className="space-y-3">
        {tips.map((tip, index) => (
          <motion.li
            key={tip.metric}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 + index * 0.08 }}
            className="flex gap-3"
          >
            <div className="flex flex-col items-center shrink-0 mt-0.5">
              <span className={`text-xs font-mono font-bold ${getScoreColor(tip.score)}`}>
                {tip.score.toFixed(1)}
              </span>
              <span className="text-[8px] text-text-muted font-mono uppercase">/5</span>
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
                {tip.metric}
              </span>
              <p className="text-xs text-text-secondary leading-relaxed mt-0.5">
                {tip.message}
              </p>
            </div>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}
