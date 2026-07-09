import { LlmClient } from './llm-client';
import { MockLlmClient } from './mock-llm.client';

export const SUPPORTED_LLM_PROVIDERS = ['mock'] as const;

// Env-driven provider selection (add-insights-module design D3). Called from
// InsightsModule's LLM_CLIENT factory at bootstrap, so a bad LLM_PROVIDER
// fails startup fast instead of surfacing on the first summary request.
export function createLlmClient(provider: string): LlmClient {
  switch (provider) {
    case 'mock':
      return new MockLlmClient();
    default:
      throw new Error(
        `Unknown LLM_PROVIDER "${provider}". Supported providers: ` +
          `${SUPPORTED_LLM_PROVIDERS.join(', ')}.`,
      );
  }
}
