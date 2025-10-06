// Utility for loading the jsPDF library from a CDN at runtime.
// This keeps the bundle size smaller while allowing PDF generation features.

const JSPDF_CDN_URL = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"

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

type JsPdfGlobalNamespace = {
  jsPDF?: JsPdfConstructor
}

let modulePromise: Promise<JsPdfModule> | null = null

function resolveRuntime(): (Window & typeof globalThis & { jspdf?: JsPdfGlobalNamespace }) | null {
  if (typeof globalThis === "undefined") {
    return null
  }

  const runtime = globalThis as Window & typeof globalThis & {
    jspdf?: JsPdfGlobalNamespace
  }

  if (typeof runtime.document === "undefined") {
    return null
  }

  return runtime
}

function waitForScript(script: HTMLScriptElement, runtime: Window & typeof globalThis & { jspdf?: JsPdfGlobalNamespace }) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      script.removeEventListener("load", handleLoad)
      script.removeEventListener("error", handleError)
    }

    const handleLoad = () => {
      cleanup()
      resolve()
    }

    const handleError = () => {
      cleanup()
      reject(new Error("Failed to load jsPDF script"))
    }

    script.addEventListener("load", handleLoad)
    script.addEventListener("error", handleError)

    // In case the script was already loaded before listeners were added.
    if (runtime.jspdf?.jsPDF) {
      cleanup()
      resolve()
    }
  })
}

async function loadModule(): Promise<JsPdfModule> {
  const runtime = resolveRuntime()

  if (!runtime) {
    throw new Error("jsPDF can only be loaded in the browser")
  }

  if (runtime.jspdf?.jsPDF) {
    return { jsPDF: runtime.jspdf.jsPDF }
  }

  const existingScript = runtime.document.querySelector(
    'script[data-jspdf-loader="true"]',
  ) as HTMLScriptElement | null

  if (existingScript) {
    await waitForScript(existingScript, runtime)
  } else {
    const script = runtime.document.createElement("script")
    script.src = JSPDF_CDN_URL
    script.async = true
    script.defer = true
    script.setAttribute("data-jspdf-loader", "true")

    runtime.document.head.appendChild(script)

    await waitForScript(script, runtime)
  }

  const globalNamespace = runtime.jspdf

  if (!globalNamespace?.jsPDF) {
    throw new Error("jsPDF global namespace is unavailable")
  }

  return { jsPDF: globalNamespace.jsPDF }
}

export async function getJsPdf(): Promise<JsPdfModule> {
  if (!modulePromise) {
    modulePromise = loadModule()
  }

  return modulePromise
}
