import type { EvaluationFramework, EvaluationFrameworkId } from './types.js';
import { rawFramework } from './raw.js';
import { spaceFramework } from './space.js';

const frameworks: Record<EvaluationFrameworkId, EvaluationFramework> = {
  space: spaceFramework,
  raw: rawFramework,
};

export function getFramework(id?: string): EvaluationFramework {
  if (id && id in frameworks) {
    return frameworks[id as EvaluationFrameworkId];
  }
  return frameworks.space;
}

export function getFrameworkIds(): EvaluationFrameworkId[] {
  return Object.keys(frameworks) as EvaluationFrameworkId[];
}

/** Build full UseAI instructions text for injection into AI tool configs. */
export function buildInstructionsText(frameworkId?: string): string {
  const framework = getFramework(frameworkId);
  return [
    '## UseAI Session Tracking',
    '- At the START of every response to a **user message**, call `useai_start` with the appropriate task_type. Also generate a short session `title` (generic, no project names) and `private_title` (detailed, can include specifics) from the user\'s prompt.',
    '  - **task_type values**: coding, debugging, testing, planning, reviewing, documenting, learning, deployment, devops, research, migration, design, data, security, configuration, code_review, investigation, infrastructure, analysis, ops, setup, refactoring, other',
    '- To group multiple prompts in the same conversation, pass the `conversation_id` from the previous `useai_start` response (returned as `conversation_id=<value>`). Omit it for the first message or a new conversation.',
    '- For LONG sessions (15+ min), call `useai_heartbeat` periodically.',
    framework.getInstructionText(),
  ].join('\n');
}
