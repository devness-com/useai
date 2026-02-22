export interface APSComponents {
  output: number;          // 0-1: complexity-weighted milestones
  efficiency: number;      // 0-1: output relative to time spent
  promptQuality: number;   // 0-1: avg evaluation scores (framework-weighted)
  consistency: number;     // 0-1: active days / streak
  breadth: number;         // 0-1: unique languages, clients, tools
}

export interface APSResult {
  score: number;           // 0-1000 (local, absolute normalization)
  components: APSComponents;
  sessionCount: number;
  framework: string;
  window: { start: string; end: string };
}
