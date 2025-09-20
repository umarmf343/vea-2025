"use client"

import { useEffect, useState } from "react"

import { dbManager } from "@/lib/database-manager"
import {
  BRANDING_STORAGE_KEY,
  type BrandingInfo,
  getBrandingFromStorage,
  parseBranding,
} from "@/lib/branding"

const BRANDING_EVENT_KEY = "brandingUpdated"

export const useBranding = (): BrandingInfo => {
  const [branding, setBranding] = useState<BrandingInfo>(() => getBrandingFromStorage())

  useEffect(() => {
    const updateBrandingState = (value: unknown) => {
      setBranding(parseBranding(value ?? getBrandingFromStorage()))
    }

    const handleStorageEvent = (event: StorageEvent) => {
      if (!event.key) {
        return
      }

      if (event.key === BRANDING_STORAGE_KEY || event.key === BRANDING_EVENT_KEY) {
        updateBrandingState(event.newValue ?? getBrandingFromStorage())
      }
    }

    dbManager.on(BRANDING_EVENT_KEY, updateBrandingState)

    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleStorageEvent)
    }

    return () => {
      dbManager.off(BRANDING_EVENT_KEY, updateBrandingState)
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", handleStorageEvent)
      }
    }
  }, [])

  return branding
}
