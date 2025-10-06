"use client"

import { useEffect, useState } from "react"

import { dbManager } from "@/lib/database-manager"
import {
  BRANDING_STORAGE_KEY,
  type BrandingInfo,
  getBrandingFromStorage,
  getFallbackBranding,
  parseBranding,
} from "@/lib/branding"

const BRANDING_EVENT_KEY = "brandingUpdated"

const areBrandingsEqual = (a: BrandingInfo, b: BrandingInfo): boolean => {
  return (
    a.schoolName === b.schoolName &&
    a.schoolAddress === b.schoolAddress &&
    a.educationZone === b.educationZone &&
    a.councilArea === b.councilArea &&
    a.contactPhone === b.contactPhone &&
    a.contactEmail === b.contactEmail &&
    a.headmasterName === b.headmasterName &&
    a.defaultRemark === b.defaultRemark &&
    a.logoUrl === b.logoUrl &&
    a.signatureUrl === b.signatureUrl &&
    a.updatedAt === b.updatedAt
  )
}

export const useBranding = (): BrandingInfo => {
  const [branding, setBranding] = useState<BrandingInfo>(() => getFallbackBranding())

  useEffect(() => {
    const updateBrandingState = (value: unknown) => {
      setBranding((currentBranding) => {
        const nextBranding = parseBranding(value ?? getBrandingFromStorage())
        if (areBrandingsEqual(currentBranding, nextBranding)) {
          return currentBranding
        }
        return nextBranding
      })
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

    updateBrandingState(getBrandingFromStorage())

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
