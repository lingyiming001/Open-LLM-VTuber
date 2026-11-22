/* eslint-disable no-shadow */
// import { StrictMode } from 'react';
import { Box, Flex, ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { lazy, Suspense, useState, useEffect, useRef } from "react";
// import Canvas from './components/canvas/canvas'; // Likely unused now
import Sidebar from "./components/sidebar/sidebar";
import Footer from "./components/footer/footer";
import { useBgUrl } from "./context/bgurl-context";
import { BgUrlProvider } from "./context/bgurl-context";
import { layoutStyles } from "./layout";
import WebSocketHandler from "./services/websocket-handler";
import { CameraProvider } from "./context/camera-context";
import { ChatHistoryProvider } from "./context/chat-history-context";
import { Toaster } from "./components/ui/toaster";
import { VADProvider } from "./context/vad-context";
import TitleBar from "./components/electron/title-bar";
import { InputSubtitle } from "./components/electron/input-subtitle";
import { ProactiveSpeakProvider } from "./context/proactive-speak-context";
import { ScreenCaptureProvider } from "./context/screen-capture-context";
import { GroupProvider } from "./context/group-context";
import { BrowserProvider } from "./context/browser-context";
// eslint-disable-next-line import/no-extraneous-dependencies, import/newline-after-import
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import Background from "./components/canvas/background";
import WebSocketStatus from "./components/canvas/ws-status";
import Subtitle from "./components/canvas/subtitle";
import { ModeProvider, useMode } from "./context/mode-context";

import { useCharacterDock } from "./components/sidebar/character-dock";
import VideoPanel from "./components/sidebar/video-panel";
import BookReader from "./components/canvas/book-reader";
import { useContentModeStore } from "./stores/content-mode-store";

const Live2D = lazy(async () => {
  const module = await import("./components/canvas/live2d");
  return { default: module.Live2D };
});

function AppContent(): JSX.Element {
  const { contentMode, view, readingEnabled, videoEnabled, setView, videoFit } = useContentModeStore();
  const readingMode = contentMode === 'reading' && readingEnabled;
  const videoMode = contentMode === 'video' && videoEnabled;
  useEffect(() => {
    const openVideo = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.action === 'play' && detail?.kind === 'videos') setView('video');
    };
    const returnToChat = (event: KeyboardEvent) => { if (event.key === 'Escape') useContentModeStore.getState().reset(); };
    window.addEventListener('vtuber-stage-action', openVideo);
    window.addEventListener('keydown', returnToChat);
    return () => { window.removeEventListener('vtuber-stage-action', openVideo); window.removeEventListener('keydown', returnToChat); };
  }, []);
  const { backgroundUrl } = useBgUrl();
  const dockRect = useCharacterDock((state) => state.rect);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isFooterCollapsed, setIsFooterCollapsed] = useState(false);
  const { mode } = useMode();
  const isElectron = window.api !== undefined;
  const live2dContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

    
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  document.documentElement.style.height = '100%';
  document.body.style.height = '100%';
  document.documentElement.style.position = 'fixed';
  document.body.style.position = 'fixed';
  document.documentElement.style.width = '100%';
  document.body.style.width = '100%';

  // Define base style properties shared across modes/breakpoints
  const live2dBaseStyle = {
    position: "absolute" as const,
    overflow: "hidden",
    transition: "all 0.3s ease-in-out", // Optional transition
    pointerEvents: "auto" as const,
  };

  // Define styles specifically for the "window" mode, using responsive syntax
  const getResponsiveLive2DWindowStyle = (sidebarVisible: boolean) => ({
    ...live2dBaseStyle,
    top: isElectron ? "30px" : "0px",
    height: `calc(100% - ${isElectron ? "30px" : "0px"})`,
    zIndex: 5, // Ensure it's layered correctly below UI but above background
    left: {
      base: "0px", // Column layout (base): Start from left edge
      md: sidebarVisible ? "440px" : "24px", // Row layout (md+): Offset by sidebar width
    },
    width: {
      base: "100%", // Column layout (base): Full width
      md: `calc(100% - ${sidebarVisible ? "440px" : "24px"})`, // Row layout (md+): Adjust width based on sidebar
    },
  });

  // Define styles specifically for the "pet" mode
  const live2dPetStyle = {
    ...live2dBaseStyle,
    top: 0, // Override position for pet mode
    left: 0,
    width: "100vw", // Full viewport
    height: "100vh",
    zIndex: 15, // Higher zIndex for pet mode overlay
  };

  return (
    <>
      <Box
        ref={live2dContainerRef}
        // Apply styles conditionally based on mode
        // Use the function to get dynamic responsive styles for window mode
        {...(mode === "window" && (readingMode || videoMode) ? { ...live2dBaseStyle, position: "fixed" as const, transition: "none", top: `${dockRect?.top ?? 0}px`, left: `${dockRect?.left ?? 0}px`, width: `${dockRect?.width ?? 0}px`, height: `${dockRect?.height ?? 0}px`, visibility: dockRect ? "visible" : "hidden", zIndex: 12, borderRadius: "8px", border: "1px solid var(--vt-border)", bg: "var(--vt-surface)" } : mode === "window"
          ? getResponsiveLive2DWindowStyle(showSidebar)
          : live2dPetStyle)}
      >
        {mode === "window" && (readingMode || videoMode) && (
          <Box position="absolute" inset="0" backgroundImage={`url(${JSON.stringify(backgroundUrl)})`} backgroundSize="cover" backgroundPosition="center" pointerEvents="none" />
        )}
        <Suspense fallback={null}>
          <Live2D />
        </Suspense>
      </Box>

      {/* Conditional Rendering of Window UI */}
      {mode === "window" && (
        <>
          {isElectron && <TitleBar />}
          {/* Apply styles by spreading */}
          <Flex {...layoutStyles.appContainer}>
            <Box
              {...layoutStyles.sidebar}
              {...(!showSidebar && { width: "24px" })}
            >
              <Sidebar
                isCollapsed={!showSidebar}
                onToggle={() => setShowSidebar(!showSidebar)}
              />
            </Box>
            <Box {...layoutStyles.mainContent}>
              <Background />
              <Box position="absolute" top="0" left="0" right="0" bottom={{ base: isFooterCollapsed ? '20px' : '100px', md: isFooterCollapsed ? '24px' : '120px' }}>
                <Box position="absolute" inset="0" display={view === 'reading' ? 'block' : 'none'}><BookReader /></Box>
                <VideoPanel expanded={view === 'video'} fit={videoFit} />
              </Box>
              <Box position="absolute" top="20px" left="20px" zIndex={10}>
                <WebSocketStatus />
              </Box>
              <Box
                position="absolute"
                bottom={isFooterCollapsed ? "39px" : "135px"}
                left="50%"
                transform="translateX(-50%)"
                zIndex={10}
                width="60%"
                pointerEvents="none"
              >
                <Subtitle />
              </Box>
              <Box
                {...layoutStyles.footer}
                position="absolute"
                bottom="0"
                flexShrink={0}
                zIndex={10}
                {...(isFooterCollapsed && layoutStyles.collapsedFooter)}
              >
                <Footer
                  isCollapsed={isFooterCollapsed}
                  onToggle={() => setIsFooterCollapsed(!isFooterCollapsed)}
                />
              </Box>
            </Box>
          </Flex>
        </>
      )}

      {/* Conditional Rendering of Pet Mode UI */}
      {mode === "pet" && <InputSubtitle />}
    </>
  );
}

function App(): JSX.Element {
  return (
    <ChakraProvider value={defaultSystem}>
      {/* ModeProvider needs to wrap AppContent to provide mode to getGlobalStyles */}
      <ModeProvider>
        <AppWithGlobalStyles />
      </ModeProvider>
    </ChakraProvider>
  );
}

// New component to access mode for global styles
function AppWithGlobalStyles(): JSX.Element {
  return (
    <>
      <CameraProvider>
        <ScreenCaptureProvider>
          <ChatHistoryProvider>
            <ProactiveSpeakProvider>
              <VADProvider>
                <BgUrlProvider>
                  <GroupProvider>
                    <BrowserProvider>
                      <WebSocketHandler>
                        <Toaster />
                        <AppContent />
                      </WebSocketHandler>
                    </BrowserProvider>
                  </GroupProvider>
                </BgUrlProvider>
              </VADProvider>
            </ProactiveSpeakProvider>
          </ChatHistoryProvider>
        </ScreenCaptureProvider>
      </CameraProvider>
    </>
  );
}

export default App;
