import { beforeEach, describe, expect, it } from 'vitest';
import { useContentModeStore } from '../content-mode-store';

describe('playback layout lifecycle', () => {
  beforeEach(() => {
    useContentModeStore.getState().reset();
    useContentModeStore.getState().setEnabled('reading', true);
    useContentModeStore.getState().setEnabled('video', true);
  });
  it('enabling either layout does not start playback or leave chat', () => {
    const state = useContentModeStore.getState();
    state.setEnabled('reading', false);
    state.setEnabled('reading', true);
    state.setEnabled('video', false);
    state.setEnabled('video', true);
    expect(useContentModeStore.getState()).toMatchObject({ contentMode: 'normal', view: 'normal' });
  });
  it('selecting media waits for playback before activating the layout', () => {
    useContentModeStore.getState().setView('video');
    expect(useContentModeStore.getState().contentMode).toBe('normal');
    useContentModeStore.getState().setContentMode('video');
    expect(useContentModeStore.getState().contentMode).toBe('video');
  });
  it('returning to chat clears playback and retains both preferences', () => {
    useContentModeStore.getState().setEnabled('video', false);
    useContentModeStore.getState().setView('reading');
    useContentModeStore.getState().setContentMode('reading');
    useContentModeStore.getState().reset();
    expect(useContentModeStore.getState()).toMatchObject({ contentMode: 'normal', view: 'normal', readingEnabled: true, videoEnabled: false });
  });
});
