import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useConnectionStore } from '../connection-store';
import { useRuntimeStore } from '../runtime-store';
import { useSessionStore } from '../session-store';

describe('connection store', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads legacy JSON-encoded endpoints and persists the same format', () => {
    const values = new Map([
      ['wsUrl', '"ws://localhost:12393/client-ws"'],
      ['baseUrl', '"http://localhost:12393"'],
    ]);
    vi.stubGlobal('window', { localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    } });
    useConnectionStore.getState().reset();
    expect(useConnectionStore.getState().wsUrl).toBe('ws://localhost:12393/client-ws');
    expect(useConnectionStore.getState().baseUrl).toBe('http://localhost:12393');
    useConnectionStore.getState().setWsUrl('ws://example.test/client-ws');
    expect(JSON.parse(values.get('wsUrl')!)).toBe('ws://example.test/client-ws');
  });
  beforeEach(() => {
    useConnectionStore.getState().reset();
  });

  it('keeps the selected endpoints together with the latest connection state', () => {
    useConnectionStore.getState().setEndpoints(
      'ws://example.test/client-ws',
      'http://example.test',
    );
    useConnectionStore.getState().setWsState('OPEN');

    expect(useConnectionStore.getState()).toMatchObject({
      wsUrl: 'ws://example.test/client-ws',
      baseUrl: 'http://example.test',
      wsState: 'OPEN',
    });
  });
});

describe('session store', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
  });

  it('updates character identity and model as one backend session snapshot', () => {
    const modelInfo = {
      url: 'http://example.test/live2d/model3.json',
      kScale: 1,
      initialXshift: 0,
      initialYshift: 0,
      emotionMap: {},
    };

    useSessionStore.getState().setModelAndCharacter({
      clientUid: 'client-1',
      confName: 'Mili',
      confUid: 'mili-001',
      modelInfo,
    });

    expect(useSessionStore.getState()).toMatchObject({
      clientUid: 'client-1',
      confName: 'Mili',
      confUid: 'mili-001',
      modelInfo: { ...modelInfo, kScale: 2 },
    });
  });
});

describe('runtime store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useRuntimeStore.getState().reset();
  });

  it('does not let waiting replace an active response', () => {
    useRuntimeStore.getState().setAiState('thinking-speaking');
    useRuntimeStore.getState().setAiState('waiting');

    expect(useRuntimeStore.getState().aiState).toBe('thinking-speaking');
  });

  it('returns waiting to idle after two seconds', () => {
    useRuntimeStore.getState().setAiState('waiting');

    vi.advanceTimersByTime(2_000);

    expect(useRuntimeStore.getState().aiState).toBe('idle');
  });
});
