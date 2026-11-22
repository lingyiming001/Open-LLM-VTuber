/** Stable cache boundaries shared by the web and Electron renderer builds. */
export function rendererChunk(id: string): string | undefined {
  // Keep CommonJS interop helpers with React to avoid a vendor -> entry -> React cycle.
  if (id.includes('commonjsHelpers')) return 'react';
  if (id.includes('/WebSDK/')) return 'live2d-sdk';
  if (!id.includes('/node_modules/')) return undefined;
  if (id.includes('/onnxruntime-') || id.includes('/@ricky0123/')) return 'vad-runtime';
  if (id.includes('/@chakra-ui/') || id.includes('/@ark-ui/') || id.includes('/@zag-js/')) return 'ui-system';
  if (id.includes('/framer-motion/') || id.includes('/motion-')) return 'motion';
  if (id.includes('/@chatscope/')) return 'chat-ui';
  if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) return 'react';
  return undefined;
}
