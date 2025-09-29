import {
  shouldSendAssignmentReminder,
  markAssignmentReminderSent,
  clearAssignmentReminderHistory,
  type AssignmentReminderType,
} from "@/lib/assignment-reminders"
import { safeStorage } from "@/lib/safe-storage"

describe("assignment reminder helpers", () => {
  const STORAGE_KEY = "assignmentReminderLog"

  const resetStorage = () => {
    safeStorage.removeItem(STORAGE_KEY)
  }

  beforeEach(() => {
    resetStorage()
  })

  it("allows reminders when no history exists and blocks repeat sends", () => {
    const assignmentId = "assignment-1"

    expect(shouldSendAssignmentReminder("student", assignmentId, "dueSoon")).toBe(true)

    markAssignmentReminderSent("student", assignmentId, "dueSoon", { dueDate: "2024-01-01" })

    expect(shouldSendAssignmentReminder("student", assignmentId, "dueSoon", { dueDate: "2024-01-01" })).toBe(false)
  })

  it("permits a resend when the due date changes", () => {
    const assignmentId = "assignment-2"

    markAssignmentReminderSent("teacher", assignmentId, "missingSubmissions", { dueDate: "2024-01-05" })

    expect(
      shouldSendAssignmentReminder("teacher", assignmentId, "missingSubmissions", { dueDate: "2024-01-05" }),
    ).toBe(false)

    expect(
      shouldSendAssignmentReminder("teacher", assignmentId, "missingSubmissions", { dueDate: "2024-01-07" }),
    ).toBe(true)
  })

  it("clears selected reminder types while preserving others", () => {
    const assignmentId = "assignment-3"
    const reminderTypes: AssignmentReminderType[] = ["dueSoon", "overdue", "gradingPending"]

    reminderTypes.forEach((type, index) => {
      const day = String(index + 1).padStart(2, "0")
      markAssignmentReminderSent("student", assignmentId, type, { dueDate: `2024-02-${day}` })
    })

    clearAssignmentReminderHistory("student", assignmentId, { types: ["dueSoon", "gradingPending"] })

    expect(shouldSendAssignmentReminder("student", assignmentId, "dueSoon", { dueDate: "2024-02-01" })).toBe(true)
    expect(shouldSendAssignmentReminder("student", assignmentId, "gradingPending", { dueDate: "2024-02-03" })).toBe(true)
    expect(shouldSendAssignmentReminder("student", assignmentId, "overdue", { dueDate: "2024-02-02" })).toBe(false)

    clearAssignmentReminderHistory("student", assignmentId)

    expect(shouldSendAssignmentReminder("student", assignmentId, "overdue", { dueDate: "2024-02-02" })).toBe(true)
  })

  it("ignores operations for empty assignment identifiers", () => {
    expect(shouldSendAssignmentReminder("teacher", "", "overdue")).toBe(false)

    markAssignmentReminderSent("teacher", "", "overdue")

    expect(shouldSendAssignmentReminder("teacher", "", "overdue")).toBe(false)
  })
})
