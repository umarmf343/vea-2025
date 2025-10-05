// Utility for loading the html-to-image library at runtime without impacting SSR.

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

  const loadedModule = await import("html-to-image")
  const candidateModule =
    typeof loadedModule?.toPng === "function"
      ? loadedModule
      : typeof loadedModule?.default?.toPng === "function"
        ? (loadedModule.default as HtmlToImageModule)
        : null

  if (!candidateModule) {
    throw new Error("html-to-image module failed to load")
  }

  return candidateModule as HtmlToImageModule
}

export async function getHtmlToImage(): Promise<HtmlToImageModule> {
  if (!modulePromise) {
    modulePromise = loadModule()
  }

  return modulePromise
}
