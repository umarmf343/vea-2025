export const runtime = "nodejs"

import { type NextRequest, NextResponse } from "next/server"

import {
  getAllClassesFromDb,
  getClassRecordById,
  type ClassRecord,
} from "@/lib/database"
import { normalizeSubjectList } from "@/lib/subject-utils"

const normalizeString = (value: unknown): string => {
  if (typeof value !== "string") {
    return ""
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : ""
}

const normalizeToken = (value: unknown): string => {
  const normalized = normalizeString(value)
  return normalized ? normalized.replace(/\s+/g, "").toLowerCase() : ""
}

const resolveClassRecord = async (
  identifier: string,
  fallbackName: string,
): Promise<ClassRecord | null> => {
  const normalizedIdentifier = normalizeString(identifier)
  const normalizedFallback = normalizeString(fallbackName)

  if (!normalizedIdentifier && !normalizedFallback) {
    return null
  }

  if (normalizedIdentifier) {
    const recordById = await getClassRecordById(normalizedIdentifier)
    if (recordById) {
      return recordById
    }
  }

  const classes = await getAllClassesFromDb()
  const targetToken = normalizeToken(normalizedIdentifier || normalizedFallback)

  if (!targetToken) {
    return null
  }

  return (
    classes.find((entry) => normalizeToken(entry.id) === targetToken) ??
    classes.find((entry) => normalizeToken(entry.name) === targetToken) ??
    null
  )
}

export async function GET(
  request: NextRequest,
  context: { params: { identifier?: string } },
) {
  try {
    const identifierParam = normalizeString(context.params?.identifier ?? "")
    const { searchParams } = new URL(request.url)
    const fallbackName = searchParams.get("name") ?? ""

    if (!identifierParam && !fallbackName) {
      return NextResponse.json(
        { error: "Class identifier is required" },
        { status: 400 },
      )
    }

    const classRecord = await resolveClassRecord(identifierParam, fallbackName)

    if (!classRecord) {
      return NextResponse.json(
        {
          subjects: [],
          message: "No matching class was found. Please verify the class selection.",
        },
        { status: 404 },
      )
    }

    const subjects = normalizeSubjectList(classRecord.subjects)

    return NextResponse.json({
      class: { id: classRecord.id, name: classRecord.name },
      subjects,
      message:
        subjects.length === 0
          ? "No subjects have been assigned to this class yet."
          : undefined,
    })
  } catch (error) {
    console.error("Failed to fetch class subjects", error)
    return NextResponse.json(
      { error: "Unable to load subjects for the selected class" },
      { status: 500 },
    )
  }
}

