import { safeStorage } from "./safe-storage"

export interface BrandingInfo {
  schoolName: string
  schoolAddress: string
  headmasterName: string
  defaultRemark: string
  logoUrl: string | null
  signatureUrl: string | null
  updatedAt?: string
}

export const BRANDING_STORAGE_KEY = "schoolBranding"

const FALLBACK_BRANDING: BrandingInfo = {
  schoolName: "Victory Educational Academy",
  schoolAddress: "No. 19, Abdulazeez Street, Zone 3 Duste Baumpaba, Bwari Area Council, Abuja",
  headmasterName: "Dr. Emmanuel Adebayo",
  defaultRemark: "Keep up the excellent work and continue to strive for academic excellence.",
  logoUrl: null,
  signatureUrl: null,
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0

const normalizeOptionalUrl = (value: unknown): string | null => {
  if (isNonEmptyString(value)) {
    return value
  }
  return null
}

const normalizeBrandingObject = (value: Partial<BrandingInfo> | null | undefined): BrandingInfo => {
  if (!value || typeof value !== "object") {
    return { ...FALLBACK_BRANDING }
  }

  return {
    schoolName: isNonEmptyString(value.schoolName) ? value.schoolName.trim() : FALLBACK_BRANDING.schoolName,
    schoolAddress: isNonEmptyString(value.schoolAddress)
      ? value.schoolAddress.trim()
      : FALLBACK_BRANDING.schoolAddress,
    headmasterName: isNonEmptyString(value.headmasterName)
      ? value.headmasterName.trim()
      : FALLBACK_BRANDING.headmasterName,
    defaultRemark: isNonEmptyString(value.defaultRemark)
      ? value.defaultRemark.trim()
      : FALLBACK_BRANDING.defaultRemark,
    logoUrl: normalizeOptionalUrl(value.logoUrl),
    signatureUrl: normalizeOptionalUrl(value.signatureUrl),
    updatedAt: isNonEmptyString(value.updatedAt) ? value.updatedAt : undefined,
  }
}

export const parseBranding = (rawValue: unknown): BrandingInfo => {
  if (typeof rawValue === "string") {
    if (!rawValue.trim().length) {
      return { ...FALLBACK_BRANDING }
    }

    try {
      const parsed = JSON.parse(rawValue) as Partial<BrandingInfo>
      return normalizeBrandingObject(parsed)
    } catch (error) {
      return { ...FALLBACK_BRANDING }
    }
  }

  if (typeof rawValue === "object" && rawValue !== null) {
    return normalizeBrandingObject(rawValue as Partial<BrandingInfo>)
  }

  return { ...FALLBACK_BRANDING }
}

export const getBrandingFromStorage = () => {
  try {
    const value = safeStorage.getItem(BRANDING_STORAGE_KEY)
    if (value === null) {
      return { ...FALLBACK_BRANDING }
    }
    return parseBranding(value)
  } catch (error) {
    return { ...FALLBACK_BRANDING }
  }
}

export const getFallbackBranding = (): BrandingInfo => ({ ...FALLBACK_BRANDING })
