import { PROVIDER_PRESETS } from '@/lib/agents/presets';
import type { Seat } from '@/lib/playtest/types';
export const presets = [
  ...PROVIDER_PRESETS,
  {
    id: 'custom',
    label: '自定义兼容 API',
    kind: 'openai-compatible' as const,
    baseUrl: '',
  },
];
export const initialSeats: Seat[] = Array.from({ length: 4 }, (_, i) => ({
  enabled: i < 3,
  profile: {
    id: 'seat-' + i,
    name: 'Agent ' + String.fromCharCode(65 + i),
    providerId: presets[i].id,
    model: '',
    customInstructions: '',
    memoryMode: 'active',
  },
  connection: {
    id: presets[i].id,
    label: presets[i].label,
    kind: presets[i].kind,
    baseUrl: presets[i].baseUrl,
    apiKey: '',
  },
}));
