let fs
try {
  fs = require("fs-extra")
} catch (error) {
  if (error && typeof error === "object" && "code" in error && error.code !== "MODULE_NOT_FOUND") {
    throw error
  }
  fs = require("fs")
}
const path = require("path")
const { createServer } = require("http")
const next = require("next")

const dev = process.env.NODE_ENV !== "production"
const hostname = process.env.HOST || "0.0.0.0"
const defaultPort = dev ? 3000 : 3100
const port = Number.parseInt(process.env.PORT, 10) || defaultPort

const standaloneServerPath = path.join(
  __dirname,
  ".next",
  "standalone",
  "server.js",
)

if (!dev && fs.existsSync(standaloneServerPath)) {
  console.log(
    "Detected standalone Next.js build. Delegating to .next/standalone/server.js.",
  )
  // eslint-disable-next-line import/no-dynamic-require, global-require
  require(standaloneServerPath)
  return
}

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      // Chrome based browsers request this file when the devtools
      // protocol is enabled. In environments where the file does not
      // exist Next.js attempts to locate it which ends up triggering a
      // large gzip extraction inside webpack. That extraction can
      // allocate massive buffers and eventually crash the dev server.
      // We short circuit the request and return a 404 immediately so the
      // process never attempts to unzip anything.
      if (
        req.url?.startsWith("/.well-known/appspecific/com.chrome.devtools.json")
      ) {
        res.statusCode = 404
        res.end("Not Found")
        return
      }

      const host = req.headers.host || `${hostname}:${port}`
      const parsedUrl = req.url
        ? new URL(req.url, `http://${host}`)
        : undefined
      await handle(req, res, {
        pathname: parsedUrl?.pathname,
        query: parsedUrl
          ? Object.fromEntries(parsedUrl.searchParams.entries())
          : {},
        search: parsedUrl?.search,
      })
    } catch (err) {
      console.error("Error occurred handling", req.url, err)
      res.statusCode = 500
      res.end("internal server error")
    }
  })
    .once("error", (err) => {
      console.error(err)
      process.exit(1)
    })
    .listen(port, hostname, () => {
      const publicUrl = process.env.PUBLIC_URL
      const displayAddress = publicUrl || `http://${hostname}:${port}`
      console.log(`> Ready on ${displayAddress}`)
    })
})
