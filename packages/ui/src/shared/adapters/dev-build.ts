export const isDevBuild = (): boolean =>
  (window as { ivin?: Window["ivin"] }).ivin?.devBuild === true
