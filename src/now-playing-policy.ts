// Registering Media* global shortcuts on macOS makes Electron disable its own
// system media controls. Those controls are what publish this app to Now
// Playing, which is the menu bar and Control Center surface Spotify uses.
export function usesSystemNowPlaying(platform: string): boolean {
  return platform === "darwin";
}
