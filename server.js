const { createServer } = require("http")
const { parse } = require("url")
const next = require("next")

const dev = process.env.NODE_ENV !== "production"
const hostname = "localhost"
const port = process.env.PORT || 3000

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

      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
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
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`)
    })
})
