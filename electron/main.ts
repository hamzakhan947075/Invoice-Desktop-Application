import { app, BrowserWindow, dialog } from "electron";
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

async function createWindow(url: string) {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    show: false,
    webPreferences: {
      contextIsolation: true,
    },
  });

  await mainWindow.loadURL(url);
  mainWindow.show();
}

if (gotLock) {
  app.whenReady().then(async () => {
    try {
      if (app.isPackaged) {
        const url = await startPackagedServer();
        await createWindow(url);
        await checkRecurringInvoices(url, "invoiceflow-local-cron");
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

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  serverProcess?.kill();
});

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});
