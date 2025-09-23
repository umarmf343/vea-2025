const DEFAULT_TEST_SECRET_KEY = "sk_test_7dd51e291a986b6462d0f4198668ce07c296eb5d"
export const PAYSTACK_TEST_PUBLIC_KEY = "pk_test_511e657a1955822d3f1dc4b231617eae8905c0dc"

export const REVENUE_PARTNER_DETAILS = {
  accountName: "Umar Umar Muhammad",
  accountNumber: "3066490309",
  bankName: "First Bank of Nigeria",
  bankCode: "011",
  splitPercentage: 1,
} as const

let cachedSubaccountCode: string | null = process.env.PAYSTACK_PARTNER_SUBACCOUNT_CODE?.trim() ?? null
let cachedSplitCode: string | null = process.env.PAYSTACK_PARTNER_SPLIT_CODE?.trim() ?? null

let ensureSubaccountPromise: Promise<string> | null = null
let ensureSplitPromise: Promise<string> | null = null

export function getPaystackSecretKey(): string {
  return process.env.PAYSTACK_SECRET_KEY?.trim() || DEFAULT_TEST_SECRET_KEY
}

export function getPaystackPublicKey(): string {
  return process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY?.trim() || process.env.PAYSTACK_PUBLIC_KEY?.trim() || ""
}

async function paystackFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers ?? {})

  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${getPaystackSecretKey()}`)
  }

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  return fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers,
  })
}

async function findExistingSubaccountCode(): Promise<string | null> {
  for (let page = 1; page <= 10; page += 1) {
    const response = await paystackFetch(`/subaccount?page=${page}&perPage=50`, {
      method: "GET",
    })

    const payload: unknown = await response.json().catch(() => null)

    if (!payload || typeof payload !== "object") {
      break
    }

    const { data, meta } = payload as { data?: unknown; meta?: Record<string, unknown> }

    if (!Array.isArray(data)) {
      break
    }

    const match = data.find((entry) => {
      if (!entry || typeof entry !== "object") {
        return false
      }

      const candidate = entry as Record<string, unknown>
      return (
        candidate.account_number === REVENUE_PARTNER_DETAILS.accountNumber &&
        candidate.settlement_bank === REVENUE_PARTNER_DETAILS.bankCode
      )
    }) as Record<string, unknown> | undefined

    if (match && typeof match.subaccount_code === "string" && match.subaccount_code.trim().length > 0) {
      return match.subaccount_code.trim()
    }

    const hasNext = Boolean(meta && typeof meta.next === "string" && meta.next.trim().length > 0)
    if (!hasNext) {
      break
    }
  }

  return null
}

async function ensurePartnerSubaccountCode(): Promise<string> {
  if (cachedSubaccountCode) {
    return cachedSubaccountCode
  }

  if (ensureSubaccountPromise) {
    return ensureSubaccountPromise
  }

  ensureSubaccountPromise = (async () => {
    const response = await paystackFetch("/subaccount", {
      method: "POST",
      body: JSON.stringify({
        business_name: REVENUE_PARTNER_DETAILS.accountName,
        settlement_bank: REVENUE_PARTNER_DETAILS.bankCode,
        account_number: REVENUE_PARTNER_DETAILS.accountNumber,
        active: true,
        percentage_charge: 0,
        description: "Automated revenue share beneficiary for school fees",
      }),
    })

    const payload: unknown = await response.json().catch(() => null)

    if (payload && typeof payload === "object" && (payload as Record<string, unknown>).status === true) {
      const data = (payload as Record<string, unknown>).data as Record<string, unknown> | undefined
      const code = data && typeof data.subaccount_code === "string" ? data.subaccount_code.trim() : ""
      if (code) {
        cachedSubaccountCode = code
        return code
      }
    }

    const existing = await findExistingSubaccountCode()
    if (existing) {
      cachedSubaccountCode = existing
      return existing
    }

    const message =
      payload && typeof payload === "object" && typeof (payload as Record<string, unknown>).message === "string"
        ? (payload as Record<string, unknown>).message
        : "Unable to create Paystack subaccount"

    throw new Error(
      `${message}. Please set PAYSTACK_PARTNER_SUBACCOUNT_CODE with the beneficiary's subaccount code manually.`,
    )
  })()

  try {
    const code = await ensureSubaccountPromise
    cachedSubaccountCode = code
    return code
  } finally {
    ensureSubaccountPromise = null
  }
}

async function findExistingSplitCode(subaccountCode: string): Promise<string | null> {
  for (let page = 1; page <= 10; page += 1) {
    const response = await paystackFetch(`/split?page=${page}&perPage=50`, { method: "GET" })
    const payload: unknown = await response.json().catch(() => null)

    if (!payload || typeof payload !== "object") {
      break
    }

    const { data, meta } = payload as { data?: unknown; meta?: Record<string, unknown> }

    if (!Array.isArray(data)) {
      break
    }

    const match = data.find((entry) => {
      if (!entry || typeof entry !== "object") {
        return false
      }

      const candidate = entry as Record<string, unknown>
      if (candidate.type !== "percentage") {
        return false
      }

      const nameMatches =
        typeof candidate.name === "string" && candidate.name.trim().toLowerCase() === "school fees revenue split"

      if (!nameMatches) {
        return false
      }

      const subaccounts = candidate.subaccounts
      if (!Array.isArray(subaccounts)) {
        return false
      }

      return subaccounts.some((subaccountEntry) => {
        if (!subaccountEntry || typeof subaccountEntry !== "object") {
          return false
        }

        const subaccount = subaccountEntry as Record<string, unknown>
        const share = Number(subaccount.share)
        return (
          subaccount.subaccount === subaccountCode &&
          !Number.isNaN(share) &&
          Math.abs(share - REVENUE_PARTNER_DETAILS.splitPercentage) < 0.0001
        )
      })
    }) as Record<string, unknown> | undefined

    if (match && typeof match.split_code === "string" && match.split_code.trim().length > 0) {
      return match.split_code.trim()
    }

    const hasNext = Boolean(meta && typeof meta.next === "string" && meta.next.trim().length > 0)
    if (!hasNext) {
      break
    }
  }

  return null
}

async function ensurePartnerSplitCode(subaccountCode: string): Promise<string> {
  if (cachedSplitCode) {
    return cachedSplitCode
  }

  if (ensureSplitPromise) {
    return ensureSplitPromise
  }

  cachedSubaccountCode = subaccountCode

  ensureSplitPromise = (async () => {
    const response = await paystackFetch("/split", {
      method: "POST",
      body: JSON.stringify({
        name: "School Fees Revenue Split",
        type: "percentage",
        currency: "NGN",
        subaccounts: [
          {
            subaccount: subaccountCode,
            share: REVENUE_PARTNER_DETAILS.splitPercentage,
          },
        ],
        bearer_type: "account",
      }),
    })

    const payload: unknown = await response.json().catch(() => null)

    if (payload && typeof payload === "object" && (payload as Record<string, unknown>).status === true) {
      const data = (payload as Record<string, unknown>).data as Record<string, unknown> | undefined
      const code = data && typeof data.split_code === "string" ? data.split_code.trim() : ""
      if (code) {
        cachedSplitCode = code
        return code
      }
    }

    const existing = await findExistingSplitCode(subaccountCode)
    if (existing) {
      cachedSplitCode = existing
      return existing
    }

    const message =
      payload && typeof payload === "object" && typeof (payload as Record<string, unknown>).message === "string"
        ? (payload as Record<string, unknown>).message
        : "Unable to create Paystack split"

    throw new Error(
      `${message}. Please set PAYSTACK_PARTNER_SPLIT_CODE with a valid Paystack split code manually.`,
    )
  })()

  try {
    const code = await ensureSplitPromise
    cachedSplitCode = code
    return code
  } finally {
    ensureSplitPromise = null
  }
}

export interface PartnerSplitConfiguration {
  splitCode: string
  subaccountCode: string
}

export async function ensurePartnerSplitConfiguration(): Promise<PartnerSplitConfiguration> {
  if (cachedSplitCode && cachedSubaccountCode) {
    return { splitCode: cachedSplitCode, subaccountCode: cachedSubaccountCode }
  }

  const subaccountCode = cachedSubaccountCode || (await ensurePartnerSubaccountCode())
  const splitCode = cachedSplitCode || (await ensurePartnerSplitCode(subaccountCode))

  cachedSubaccountCode = subaccountCode
  cachedSplitCode = splitCode

  return { splitCode, subaccountCode }
}

