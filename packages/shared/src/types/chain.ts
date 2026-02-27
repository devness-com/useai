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
  prompt_quality_reason?: string; // always provide: why this score was given
  context_provided: number;     // 1-5: did user provide files, errors, constraints?
  context_provided_reason?: string;
  task_outcome: 'completed' | 'partial' | 'abandoned' | 'blocked';
  task_outcome_reason?: string; // always provide: what was accomplished or what blocked progress
  iteration_count: number;      // user↔AI turns in this session
  independence_level: number;   // 1-5: how self-directed was the user?
  independence_level_reason?: string;
  scope_quality: number;        // 1-5: was the task well-scoped?
  scope_quality_reason?: string;
  tools_leveraged: number;      // count of distinct AI capabilities used
  session_score?: number;           // 0-100, computed by active framework
  evaluation_framework?: string;    // which framework computed the score
}

export interface SessionSeal {
  session_id: string;
  /** Parent session ID when this is a child (subagent) session. */
  parent_session_id?: string;
  conversation_id?: string;
  conversation_index?: number;
  client: string;
  task_type: string;
  languages: string[];
  files_touched: number;
  project?: string;
  title?: string;
  private_title?: string;
  prompt?: string;              // Full verbatim prompt (local-only by default)
  prompt_image_count?: number;  // Number of images attached to prompt
  prompt_images?: Array<{ type: 'image'; description: string }>;  // Image descriptions from prompt
  prompt_word_count?: number;
  model?: string;
  evaluation?: SessionEvaluation;
  session_score?: number;           // 0-100
  evaluation_framework?: string;    // 'raw' | 'space' | ...
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  heartbeat_count: number;
  record_count: number;
  chain_start_hash: string;
  chain_end_hash: string;
  seal_signature: string;
}
