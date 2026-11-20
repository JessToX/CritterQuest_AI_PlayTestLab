export const PROVIDER_PRESETS = [
  {
    id: 'openai',
    label: 'OpenAI',
    kind: 'openai' as const,
    baseUrl: 'https://api.openai.com/v1',
  },
  {
    id: 'doubao',
    label: '豆包 / Doubao',
    kind: 'openai-compatible' as const,
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    kind: 'openai-compatible' as const,
    baseUrl: 'https://api.deepseek.com',
  },
  {
    id: 'xai',
    label: 'Grok / xAI',
    kind: 'openai-compatible' as const,
    baseUrl: 'https://api.x.ai/v1',
  },
  {
    id: 'anthropic',
    label: 'Claude / Anthropic',
    kind: 'anthropic' as const,
    baseUrl: 'https://api.anthropic.com/v1',
  },
] as const;
