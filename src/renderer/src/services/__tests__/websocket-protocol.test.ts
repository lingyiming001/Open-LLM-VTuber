import { beforeEach, describe, expect, it } from 'vitest';
import { useConnectionStore } from '@/stores/connection-store';
import { useRuntimeStore } from '@/stores/runtime-store';
import { useSessionStore } from '@/stores/session-store';
import { applyWebSocketStoreUpdate } from '../websocket-protocol';

describe('applyWebSocketStoreUpdate', () => {
  beforeEach(() => {
    useConnectionStore.getState().reset();
    useSessionStore.getState().reset();
    useRuntimeStore.getState().reset();
    useConnectionStore.getState().setBaseUrl('http://localhost:12393');
  });

  it('normalizes a relative model URL before updating the session snapshot', () => {
    applyWebSocketStoreUpdate({
      type: 'set-model-and-conf',
      client_uid: 'client-1',
      conf_name: 'Mili',
      conf_uid: 'mili-001',
      model_info: {
        url: '/live2d-models/mili/model3.json',
        kScale: 1,
        initialXshift: 0,
        initialYshift: 0,
        emotionMap: {},
      },
    });

    expect(useSessionStore.getState()).toMatchObject({
      clientUid: 'client-1',
      confName: 'Mili',
      confUid: 'mili-001',
      modelInfo: { url: 'http://localhost:12393/live2d-models/mili/model3.json' },
    });
  });

  it('keeps the current client identity when a character switch omits it', () => {
    useSessionStore.getState().setModelAndCharacter({
      clientUid: 'client-1',
      confName: 'Old',
      confUid: 'old-001',
      modelInfo: {
        url: 'http://localhost:12393/live2d-models/old/model3.json',
        kScale: 1,
        initialXshift: 0,
        initialYshift: 0,
        emotionMap: {},
      },
    });

    applyWebSocketStoreUpdate({
      type: 'set-model-and-conf',
      conf_name: 'New',
      conf_uid: 'new-001',
      model_info: {
        url: '/live2d-models/new/model3.json',
        kScale: 1,
        initialXshift: 0,
        initialYshift: 0,
        emotionMap: {},
      },
    });

    expect(useSessionStore.getState()).toMatchObject({
      clientUid: 'client-1',
      confName: 'New',
      confUid: 'new-001',
    });
  });

  it('updates runtime state only for a recognized store event', () => {
    applyWebSocketStoreUpdate({ type: 'full-text', text: '你好' });
    const handled = applyWebSocketStoreUpdate({ type: 'unknown-event', text: 'ignore' });

    expect(useRuntimeStore.getState().subtitleText).toBe('你好');
    expect(handled).toBe(false);
  });

  it('resolves a relative model URL without requiring a leading slash', () => {
    applyWebSocketStoreUpdate({
      type: 'set-model-and-conf',
      client_uid: 'client-1',
      conf_name: 'Mili',
      conf_uid: 'mili-001',
      model_info: {
        url: 'live2d-models/mili/model3.json',
        kScale: 1,
        initialXshift: 0,
        initialYshift: 0,
        emotionMap: {},
      },
    });

    expect(useSessionStore.getState().modelInfo?.url)
      .toBe('http://localhost:12393/live2d-models/mili/model3.json');
  });
});
