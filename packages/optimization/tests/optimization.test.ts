import { loadConfig } from '@greenclaw/config';
import { describe, expect, it } from 'vitest';
import { classify } from '../src/classifier/index.js';
import { compact } from '../src/compactor/index.js';
import { route, shouldAutoRoute } from '../src/router/index.js';

describe('optimization', () => {
  it('forces HEARTBEAT when heartbeat signals are present', () => {
    const tier = classify(
      [
        { role: 'system', content: 'HEARTBEAT synthetic monitor.' },
        { role: 'user', content: 'ping' },
      ],
      'auto',
    );

    expect(tier).toBe('HEARTBEAT');
  });

  it('never classifies a more complex prompt below a simpler baseline', () => {
    const simpleTier = classify(
      [{ role: 'user', content: 'What is the capital of New Zealand?' }],
      'auto',
    );
    const complexTier = classify(
      [
        {
          role: 'system',
          content:
            'You are a multi-agent orchestration coordinator with sub-agents for testing and deployment.',
        },
        { role: 'user', content: 'Coordinate a complex software delivery workflow.' },
      ],
      'auto',
    );

    expect(simpleTier).toBe('SIMPLE');
    expect(complexTier).toBe('COMPLEX');
  });

  it('biases uncertain prompts upward to MODERATE', () => {
    const tier = classify([{ role: 'user', content: 'Please take a look.' }], 'gpt-4.1');

    expect(tier).toBe('MODERATE');
  });

  it('routes auto models through the configured tier mapping and preserves explicit models', () => {
    const config = loadConfig({});

    expect(shouldAutoRoute('auto')).toBe(true);
    expect(route('MODERATE', config, 'auto')).toEqual(config.routingModels.MODERATE);
    expect(route('COMPLEX', config, 'gpt-4.1')).toEqual({
      provider: config.routingModels.COMPLEX.provider,
      model: 'gpt-4.1',
    });
  });

  it('keeps compaction as a pass-through until summarization rules exist', () => {
    const messages = [
      { role: 'system', content: 'system guardrail' },
      { role: 'user', content: 'older message' },
      { role: 'assistant', content: 'response' },
      { role: 'user', content: 'latest message' },
    ];
    const result = compact(messages, 10);

    expect(result.messages).toBe(messages);
    expect(result.applied).toBe(false);
    expect(result.messages[0]).toEqual(messages[0]);
    expect(result.messages[result.messages.length - 1]).toEqual(messages[messages.length - 1]);
  });
});
