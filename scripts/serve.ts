/**
 * Development server with live reload for testing the extension locally.
 */

import { watch } from "fs";
import { join, extname } from "path";

const PORT = 3000;
const ROOT = join(import.meta.dir, "..");
const DIST_DIR = join(ROOT, "dist");
const TEST_DIR = join(ROOT, "test");
const SRC_DIR = join(ROOT, "src");

// Track connected clients for live reload
const clients: Set<ReadableStreamDefaultController> = new Set();

// Startup grace period to ignore initial file system events
let startupGrace = true;
setTimeout(() => { startupGrace = false; }, 1000);

/**
 * Creates a debounced version of a function
 */
function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return ((...args: unknown[]) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), ms);
  }) as T;
}

const mimeTypes: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
};

const liveReloadScript = `
<script>
  const evtSource = new EventSource('/__reload');
  evtSource.onmessage = () => location.reload();
</script>
`;

async function serveFile(path: string): Promise<Response> {
  try {
    const file = Bun.file(path);
    if (!(await file.exists())) return new Response("Not Found", { status: 404 });

    let content = await file.text();
    const ext = extname(path);

    if (ext === ".html") {
      content = content.replace("</body>", `${liveReloadScript}</body>`);
    }

    return new Response(content, {
      headers: { "Content-Type": mimeTypes[ext] || "text/plain" },
    });
  } catch {
    return new Response("Error", { status: 500 });
  }
}

function handleSSE(): Response {
  const stream = new ReadableStream({
    start(controller) {
      clients.add(controller);
    },
    cancel(controller) {
      clients.delete(controller);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}

const notifyClients = debounce(() => {
  if (startupGrace) return;
  for (const client of clients) {
    try {
      client.enqueue("data: reload\n\n");
    } catch {
      clients.delete(client);
    }
  }
}, 300);

const runCopyAssets = debounce(async () => {
  console.log("[Auto-Copy] Assets changed, copying...");
  try {
    const proc = Bun.spawn(["bun", "run", "scripts/copy-assets.ts"], {
      stdout: "inherit",
      stderr: "inherit",
    });
    await proc.exited;
  } catch (e) {
    console.error("Error copy-assets:", e);
  }
}, 50);

Bun.serve({
  port: PORT,
  idleTimeout: 0, // Disable timeout for SSE connections
  async fetch(req) {
    const pathname = new URL(req.url).pathname;

    if (pathname === "/__reload") return handleSSE();
    if (pathname === "/" || pathname === "/index.html") {
      return serveFile(join(TEST_DIR, "index.html"));
    }
    return serveFile(join(DIST_DIR, pathname));
  },
});


function setupWatchers() {
  // Watch dist and test for live reload
  for (const dir of [DIST_DIR, TEST_DIR]) {
    try {
      watch(dir, { recursive: true }, (_, filename) => {
        if (filename?.match(/\.(js|css|html)$/)) {
          console.log(`[Change] ${filename}`);
          notifyClients();
        }
      });
    } catch { /* dir doesn't exist */ }
  }

  // Watch src and manifest for asset copying
  for (const path of [SRC_DIR, join(ROOT, "manifest.json")]) {
    try {
      watch(path, { recursive: true }, (_, filename) => {
        // Ignore .ts files (handled by build watcher)
        if (filename?.endsWith(".ts")) return;
        runCopyAssets();
      });
    } catch (e) {
      console.error(`Failed to watch ${path}:`, e);
    }
  }
}

setupWatchers();

console.log(`\n  Dev server: http://localhost:${PORT}\n`);
