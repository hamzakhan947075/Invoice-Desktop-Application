import { contextBridge, ipcRenderer } from "electron";

/**
 * The renderer is just the Next.js app loaded over plain HTTP — it has no
 * other way to reach the Electron main process (which owns app.getVersion()
 * and electron-updater). This is the one deliberate exception to that,
 * exposed narrowly via contextBridge rather than turning on nodeIntegration.
 */
contextBridge.exposeInMainWorld("electronAPI", {
  getAppVersion: (): Promise<string> => ipcRenderer.invoke("get-app-version"),
  checkForUpdates: (): Promise<{ status: string; message?: string }> =>
    ipcRenderer.invoke("check-for-updates"),
});
