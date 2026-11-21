export {};
declare global { interface Window { bindVtuberSubtitles?: (audio: HTMLAudioElement, text: string, update: (text: string) => void) => void; } }
