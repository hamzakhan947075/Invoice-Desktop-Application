import path from "path";
import { pathToFileURL } from "url";

/**
 * Root directory for runtime-written uploads (business logos, etc).
 *
 * Defaults to `public/uploads` for plain `next dev`/`next start`, matching
 * historical behavior. The desktop (Electron) launcher sets `UPLOADS_DIR` to
 * a writable per-user directory before starting the server, since the
 * packaged app's `public/` folder lives inside a read-only install location.
 */
export function getUploadsRoot(): string {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), "public", "uploads");
}

const UPLOADS_URL_PREFIX = "/api/uploads/";

/**
 * Resolves a stored `logoUrl` (e.g. `/api/uploads/businesses/<id>/<file>`) to
 * a `file://` URL, for feeding into `@react-pdf/renderer`'s `<Image>`.
 *
 * `<Image>` tries `fetch()` on whatever `src` it's given — a bare filesystem
 * path (no protocol) fails that fetch silently and the image just doesn't
 * render, with no error. `pathToFileURL` gives it something `fetch()` (and
 * Node generally) actually understands, including correct escaping if a
 * path ever contains characters like spaces.
 */
export function resolveUploadPath(url: string): string {
  // The uploads root comes from an env var, not a literal path Next's file
  // tracer can follow statically — without this, `output: "standalone"`
  // conservatively bundles the whole project into the traced output.
  const absolutePath = path.join(
    /*turbopackIgnore: true*/ getUploadsRoot(),
    url.slice(UPLOADS_URL_PREFIX.length)
  );
  return pathToFileURL(absolutePath).href;
}
