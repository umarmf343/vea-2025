// Utility for loading the jsPDF library from a CDN at runtime.
// This keeps the bundle size smaller while allowing PDF generation features.

const JSPDF_CDN_URL = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.es.min.js"

type JsPdfOrientation = "portrait" | "landscape"

type JsPdfConstructorOptions = {
  orientation?: JsPdfOrientation
  unit?: string
  format?: string | [number, number]
}

type JsPdfImageProperties = {
  width: number
  height: number
}

type JsPdfInstance = {
  internal: {
    pageSize: {
      getWidth: () => number
      getHeight: () => number
    }
  }
  addImage: (
    imageData: string,
    format: string,
    x: number,
    y: number,
    width: number,
    height: number,
    alias?: string,
    compression?: string,
    rotation?: number,
  ) => void
  getImageProperties: (imageData: string) => JsPdfImageProperties
  output: (type?: string) => unknown
  save: (filename?: string) => void
}

type JsPdfConstructor = new (options?: JsPdfConstructorOptions) => JsPdfInstance

export interface JsPdfModule {
  jsPDF: JsPdfConstructor
}

let modulePromise: Promise<JsPdfModule> | null = null

async function loadModule(): Promise<JsPdfModule> {
  const runtime =
    typeof globalThis === "undefined"
      ? undefined
      : (globalThis as Window & typeof globalThis)

  if (!runtime || typeof runtime.document === "undefined") {
    throw new Error("jsPDF can only be loaded in the browser")
  }

  const loadedModule = await import(
    /* webpackIgnore: true */ JSPDF_CDN_URL
  )

  if (typeof loadedModule?.jsPDF !== "function") {
    throw new Error("jsPDF module failed to load")
  }

  return loadedModule as JsPdfModule
}

export async function getJsPdf(): Promise<JsPdfModule> {
  if (!modulePromise) {
    modulePromise = loadModule()
  }

  return modulePromise
}
