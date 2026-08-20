import { app, BrowserWindow, dialog, Menu, Tray, nativeImage, ipcMain, type MenuItemConstructorOptions } from "electron";
import { autoUpdater } from "electron-updater";
import { spawn, type ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import http from "http";
import net from "net";
import { runMigrations } from "./migrate";

// A second launch should just focus the existing window, not spawn a
// second server against the same DB/port.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

const DEV_PORT = 5175;
const PROD_PORT = 47890;

let serverProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let baseUrl: string | null = null;
// Closing the window minimizes to tray; only the tray/menu "Quit" item (or a
// real OS shutdown, via before-quit) should let the window actually close.
let isQuitting = false;

function logFatal(message: string) {
  try {
    const logPath = path.join(app.getPath("userData"), "startup-error.log");
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
  } catch {
    // Best-effort only — never let logging itself crash startup.
  }
}

// A crash anywhere outside the main startup try/catch (e.g. an unhandled
// 'error' event on the spawned server's ChildProcess) would otherwise throw
// and take the whole process down with no dialog and no log — exactly what
// "the app just closes" looks like from the outside. This is the last resort.
process.on("uncaughtException", (error) => {
  logFatal(`Uncaught exception: ${error instanceof Error ? error.stack : String(error)}`);
  try {
    dialog.showErrorBox("InvoiceFlow crashed", String(error));
  } catch {
    // dialog may not be available this early/late in shutdown — nothing more we can do.
  }
});

/** Centralizes the dev-vs-packaged path branching flagged as an easy-to-miss bug class. */
function getResourcePath(...segments: string[]): string {
  const base = app.isPackaged ? process.resourcesPath : path.join(__dirname, "..");
  return path.join(base, ...segments);
}

function waitForServer(url: string, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.destroy();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Server at ${url} did not respond within ${timeoutMs}ms`));
        } else {
          setTimeout(attempt, 300);
        }
      });
    };
    attempt();
  });
}

/** Checks whether a local TCP port is free by briefly binding to it. */
function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once("error", () => resolve(false));
    tester.once("listening", () => tester.close(() => resolve(true)));
    tester.listen(port, "127.0.0.1");
  });
}

/** Finds a free port at or after `startPort`, so a machine with something already bound to the default doesn't crash-loop trying to reuse it. */
async function findFreePort(startPort: number, maxAttempts = 20): Promise<number> {
  for (let port = startPort; port < startPort + maxAttempts; port++) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port found in range ${startPort}-${startPort + maxAttempts}`);
}

const MAX_AUTO_BACKUPS = 5;

/** Copies the current db into userData/backups/ and prunes anything past the last MAX_AUTO_BACKUPS, so a bad session has a way back that isn't the user having to remember to click "Download backup" first. */
function rotateAutoBackup(dbPath: string, dataDir: string) {
  if (!fs.existsSync(dbPath)) return; // nothing to back up yet — first launch.

  try {
    const backupsDir = path.join(dataDir, "backups");
    fs.mkdirSync(backupsDir, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.copyFileSync(dbPath, path.join(backupsDir, `invoiceflow-${stamp}.db`));

    const existing = fs
      .readdirSync(backupsDir)
      .filter((name) => name.endsWith(".db"))
      .sort();
    for (const name of existing.slice(0, Math.max(0, existing.length - MAX_AUTO_BACKUPS))) {
      fs.unlinkSync(path.join(backupsDir, name));
    }
  } catch (error) {
    logFatal(`Auto-backup rotation failed (non-fatal): ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function startPackagedServer(): Promise<string> {
  const userData = app.getPath("userData");
  const dataDir = path.join(userData, "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "invoiceflow.db");
  const databaseUrl = `file:${dbPath}`;

  const uploadsDir = path.join(userData, "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });

  // A restore uploaded via Settings is staged here (the live db file can't
  // be overwritten while this process has it open, especially on Windows) —
  // swap it in now, before anything opens the real db file for this launch.
  const pendingRestorePath = path.join(dataDir, "restore-pending.db");
  if (fs.existsSync(pendingRestorePath)) {
    if (fs.existsSync(dbPath)) {
      const backupPath = path.join(dataDir, `pre-restore-${Date.now()}.db`);
      fs.renameSync(dbPath, backupPath);
      logFatal(`Restoring backup: previous database saved to ${backupPath}`);
    }
    fs.renameSync(pendingRestorePath, dbPath);
    for (const suffix of ["-wal", "-shm"]) {
      try {
        fs.unlinkSync(dbPath + suffix);
      } catch {
        // No WAL/SHM sidecar file to remove — fine.
      }
    }
  }

  rotateAutoBackup(dbPath, dataDir);

  const migrationsDir = getResourcePath("prisma", "migrations");
  await runMigrations(databaseUrl, migrationsDir);

  const serverEntry = getResourcePath("standalone", "server.js");
  if (!fs.existsSync(serverEntry)) {
    throw new Error(`Server entry not found at ${serverEntry}`);
  }

  const port = await findFreePort(PROD_PORT);

  return new Promise<string>((resolve, reject) => {
    serverProcess = spawn(process.execPath, [serverEntry], {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        UPLOADS_DIR: uploadsDir,
        CRON_SECRET: "invoiceflow-local-cron",
        PORT: String(port),
        HOSTNAME: "127.0.0.1",
        NODE_ENV: "production",
        ELECTRON_RUN_AS_NODE: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    // Without this handler, a spawn failure (e.g. the exe missing/blocked)
    // fires an unhandled 'error' event that throws and kills the whole
    // Electron process with no dialog and no log.
    serverProcess.on("error", (error) => {
      logFatal(`Failed to spawn server process: ${error.stack ?? error.message}`);
      reject(error);
    });

    serverProcess.stdout?.on("data", (chunk) => logFatal(`[server stdout] ${chunk}`));
    serverProcess.stderr?.on("data", (chunk) => logFatal(`[server stderr] ${chunk}`));
    serverProcess.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        logFatal(`Server process exited with code ${code}`);
        reject(new Error(`Server process exited unexpectedly (code ${code}). See startup-error.log.`));
      }
    });

    const url = `http://127.0.0.1:${port}`;
    waitForServer(url).then(() => resolve(url), reject);
  });
}

async function checkRecurringInvoices(baseUrl: string, cronSecret: string) {
  try {
    await new Promise<void>((resolve) => {
      const req = http.get(
        `${baseUrl}/api/cron/recurring-invoices`,
        { headers: { authorization: `Bearer ${cronSecret}` } },
        (res) => {
          res.on("data", () => {});
          res.on("end", resolve);
        }
      );
      req.on("error", () => resolve());
    });
  } catch {
    // Non-fatal — recurring invoices will still generate on the next launch.
  }
}

/**
 * Registered once at startup. Both the silent startup check and the
 * Settings page's manual "Check for updates" button (via IPC, below) share
 * these same 'error'/'update-downloaded' listeners — only the trigger differs.
 */
function setupAutoUpdater() {
  autoUpdater.on("error", (error) => logFatal(`Auto-update error: ${error.message}`));
  autoUpdater.on("update-downloaded", async (info) => {
    const { response } = await dialog.showMessageBox({
      type: "info",
      title: "Update ready",
      message: `InvoiceFlow ${info.version} has been downloaded.`,
      detail: "Restart now to install it, or install it next time you quit.",
      buttons: ["Restart now", "Later"],
      defaultId: 0,
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });
}

/** Silent, best-effort check run once on every launch — never treated as a startup failure. */
function checkForUpdatesOnStartup() {
  autoUpdater.checkForUpdatesAndNotify().catch((error) => {
    logFatal(`Auto-update check failed: ${error instanceof Error ? error.message : String(error)}`);
  });
}

async function performUpdateCheck(): Promise<{ status: string; message: string }> {
  if (!app.isPackaged) {
    return { status: "dev", message: "Update checks only run in the installed app." };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    const latestVersion = result?.updateInfo?.version;
    if (latestVersion && latestVersion !== app.getVersion()) {
      return { status: "available", message: `Version ${latestVersion} is downloading now.` };
    }
    return { status: "up-to-date", message: "You're on the latest version." };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Update check failed." };
  }
}

ipcMain.handle("get-app-version", () => app.getVersion());
ipcMain.handle("check-for-updates", () => performUpdateCheck());

function navigateTo(pagePath: string) {
  if (!mainWindow || !baseUrl) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  mainWindow.loadURL(`${baseUrl}${pagePath}`);
}

function buildAppMenu() {
  const isMac = process.platform === "darwin";

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: "appMenu" as const }] : []),
    {
      label: "File",
      submenu: [
        { label: "New Invoice", accelerator: "CmdOrCtrl+N", click: () => navigateTo("/invoices/new") },
        { label: "New Customer", click: () => navigateTo("/customers") },
        { label: "New Product", click: () => navigateTo("/products") },
        { type: "separator" },
        { label: "Settings", accelerator: "CmdOrCtrl+,", click: () => navigateTo("/settings") },
        { type: "separator" },
        isMac ? { role: "close" } : { label: "Quit", accelerator: "CmdOrCtrl+Q", click: () => app.quit() },
      ],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Check for Updates…",
          click: async () => {
            const result = await performUpdateCheck();
            dialog.showMessageBox({ type: "info", title: "InvoiceFlow updates", message: result.message });
          },
        },
        {
          label: "About InvoiceFlow",
          click: () =>
            dialog.showMessageBox({
              type: "info",
              title: "About InvoiceFlow",
              message: "InvoiceFlow",
              detail: `Version ${app.getVersion()}`,
            }),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createTray() {
  const iconPath = getResourcePath("build-resources", "icon.png");
  if (!fs.existsSync(iconPath)) return; // best-effort — a missing icon shouldn't block startup.

  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip("InvoiceFlow");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open InvoiceFlow", click: () => navigateTo("/") },
      { label: "New Invoice", click: () => navigateTo("/invoices/new") },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ])
  );
  tray.on("click", () => navigateTo("/"));
}

async function createWindow(url: string) {
  baseUrl = url;
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    show: false,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Minimize to tray instead of quitting — but only if a tray icon actually
  // exists to bring the window back; otherwise hiding it would leave no way
  // to reopen it. Only Quit (menu, tray, or a real OS shutdown) sets
  // isQuitting first.
  mainWindow.on("close", (event) => {
    if (!isQuitting && tray) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  await mainWindow.loadURL(url);
  mainWindow.show();
}

if (gotLock) {
  app.whenReady().then(async () => {
    try {
      buildAppMenu();
      createTray();
      setupAutoUpdater();

      if (app.isPackaged) {
        const url = await startPackagedServer();
        await createWindow(url);
        await checkRecurringInvoices(url, "invoiceflow-local-cron");
        checkForUpdatesOnStartup();
      } else {
        const url = `http://127.0.0.1:${DEV_PORT}`;
        await waitForServer(url, 30000);
        await createWindow(url);
      }
    } catch (error) {
      logFatal(`Startup failed: ${error instanceof Error ? error.stack : String(error)}`);
      dialog.showErrorBox("InvoiceFlow failed to start", String(error));
      app.quit();
    }
  });
}

// window-all-closed no longer means quit: closing the window hides it to
// the tray (see the "close" handler in createWindow). This only fires once
// the window is truly destroyed, which now only happens during quit itself.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  isQuitting = true;
  serverProcess?.kill();
});

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});
