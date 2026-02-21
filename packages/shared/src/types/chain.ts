export interface ChainRecord {
  id: string;
  type: 'session_start' | 'heartbeat' | 'session_end' | 'session_seal' | 'milestone';
  session_id: string;
  timestamp: string;
  data: Record<string, unknown>;
  prev_hash: string;
  hash: string;
  signature: string;
}

export interface SessionEvaluation {
  prompt_quality: number;       // 1-5: clarity and specificity of the initial request
  prompt_quality_reason?: string; // why this score was given + tip to improve
  context_provided: number;     // 1-5: did user provide files, errors, constraints?
  context_provided_reason?: string;
  task_outcome: 'completed' | 'partial' | 'abandoned' | 'blocked';
  task_outcome_reason?: string; // why the task wasn't completed (for non-completed outcomes)
  iteration_count: number;      // user↔AI turns in this session
  independence_level: number;   // 1-5: how self-directed was the user?
  independence_level_reason?: string;
  scope_quality: number;        // 1-5: was the task well-scoped?
  scope_quality_reason?: string;
  tools_leveraged: number;      // count of distinct AI capabilities used
}

export interface ToolOverhead {
  start: { input_tokens_est: number; output_tokens_est: number };
  end: { input_tokens_est: number; output_tokens_est: number };
  total_tokens_est: number;
}

export interface SessionSeal {
  session_id: string;
  conversation_id?: string;
  conversation_index?: number;
  client: string;
  task_type: string;
  languages: string[];
  files_touched: number;
  project?: string;
  title?: string;
  private_title?: string;
  prompt_word_count?: number;
  model?: string;
  evaluation?: SessionEvaluation;
  tool_overhead?: ToolOverhead;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  heartbeat_count: number;
  record_count: number;
  chain_start_hash: string;
  chain_end_hash: string;
  seal_signature: string;
}
