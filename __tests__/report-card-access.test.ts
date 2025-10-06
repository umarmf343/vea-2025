import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import {
  REPORT_CARD_ACCESS_EVENT,
  clearReportCardAccess,
  grantReportCardAccess,
  hasReportCardAccess,
  revokeReportCardAccess,
  syncReportCardAccess,
} from "@/lib/report-card-access"

describe("Report card access controller", () => {
  const parentId = "parent-001"
  const studentId = "student-001"
  const session = "2024/2025"
  const firstTerm = "First Term"
  const secondTerm = "Second Term"

  beforeEach(() => {
    clearReportCardAccess()
    window.localStorage.clear()
  })

  it("grants access through successful payments and notifies listeners", () => {
    const listener = jest.fn()
    globalThis.addEventListener(REPORT_CARD_ACCESS_EVENT, listener as EventListener)

    const records = grantReportCardAccess({
      parentId,
      studentId,
      session,
      term: firstTerm,
      grantedBy: "payment",
    })

    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      parentId,
      studentId,
      session,
      term: firstTerm,
      grantedBy: "payment",
    })

    const access = hasReportCardAccess({ parentId, studentId, session, term: firstTerm })
    expect(access.granted).toBe(true)
    expect(access.record?.grantedBy).toBe("payment")

    expect(listener).toHaveBeenCalledTimes(1)
    const event = listener.mock.calls[0][0] as CustomEvent<{ records: unknown[] }>
    expect(Array.isArray(event.detail.records)).toBe(true)
    expect(event.detail.records).toHaveLength(1)

    globalThis.removeEventListener(REPORT_CARD_ACCESS_EVENT, listener as EventListener)
  })

  it("retains previous term access when syncing a different academic period", () => {
    grantReportCardAccess({
      parentId,
      studentId,
      session,
      term: firstTerm,
      grantedBy: "payment",
    })

    grantReportCardAccess({
      parentId,
      studentId,
      session,
      term: secondTerm,
      grantedBy: "manual",
    })

    const firstTermAccess = hasReportCardAccess({ parentId, studentId, session, term: firstTerm })
    expect(firstTermAccess.granted).toBe(true)
    expect(firstTermAccess.record?.term).toBe(firstTerm)

    const secondTermRecords = syncReportCardAccess(secondTerm, session)
    expect(secondTermRecords).toHaveLength(1)
    expect(secondTermRecords[0]).toMatchObject({ grantedBy: "manual" })

    const priorAccess = hasReportCardAccess({ parentId, studentId, session, term: firstTerm })
    expect(priorAccess.granted).toBe(true)
  })

  it("only revokes the targeted term while keeping other grants intact", () => {
    grantReportCardAccess({
      parentId,
      studentId,
      session,
      term: firstTerm,
      grantedBy: "payment",
    })

    grantReportCardAccess({
      parentId,
      studentId,
      session,
      term: secondTerm,
      grantedBy: "manual",
    })

    const remaining = revokeReportCardAccess({ parentId, studentId, session, term: secondTerm })
    expect(remaining).toHaveLength(0)

    const firstTermAccess = hasReportCardAccess({ parentId, studentId, session, term: firstTerm })
    expect(firstTermAccess.granted).toBe(true)
  })

  it("allows super admin manual overrides to replace automated access", () => {
    const listener = jest.fn()
    globalThis.addEventListener(REPORT_CARD_ACCESS_EVENT, listener as EventListener)

    grantReportCardAccess({
      parentId,
      studentId,
      session,
      term: firstTerm,
      grantedBy: "payment",
    })

    const updatedRecords = grantReportCardAccess({
      parentId,
      studentId,
      session,
      term: firstTerm,
      grantedBy: "manual",
    })

    expect(updatedRecords).toHaveLength(1)
    expect(updatedRecords[0]).toMatchObject({ grantedBy: "manual" })

    const access = hasReportCardAccess({ parentId, studentId, session, term: firstTerm })
    expect(access.granted).toBe(true)
    expect(access.record?.grantedBy).toBe("manual")

    revokeReportCardAccess({ parentId, studentId, session, term: firstTerm })
    const afterRevocation = hasReportCardAccess({ parentId, studentId, session, term: firstTerm })
    expect(afterRevocation.granted).toBe(false)

    // Three meaningful updates should have occurred: payment grant, manual override, revocation
    expect(listener).toHaveBeenCalledTimes(3)

    globalThis.removeEventListener(REPORT_CARD_ACCESS_EVENT, listener as EventListener)
  })
})
