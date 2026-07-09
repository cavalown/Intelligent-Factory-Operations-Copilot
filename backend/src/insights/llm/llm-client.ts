// Provider-agnostic LLM boundary for the Insight Service
// (add-insights-module design D3). Adapters own turning provider output into
// LlmSummaryResult; unparseable output is an adapter failure, never a partial
// result.

export interface LlmSummaryResult {
  summary: string;
  recommendedActions: string[];
  model: string;
}

export interface LlmClient {
  generateSummary(prompt: string): Promise<LlmSummaryResult>;
}

export const LLM_CLIENT = Symbol('LLM_CLIENT');
