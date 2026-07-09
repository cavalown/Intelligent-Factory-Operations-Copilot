import { LlmClient, LlmSummaryResult } from './llm-client';

// Built-in no-key provider so the whole pipeline (context gathering,
// persistence, endpoints, demo) runs without an external LLM. A real provider
// adapter replaces this via LLM_PROVIDER — the provider decision was
// deliberately deferred (design.md, Open Questions).
export class MockLlmClient implements LlmClient {
  async generateSummary(prompt: string): Promise<LlmSummaryResult> {
    const promptLines = prompt.split('\n').length;
    return Promise.resolve({
      summary:
        `[Mock summary] Generated without an LLM call from a context of ` +
        `${promptLines} prompt lines. Configure LLM_PROVIDER with a real ` +
        `provider to get genuine operational insights.`,
      recommendedActions: [
        'Configure a real LLM provider (LLM_PROVIDER / LLM_API_KEY / LLM_MODEL).',
        'Review recent events and active alerts directly in the dashboard.',
      ],
      model: 'mock',
    });
  }
}
