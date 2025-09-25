// Utility for loading the html-to-image library from a CDN at runtime.
// This avoids a hard dependency on the npm package while keeping the feature working.

const HTML_TO_IMAGE_CDN_URL =
  "https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/es/index.js"

type DownloadFilter = (element: Element | null) => boolean

export interface HtmlToImageModule {
  toPng: (
    node: HTMLElement,
    options?: {
      backgroundColor?: string
      cacheBust?: boolean
      filter?: DownloadFilter
      pixelRatio?: number
    },
  ) => Promise<string>
}

let modulePromise: Promise<HtmlToImageModule> | null = null

async function loadModule(): Promise<HtmlToImageModule> {
  const runtime =
    typeof globalThis === "undefined"
      ? undefined
      : (globalThis as Window & typeof globalThis)

  if (!runtime || typeof runtime.document === "undefined") {
    throw new Error("html-to-image can only be loaded in the browser")
  }

  const loadedModule = await import(
    /* webpackIgnore: true */ HTML_TO_IMAGE_CDN_URL,
  )
  if (typeof loadedModule?.toPng !== "function") {
    throw new Error("html-to-image module failed to load")
  }

  return loadedModule as HtmlToImageModule
}

export async function getHtmlToImage(): Promise<HtmlToImageModule> {
  if (!modulePromise) {
    modulePromise = loadModule()
  }

  return modulePromise
}
