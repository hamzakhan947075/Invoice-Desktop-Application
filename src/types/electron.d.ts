interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  checkForUpdates: () => Promise<{ status: string; message?: string }>;
}

declare interface Window {
  electronAPI?: ElectronAPI;
}
