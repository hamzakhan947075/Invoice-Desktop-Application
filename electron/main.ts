import { app, BrowserWindow, dialog } from "electron";
import { spawn, type ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import http from "http";
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

async function startPackagedServer(): Promise<string> {
  const userData = app.getPath("userData");
  const dataDir = path.join(userData, "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "invoiceflow.db");
  const databaseUrl = `file:${dbPath}`;

  const uploadsDir = path.join(userData, "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });

  const migrationsDir = getResourcePath("prisma", "migrations");
  await runMigrations(databaseUrl, migrationsDir);

  const serverEntry = getResourcePath("standalone", "server.js");
  const port = PROD_PORT;

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

  serverProcess.stdout?.on("data", (chunk) => logFatal(`[server stdout] ${chunk}`));
  serverProcess.stderr?.on("data", (chunk) => logFatal(`[server stderr] ${chunk}`));
  serverProcess.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      logFatal(`Server process exited with code ${code}`);
      dialog.showErrorBox("InvoiceFlow", `The application server exited unexpectedly (code ${code}).`);
    }
  });

  const url = `http://127.0.0.1:${port}`;
  await waitForServer(url);
  return url;
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
