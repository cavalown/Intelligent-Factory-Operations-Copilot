import { createLlmClient } from './llm-client.factory';
import { MockLlmClient } from './mock-llm.client';

describe('createLlmClient', () => {
  it('returns the mock client for LLM_PROVIDER=mock', () => {
    expect(createLlmClient('mock')).toBeInstanceOf(MockLlmClient);
  });

  it('fails fast on an unknown provider, naming it and the supported set', () => {
    expect(() => createLlmClient('bogus')).toThrow(
      'Unknown LLM_PROVIDER "bogus". Supported providers: mock.',
    );
  });
});
