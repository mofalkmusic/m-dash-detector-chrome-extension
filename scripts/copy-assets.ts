import { cp, mkdir } from "fs/promises";
import { join } from "path";

const ROOT = join(import.meta.dir, "..");
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");

await mkdir(DIST, { recursive: true });

// Copy manifest.json from root
await cp(join(ROOT, "manifest.json"), join(DIST, "manifest.json"));

// Copy styles and icons from src
await cp(join(SRC, "styles.css"), join(DIST, "styles.css"));
await cp(join(SRC, "icons"), join(DIST, "icons"), { recursive: true });

console.log("✓ Assets copied to dist/");
