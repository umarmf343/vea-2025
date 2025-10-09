"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, PrinterIcon as Print } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useBranding } from "@/hooks/use-branding";
import { useToast } from "@/hooks/use-toast";
import {
  AFFECTIVE_TRAITS,
  PSYCHOMOTOR_SKILLS,
  createBehavioralRecordSkeleton,
  getAffectiveTraitLabel,
  getPsychomotorSkillLabel,
  normalizeBehavioralSelections,
} from "@/lib/report-card-constants";
import type {
  ClassTeacherRemarkEntry,
  ClassTeacherSubjectRemark,
  RawReportCardData,
} from "@/lib/report-card-types";
import { deriveGradeFromScore } from "@/lib/grade-utils";
import { getHtmlToImage } from "@/lib/html-to-image-loader";
import { getJsPdf } from "@/lib/jspdf-loader";
import { safeStorage } from "@/lib/safe-storage";
import { resolveStudentPassportFromCache } from "@/lib/student-passport";
import { dbManager } from "@/lib/database-manager";
import {
  applyLayoutDefaults,
  DEFAULT_REPORT_CARD_LAYOUT_CONFIG,
  type ReportCardLayoutConfig,
} from "@/lib/report-card-layout-config";
import {
  DEFAULT_REPORT_CARD_COLUMNS,
  buildResolvedColumns,
  clampScoreToColumn,
  getColumnMaximum,
  normalizeColumnType,
  normalizeColumnsFromResponse,
  type ReportCardColumnConfig,
  type ResolvedReportCardColumn,
} from "@/lib/report-card-columns";
import { logger } from "@/lib/logger";

interface SubjectScore {
  name: string;
  ca1: number;
  ca2: number;
  assignment: number;
  caTotal: number;
  exam: number;
  total: number;
  grade: string;
  remarks: string;
  position?: string;
  columnScores: Record<string, number>;
  subjectKey?: string;
  remarkStatus?: ClassTeacherSubjectRemark | null;
}

interface AttendanceSummary {
  present: number;
  absent: number;
  total: number;
  percentage: number;
}

interface NormalizedReportCard {
  student: {
    id: string;
    name: string;
    admissionNumber: string;
    class: string;
    term: string;
    session: string;
    numberInClass?: number;
    statusLabel?: string;
    positionLabel?: string;
    dateOfBirth?: string;
    gender?: string;
    age?: number;
    passportUrl?: string | null;
    photoUrl?: string | null;
  };
  subjects: SubjectScore[];
  summary: {
    totalMarksObtainable: number;
    totalMarksObtained: number;
    averageScore: number;
    positionLabel: string;
    numberOfStudents?: number;
    classAverage?: number;
    highestScore?: number;
    lowestScore?: number;
    grade?: string;
  };
  attendance: AttendanceSummary;
  affectiveDomain: Record<string, boolean>;
  psychomotorDomain: Record<string, boolean>;
  remarks: {
    classTeacher: string;
    headTeacher: string;
  };
  termInfo: {
    numberInClass?: number;
    vacationEnds?: string;
    nextTermBegins?: string;
    nextTermFees?: string;
    feesBalance?: string;
  };
  branding: {
    schoolName: string;
    address: string;
    educationZone: string;
    councilArea: string;
    contactPhone: string;
    contactEmail: string;
    logo: string | null;
    signature: string | null;
    headmasterName: string;
    defaultRemark: string;
  };
  teacher: {
    id: string | null;
    name: string | null;
    signatureUrl: string | null;
  } | null;
  assessmentMaximums: {
    continuousAssessment: number;
    exam: number;
    total: number;
  };
  remarkAssignments: Record<string, ClassTeacherSubjectRemark>;
}

type StoredClassTeacherRemarkEntry = {
  label?: string;
  remark?: string;
};

type StoredClassTeacherRemarkRecord = {
  remark?: string;
  remarksBySubject?: Record<string, StoredClassTeacherRemarkEntry>;
  remarkAssignments?: Record<string, StoredClassTeacherRemarkEntry>;
};

const CLASS_TEACHER_REMARK_LABELS: Record<ClassTeacherSubjectRemark, string> = {
  Excellent: "Excellent",
  "V.Good": "Very Good",
  Good: "Good",
  Poor: "Poor",
};

const CLASS_TEACHER_REMARK_CLASS_MAP: Record<
  ClassTeacherSubjectRemark,
  string
> = {
  Excellent: "excellent",
  "V.Good": "vgood",
  Good: "good",
  Poor: "poor",
};

const REMARK_KEY_SEPARATOR = "::";

const buildRemarkKey = (subjectKey: string, studentId: string) =>
  `${subjectKey}${REMARK_KEY_SEPARATOR}${studentId}`;

const interpretClassTeacherRemark = (
  value: unknown,
): ClassTeacherSubjectRemark | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.toLowerCase().replace(/\s+/g, "");
  if (
    normalized === "vgood" ||
    normalized === "v.good" ||
    normalized === "verygood"
  ) {
    return "V.Good";
  }

  if (normalized === "excellent") {
    return "Excellent";
  }
  if (normalized === "good") {
    return "Good";
  }
  if (normalized === "poor") {
    return "Poor";
  }

  return null;
};

const STORAGE_KEYS_TO_WATCH = [
  "studentMarks",
  "behavioralAssessments",
  "attendancePositions",
  "classTeacherRemarks",
  "studentPhotos",
  "students",
];

const LAYOUT_STORAGE_KEY = "reportCardLayoutConfig";
const TEACHER_SIGNATURE_STORAGE_KEY = "teacherSignatures";
const DEFAULT_LAYOUT_REFERENCE = applyLayoutDefaults(
  DEFAULT_REPORT_CARD_LAYOUT_CONFIG,
);

const sanitizeKey = (value: string) =>
  value.replace(/[^a-z0-9]+/gi, "").toLowerCase();

const readNonEmptyString = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
};

const normalizeIdentifier = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
};

const parseScoreInput = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }

    const parsed = Number.parseFloat(trimmed);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const resolveValueFromSource = (
  source: Record<string, unknown>,
  candidate: string,
): number | null => {
  if (candidate in source) {
    const direct = parseScoreInput(source[candidate]);
    if (direct !== null) {
      return direct;
    }
  }

  const normalizedCandidate = candidate.toLowerCase();
  const sanitizedCandidate = sanitizeKey(candidate);

  for (const [key, raw] of Object.entries(source)) {
    if (typeof key !== "string") {
      continue;
    }

    if (
      key === candidate ||
      key.toLowerCase() === normalizedCandidate ||
      sanitizeKey(key) === sanitizedCandidate
    ) {
      const parsed = parseScoreInput(raw);
      if (parsed !== null) {
        return parsed;
      }
    }
  }

  return null;
};

const resolveColumnScore = (
  subject: Record<string, unknown>,
  column: ResolvedReportCardColumn,
): number => {
  const sources: Record<string, unknown>[] = [subject];

  const nestedCandidates = [
    "scores",
    "assessments",
    "tests",
    "columns",
    "marks",
    "components",
  ];
  nestedCandidates.forEach((key) => {
    const nested = subject[key as keyof typeof subject];
    if (nested && typeof nested === "object") {
      sources.push(nested as Record<string, unknown>);
    }
  });

  for (const source of sources) {
    for (const candidate of column.keyCandidates) {
      const resolved = resolveValueFromSource(source, candidate);
      if (resolved !== null) {
        return clampScoreToColumn(resolved, column.config);
      }
    }
  }

  const type = normalizeColumnType(column.config.type);
  const occurrence = column.occurrence;

  const fallbackKeys: string[] = [];
  if (type === "test") {
    fallbackKeys.push(`ca${occurrence}`);
    if (occurrence === 1) {
      fallbackKeys.push("firstCA", "first_ca");
    }
    if (occurrence === 2) {
      fallbackKeys.push("secondCA", "second_ca");
    }
  } else if (type === "assignment") {
    fallbackKeys.push(
      "assignment",
      "noteAssignment",
      "note_assignment",
      "continuousAssessment",
    );
  } else if (type === "project") {
    fallbackKeys.push("project", "projectScore", "project_score");
  } else if (type === "exam") {
    if (occurrence === 1) {
      fallbackKeys.push("exam", "examScore", "exam_score");
    } else {
      fallbackKeys.push(`exam${occurrence}`, `exam_${occurrence}`);
    }
  }

  for (const key of fallbackKeys) {
    const resolved = resolveValueFromSource(subject, key);
    if (resolved !== null) {
      return clampScoreToColumn(resolved, column.config);
    }
  }

  return 0;
};

const formatBehavioralLabel = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map(
      (segment) =>
        segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase(),
    )
    .join(" ");

const getDefaultSectionById = (id: string) =>
  DEFAULT_LAYOUT_REFERENCE.sections.find((section) => section.id === id);

const getDefaultSectionTitle = (id: string) => {
  const section = getDefaultSectionById(id);
  if (section) {
    const trimmed = section.title.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return formatBehavioralLabel(id);
};

const getDefaultFieldLabel = (sectionId: string, fieldId: string) => {
  const section = getDefaultSectionById(sectionId);
  const field = section?.fields.find((entry) => entry.id === fieldId);
  if (field) {
    const trimmed = field.label.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  switch (sectionId) {
    case "remarks":
      return fieldId === "head_teacher_remark"
        ? "Head Teacher's Remark"
        : "Class Teacher Remarks";
    case "signatures":
      if (fieldId === "teacher_signature_label") {
        return "Teacher's Signature:";
      }
      if (fieldId === "head_signature_label") {
        return "Headmaster's Signature:";
      }
      if (fieldId === "head_name_label") {
        return "";
      }
      return formatBehavioralLabel(fieldId);
    default:
      return formatBehavioralLabel(fieldId);
  }
};

const PX_PER_MM = 96 / 25.4;
const convertPxToMm = (value: number) => value / PX_PER_MM;

const sanitizeFileName = (value: string) => {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned.length > 0 ? cleaned : "report-card";
};

const removeNonPrintableNodes = (root: HTMLElement) => {
  const elements = root.querySelectorAll<HTMLElement>("*");
  elements.forEach((element) => {
    const classNames = Array.from(element.classList);
    if (
      classNames.includes("no-export") ||
      classNames.includes("print:hidden")
    ) {
      element.remove();
    }
  });
};

const createPrintableClone = (element: HTMLElement) => {
  const referenceRect = element.getBoundingClientRect();
  const width = Math.max(Math.round(referenceRect.width), 0);
  const height = Math.max(Math.round(referenceRect.height), 0);

  const clone = element.cloneNode(true) as HTMLElement;
  removeNonPrintableNodes(clone);

  const defaultDocument =
    typeof globalThis !== "undefined" && "document" in globalThis
      ? (globalThis.document as Document)
      : null;
  const doc = element.ownerDocument ?? defaultDocument;

  if (!doc) {
    return {
      clone,
      cleanup: () => {},
      width,
      height,
    };
  }

  const wrapper = doc.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.top = "0";
  wrapper.style.left = "0";
  wrapper.style.pointerEvents = "none";
  wrapper.style.opacity = "0";
  wrapper.style.zIndex = "-1";
  wrapper.style.background = "transparent";
  if (width > 0) {
    wrapper.style.width = `${width}px`;
  }
  if (height > 0) {
    wrapper.style.height = `${height}px`;
  }

  const defaultView = element.ownerDocument?.defaultView;
  const computedStyle = defaultView?.getComputedStyle(element);

  clone.style.margin = "0";
  clone.style.boxSizing = "border-box";
  clone.style.width = width > 0 ? `${width}px` : element.style.width;
  clone.style.maxWidth = "none";
  clone.style.height = "auto";
  clone.style.backgroundColor = computedStyle?.backgroundColor ?? "#ffffff";

  wrapper.appendChild(clone);
  doc.body.appendChild(wrapper);

  const measuredRect = clone.getBoundingClientRect();
  const measuredWidth = Math.max(Math.round(measuredRect.width), width);
  const measuredHeight = Math.max(Math.round(measuredRect.height), height);

  const cleanup = () => {
    if (wrapper.parentNode) {
      wrapper.parentNode.removeChild(wrapper);
    }
  };

  return { clone, cleanup, width: measuredWidth, height: measuredHeight };
};

const parseJsonRecord = (value: string | null) => {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};

const resolveBrowserWindow = () => {
  if (typeof globalThis === "undefined") {
    return null;
  }

  const candidate = globalThis as Window & typeof globalThis;

  return typeof candidate.addEventListener === "function" ? candidate : null;
};

const formatStatusLabel = (value?: string) => {
  if (!value || value.trim().length === 0) {
    return undefined;
  }

  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(
      (chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase(),
    )
    .join(" ");
};

const parseNumeric = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value.replace(/[^0-9.]/g, ""));
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  return undefined;
};

const parsePositionValue = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const match = value.match(/\d+/);
    if (match) {
      const parsed = Number.parseInt(match[0], 10);
      return Number.isNaN(parsed) ? undefined : parsed;
    }
  }

  return undefined;
};

const formatOrdinal = (position?: number) => {
  if (!position || !Number.isFinite(position)) {
    return undefined;
  }

  const suffix = (() => {
    const j = position % 10;
    const k = position % 100;
    if (j === 1 && k !== 11) return "st";
    if (j === 2 && k !== 12) return "nd";
    if (j === 3 && k !== 13) return "rd";
    return "th";
  })();

  return `${position}${suffix}`;
};

const calculateAge = (value?: string) => {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  const hasNotHadBirthdayThisYear =
    today.getMonth() < parsed.getMonth() ||
    (today.getMonth() === parsed.getMonth() &&
      today.getDate() < parsed.getDate());

  if (hasNotHadBirthdayThisYear) {
    age -= 1;
  }

  if (age < 0 || age > 150) {
    return undefined;
  }

  return age;
};

const formatDateDisplay = (value?: string) => {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const PRIMARY_AFFECTIVE_TRAITS = [
  { key: "neatness", label: "Neatness" },
  { key: "honesty", label: "Honesty" },
  { key: "punctuality", label: "Punctuality" },
] as const;

const PRIMARY_PSYCHOMOTOR_SKILLS = [
  { key: "sport", label: "Sport" },
  { key: "handwriting", label: "Handwriting" },
] as const;

const normalizeSubjects = (
  subjects: Array<Record<string, unknown>> | undefined,
  columns: ResolvedReportCardColumn[],
): SubjectScore[] => {
  if (!Array.isArray(subjects)) {
    return [];
  }

  const assessmentColumns = columns.filter((column) => !column.isExam);
  const examColumns = columns.filter((column) => column.isExam);

  return subjects.map((subjectEntry) => {
    const subject = subjectEntry as Record<string, unknown>;

    const fallbackCa1 = Number(
      subject.ca1 ?? subject.firstCA ?? subject.first_ca ?? 0,
    );
    const fallbackCa2 = Number(
      subject.ca2 ?? subject.secondCA ?? subject.second_ca ?? 0,
    );
    const fallbackAssignment = Number(
      subject.assignment ??
        subject.noteAssignment ??
        subject.continuousAssessment ??
        0,
    );
    const fallbackExam = Number(
      subject.exam ?? subject.examScore ?? subject.exam_score ?? 0,
    );

    const columnScores: Record<string, number> = {};
    columns.forEach((column) => {
      columnScores[column.config.id] = resolveColumnScore(subject, column);
    });

    const continuousAssessmentTotal = assessmentColumns.reduce(
      (sum, column) => sum + (columnScores[column.config.id] ?? 0),
      0,
    );
    const examTotal = examColumns.reduce(
      (sum, column) => sum + (columnScores[column.config.id] ?? 0),
      0,
    );
    const computedTotal = continuousAssessmentTotal + examTotal;

    const firstTestColumn = assessmentColumns.find(
      (column) =>
        normalizeColumnType(column.config.type) === "test" &&
        column.occurrence === 1,
    );
    const secondTestColumn = assessmentColumns.find(
      (column) =>
        normalizeColumnType(column.config.type) === "test" &&
        column.occurrence === 2,
    );
    const assignmentColumn = assessmentColumns.find(
      (column) => normalizeColumnType(column.config.type) === "assignment",
    );

    const ca1 = firstTestColumn
      ? (columnScores[firstTestColumn.config.id] ?? fallbackCa1)
      : fallbackCa1;
    const ca2 = secondTestColumn
      ? (columnScores[secondTestColumn.config.id] ?? fallbackCa2)
      : fallbackCa2;
    const assignment = assignmentColumn
      ? (columnScores[assignmentColumn.config.id] ?? fallbackAssignment)
      : fallbackAssignment;

    const caTotal =
      assessmentColumns.length > 0
        ? continuousAssessmentTotal
        : Number(subject.caTotal ?? ca1 + ca2 + assignment);
    const exam = examColumns.length > 0 ? examTotal : fallbackExam;
    const total =
      columns.length > 0
        ? computedTotal
        : Number(subject.total ?? subject.grandTotal ?? caTotal + exam);
    const grade = String(
      subject.grade ?? subject.letterGrade ?? "",
    ).toUpperCase();
    const remarks = String(subject.remarks ?? subject.teacherRemark ?? "");
    const rawPosition = parsePositionValue(
      subject.position ??
        subject.subjectPosition ??
        subject.rank ??
        subject.order ??
        null,
    );
    const positionLabel = rawPosition ? formatOrdinal(rawPosition) : undefined;
    const subjectKey =
      typeof subject.subjectKey === "string" &&
      subject.subjectKey.trim().length > 0
        ? subject.subjectKey.trim()
        : undefined;

    return {
      name: String(subject.name ?? subject.subject ?? "Unknown Subject"),
      ca1,
      ca2,
      assignment,
      caTotal,
      exam,
      total,
      grade,
      remarks,
      columnScores,
      subjectKey,
      remarkStatus: null,
      position:
        positionLabel ??
        (typeof subject.position === "string" &&
        subject.position.trim().length > 0
          ? subject.position
          : undefined),
    };
  });
};

const buildBehavioralDomain = (
  domain: "affective" | "psychomotor",
  defaults: readonly { key: string; label: string }[],
  stored: Record<string, unknown> | undefined,
  fallback: Record<string, boolean | undefined>,
): Record<string, boolean> => {
  const skeleton = createBehavioralRecordSkeleton(defaults);
  const normalizedStored = normalizeBehavioralSelections(domain, stored);
  const normalizedFallback = normalizeBehavioralSelections(domain, fallback);
  const merged: Record<string, boolean> = { ...skeleton };

  const applySelections = (entries: Record<string, boolean>) => {
    Object.entries(entries).forEach(([key, value]) => {
      if (key in merged) {
        merged[key] = value;
      } else {
        merged[key] = value;
      }
    });
  };

  applySelections(normalizedFallback);
  applySelections(normalizedStored);

  return merged;
};

const normalizeReportCard = (
  source: RawReportCardData | undefined,
  defaultBranding: ReturnType<typeof useBranding>,
  layoutConfig: ReportCardLayoutConfig,
  columns: ResolvedReportCardColumn[],
): NormalizedReportCard | null => {
  if (!source || !source.student) {
    return null;
  }

  const studentId =
    source.student.id ?? source.student.admissionNumber ?? source.student.name;
  const termLabel = source.student.term;
  const sessionLabel = source.student.session;
  const normalizedStudentId = String(studentId);
  const storageKey = `${normalizedStudentId}-${termLabel}-${sessionLabel}`;

  const behavioralStore = parseJsonRecord(
    safeStorage.getItem("behavioralAssessments"),
  );
  const attendanceStore = parseJsonRecord(
    safeStorage.getItem("attendancePositions"),
  );
  const remarksStore = parseJsonRecord(
    safeStorage.getItem("classTeacherRemarks"),
  );

  const behavioralRecord = behavioralStore[storageKey] as
    | {
        affectiveDomain?: Record<string, string>;
        psychomotorDomain?: Record<string, string>;
      }
    | undefined;

  const attendanceRecord = attendanceStore[storageKey] as
    | {
        position?: number | string | null;
        attendance?: { present?: number; absent?: number; total?: number };
        status?: string;
        termInfo?: Record<string, unknown>;
      }
    | undefined;

  const remarkRecord = remarksStore[storageKey] as
    | StoredClassTeacherRemarkRecord
    | undefined;

  const remarkAssignments = new Map<string, ClassTeacherSubjectRemark>();
  const registerRemarkAssignment = (key: string, value: unknown) => {
    if (!key) {
      return;
    }

    const interpreted = interpretClassTeacherRemark(value);
    if (interpreted) {
      remarkAssignments.set(key, interpreted);
    }
  };

  if (
    source.classTeacherRemarkAssignments &&
    typeof source.classTeacherRemarkAssignments === "object"
  ) {
    Object.entries(source.classTeacherRemarkAssignments).forEach(
      ([key, entry]) => {
        if (!key) {
          return;
        }

        if (entry && typeof entry === "object" && "remark" in entry) {
          registerRemarkAssignment(
            key,
            (entry as ClassTeacherRemarkEntry).remark,
          );
        } else {
          registerRemarkAssignment(key, entry);
        }
      },
    );
  }

  if (
    remarkRecord?.remarkAssignments &&
    typeof remarkRecord.remarkAssignments === "object"
  ) {
    Object.entries(remarkRecord.remarkAssignments).forEach(([key, entry]) => {
      if (!key) {
        return;
      }

      if (entry && typeof entry === "object" && "remark" in entry) {
        registerRemarkAssignment(key, (entry as { remark?: unknown }).remark);
      } else {
        registerRemarkAssignment(key, entry);
      }
    });
  }

  const storedRemarkSummaryFromSubjects = remarkRecord?.remarksBySubject
    ? (() => {
        const summary = Object.values(remarkRecord.remarksBySubject ?? {})
          .map((entry) => {
            const label = entry?.label?.trim();
            const remark = entry?.remark?.trim();

            if (!label || !remark) {
              return null;
            }

            return `${label}: ${remark}`;
          })
          .filter((value): value is string => Boolean(value))
          .join(" • ");

        return summary.length > 0 ? summary : undefined;
      })()
    : undefined;

  if (
    remarkRecord?.remarksBySubject &&
    typeof remarkRecord.remarksBySubject === "object"
  ) {
    Object.entries(remarkRecord.remarksBySubject).forEach(
      ([subjectKey, entry]) => {
        if (!subjectKey) {
          return;
        }

        const remarkKey = buildRemarkKey(subjectKey, normalizedStudentId);
        if (entry && typeof entry === "object" && "remark" in entry) {
          registerRemarkAssignment(remarkKey, entry.remark);
        } else {
          registerRemarkAssignment(remarkKey, entry);
        }
      },
    );
  }

  const rawSubjects = normalizeSubjects(source.subjects, columns);

  if (remarkRecord?.remark) {
    const hasStudentAssignment = Array.from(remarkAssignments.keys()).some(
      (key) => key.endsWith(`${REMARK_KEY_SEPARATOR}${normalizedStudentId}`),
    );

    if (!hasStudentAssignment) {
      const fallbackSubjectKey =
        rawSubjects[0]?.subjectKey ??
        (rawSubjects[0]?.name ? String(rawSubjects[0].name) : "general");
      registerRemarkAssignment(
        buildRemarkKey(fallbackSubjectKey, normalizedStudentId),
        remarkRecord.remark,
      );
    }
  }

  const normalizedSubjects = rawSubjects.map((subject) => {
    const subjectKey = subject.subjectKey ?? subject.name;
    const remarkKey = subjectKey
      ? buildRemarkKey(subjectKey, normalizedStudentId)
      : null;
    const status = remarkKey
      ? (remarkAssignments.get(remarkKey) ?? null)
      : null;
    const remarkLabel = status
      ? CLASS_TEACHER_REMARK_LABELS[status]
      : (subject.remarks?.trim() ?? "");

    return {
      ...subject,
      subjectKey,
      remarkStatus: status,
      remarks: remarkLabel,
    };
  });
  const hasConfiguredColumns = columns.length > 0;
  const computedContinuousMaximum = columns
    .filter((column) => !column.isExam)
    .reduce((sum, column) => sum + getColumnMaximum(column.config), 0);
  const computedExamMaximum = columns
    .filter((column) => column.isExam)
    .reduce((sum, column) => sum + getColumnMaximum(column.config), 0);
  const continuousAssessmentMaximum = hasConfiguredColumns
    ? computedContinuousMaximum
    : 40;
  const examMaximum = hasConfiguredColumns ? computedExamMaximum : 60;
  const totalMaximum = hasConfiguredColumns
    ? continuousAssessmentMaximum + examMaximum
    : continuousAssessmentMaximum + examMaximum;

  const computedTotalObtained = normalizedSubjects.reduce(
    (sum, subject) => sum + subject.total,
    0,
  );
  const computedTotalObtainable = normalizedSubjects.length * totalMaximum;
  const computedAverage =
    computedTotalObtainable > 0
      ? (computedTotalObtained / computedTotalObtainable) * 100
      : 0;

  const summaryTotalObtainable = computedTotalObtainable;
  const summaryTotalObtained = computedTotalObtained;
  const summaryAverageScore = computedAverage;

  const positionNumber =
    parsePositionValue(attendanceRecord?.position) ??
    parsePositionValue(source.summary?.position) ??
    parsePositionValue(source.position);

  const positionLabel =
    formatOrdinal(positionNumber) ??
    source.summary?.position?.toString() ??
    source.position ??
    "";
  const numberInClass =
    parseNumeric(attendanceRecord?.termInfo?.numberInClass) ??
    parseNumeric(source.termInfo?.numberInClass) ??
    parseNumeric(source.summary?.numberOfStudents) ??
    parseNumeric(source.student.numberInClass);

  const attendancePresent =
    parseNumeric(attendanceRecord?.attendance?.present) ??
    parseNumeric(source.attendance?.present) ??
    0;
  const attendanceAbsent =
    parseNumeric(attendanceRecord?.attendance?.absent) ??
    parseNumeric(source.attendance?.absent) ??
    0;
  const attendanceTotal =
    parseNumeric(attendanceRecord?.attendance?.total) ??
    parseNumeric(source.attendance?.total) ??
    0;

  const normalizedAttendance = {
    present: Math.max(0, Math.round(attendancePresent)),
    absent: Math.max(0, Math.round(attendanceAbsent)),
    total: Math.max(0, Math.round(attendanceTotal)),
  };
  const inferredTotal =
    normalizedAttendance.total > 0
      ? normalizedAttendance.total
      : normalizedAttendance.present + normalizedAttendance.absent;
  const attendanceStats = {
    present: normalizedAttendance.present,
    absent: normalizedAttendance.absent,
    total: inferredTotal,
  };
  const attendancePercentage =
    inferredTotal > 0
      ? Math.round((attendanceStats.present / inferredTotal) * 100)
      : 0;

  const normalizedLayout = applyLayoutDefaults(layoutConfig);

  const layoutAffective = normalizedLayout.affectiveTraits
    .filter((item) => item.enabled !== false && item.label.trim().length > 0)
    .map((item) => ({ key: item.id, label: item.label.trim() }));

  const layoutPsychomotor = normalizedLayout.psychomotorSkills
    .filter((item) => item.enabled !== false && item.label.trim().length > 0)
    .map((item) => ({ key: item.id, label: item.label.trim() }));

  const defaultAffectiveTraits =
    layoutAffective.length > 0
      ? layoutAffective
      : [...PRIMARY_AFFECTIVE_TRAITS, ...AFFECTIVE_TRAITS];

  const defaultPsychomotorSkills =
    layoutPsychomotor.length > 0
      ? layoutPsychomotor
      : [...PRIMARY_PSYCHOMOTOR_SKILLS, ...PSYCHOMOTOR_SKILLS];

  const affectiveSelections = buildBehavioralDomain(
    "affective",
    defaultAffectiveTraits,
    behavioralRecord?.affectiveDomain,
    source.affectiveDomain ?? {},
  );
  const psychomotorSelections = buildBehavioralDomain(
    "psychomotor",
    defaultPsychomotorSkills,
    behavioralRecord?.psychomotorDomain,
    source.psychomotorDomain ?? {},
  );

  const resolvedBranding = {
    schoolName:
      source.branding?.schoolName?.trim() || defaultBranding.schoolName,
    address: source.branding?.address?.trim() || defaultBranding.schoolAddress,
    educationZone:
      source.branding?.educationZone?.trim() || defaultBranding.educationZone,
    councilArea:
      source.branding?.councilArea?.trim() || defaultBranding.councilArea,
    contactPhone:
      source.branding?.contactPhone?.trim() || defaultBranding.contactPhone,
    contactEmail:
      source.branding?.contactEmail?.trim() || defaultBranding.contactEmail,
    logo: source.branding?.logo ?? defaultBranding.logoUrl ?? null,
    signature:
      source.branding?.signature ?? defaultBranding.signatureUrl ?? null,
    headmasterName:
      source.branding?.headmasterName?.trim() || defaultBranding.headmasterName,
    defaultRemark:
      source.branding?.defaultRemark?.trim() || defaultBranding.defaultRemark,
  };

  if (!resolvedBranding.logo) {
    logger.warn(
      "Report card branding missing school logo; displaying placeholder.",
    );
  }

  if (!resolvedBranding.signature) {
    logger.warn(
      "Report card branding missing headmaster signature; displaying placeholder.",
    );
  }

  const termInfo = {
    numberInClass,
    vacationEnds:
      source.termInfo?.vacationEnds ??
      source.vacationDate ??
      attendanceRecord?.termInfo?.vacationEnds,
    nextTermBegins:
      source.termInfo?.nextTermBegins ??
      source.resumptionDate ??
      attendanceRecord?.termInfo?.nextTermBegins,
    nextTermFees:
      source.termInfo?.nextTermFees ??
      source.fees?.nextTerm ??
      attendanceRecord?.termInfo?.nextTermFees,
    feesBalance:
      source.termInfo?.feesBalance ??
      source.fees?.outstanding ??
      attendanceRecord?.termInfo?.feesBalance,
  };

  const extractPassportCandidate = (value: unknown): string | null => {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const directPassportCandidate = extractPassportCandidate(
    (source.student as { passportUrl?: unknown }).passportUrl,
  );
  const directPhotoCandidate = extractPassportCandidate(
    (source.student as { photoUrl?: unknown }).photoUrl,
  );

  let passportUrl = directPassportCandidate ?? directPhotoCandidate ?? null;

  if (!passportUrl) {
    const storedStudentsRaw = safeStorage.getItem("students");
    if (storedStudentsRaw) {
      try {
        const parsed = JSON.parse(storedStudentsRaw) as Array<
          Record<string, unknown>
        >;
        const normalizedId = String(studentId);
        const normalizedAdmission = String(
          source.student.admissionNumber ?? "",
        );
        const normalizedName = source.student.name.trim().toLowerCase();

        const matched = parsed.find((entry) => {
          const entryId =
            typeof entry.id === "string" ? entry.id : String(entry.id ?? "");
          const entryAdmission =
            typeof entry.admissionNumber === "string"
              ? entry.admissionNumber
              : String(entry.admissionNumber ?? "");
          const entryName =
            typeof entry.name === "string"
              ? entry.name.trim().toLowerCase()
              : "";

          return (
            (!!normalizedId && entryId === normalizedId) ||
            (!!normalizedAdmission && entryAdmission === normalizedAdmission) ||
            (!!normalizedName && entryName === normalizedName)
          );
        });

        if (matched) {
          passportUrl =
            extractPassportCandidate(matched.passportUrl) ??
            extractPassportCandidate(matched.photoUrl) ??
            passportUrl;
        }
      } catch (error) {
        logger.warn("Unable to parse stored students for passport lookup", {
          error,
        });
      }
    }
  }

  const fallbackPassportRecord: Record<string, unknown> = {};
  if (passportUrl) {
    fallbackPassportRecord.passportUrl = passportUrl;
  }
  if (directPhotoCandidate) {
    fallbackPassportRecord.photoUrl = directPhotoCandidate;
  }

  const { passportUrl: cachedPassportUrl, photoUrl: cachedPhotoUrl } =
    resolveStudentPassportFromCache(
      {
        id: String(studentId),
        admissionNumber: source.student.admissionNumber,
        name: source.student.name,
      },
      Object.keys(fallbackPassportRecord).length > 0
        ? fallbackPassportRecord
        : null,
    );

  if (!passportUrl && cachedPassportUrl) {
    passportUrl = cachedPassportUrl;
  }

  const resolvedPhotoUrl = cachedPhotoUrl ?? passportUrl ?? null;

  const teacherSource = source.teacher;
  const teacherRecord =
    teacherSource && typeof teacherSource === "object"
      ? (teacherSource as Record<string, unknown>)
      : typeof teacherSource === "string"
        ? { name: teacherSource }
        : null;
  const teacherId =
    normalizeIdentifier(teacherRecord?.id) ??
    normalizeIdentifier(
      (teacherRecord as { teacherId?: unknown } | null)?.teacherId,
    );
  const teacherName =
    readNonEmptyString(teacherRecord?.name) ??
    readNonEmptyString(
      (teacherRecord as { teacherName?: unknown } | null)?.teacherName,
    ) ??
    readNonEmptyString(
      (teacherRecord as { fullName?: unknown } | null)?.fullName,
    ) ??
    readNonEmptyString(source.remarks?.classTeacher) ??
    readNonEmptyString(source.classTeacherRemarks);
  const teacherSignatureFromSource =
    readNonEmptyString(teacherRecord?.signatureUrl) ??
    readNonEmptyString(
      (teacherRecord as { signature?: unknown } | null)?.signature,
    ) ??
    readNonEmptyString(
      (teacherRecord as { signatureURL?: unknown } | null)?.signatureURL,
    ) ??
    readNonEmptyString((teacherRecord as { url?: unknown } | null)?.url);

  let teacherSignatureUrl = teacherSignatureFromSource;

  if (!teacherSignatureUrl && teacherId) {
    const signatureStore = parseJsonRecord(
      safeStorage.getItem(TEACHER_SIGNATURE_STORAGE_KEY),
    );
    if (signatureStore && typeof signatureStore === "object") {
      const entry = signatureStore[teacherId] as { url?: unknown } | undefined;
      if (entry && typeof entry === "object") {
        teacherSignatureUrl = readNonEmptyString(entry.url);
      }
    }
  }

  const normalizedTeacher =
    teacherId || teacherName || teacherSignatureUrl
      ? {
          id: teacherId ?? null,
          name: teacherName ?? null,
          signatureUrl: teacherSignatureUrl ?? null,
        }
      : null;

  const remarkAssignmentsRecord = Object.fromEntries(
    remarkAssignments.entries(),
  );

  return {
    student: {
      id: String(studentId),
      name: source.student.name,
      admissionNumber: source.student.admissionNumber,
      class: source.student.class,
      term: termLabel,
      session: sessionLabel,
      numberInClass,
      statusLabel: formatStatusLabel(
        attendanceRecord?.status ?? source.student.status,
      ),
      positionLabel,
      dateOfBirth: source.student.dateOfBirth ?? undefined,
      gender: source.student.gender ?? undefined,
      age: calculateAge(source.student.dateOfBirth),
      passportUrl,
      photoUrl: resolvedPhotoUrl,
    },
    subjects: normalizedSubjects,
    summary: {
      totalMarksObtainable: summaryTotalObtainable,
      totalMarksObtained: summaryTotalObtained,
      averageScore: summaryAverageScore,
      positionLabel,
      numberOfStudents: numberInClass,
      classAverage: source.summary?.classAverage,
      highestScore: source.summary?.highestScore,
      lowestScore: source.summary?.lowestScore,
      grade: source.summary?.grade ?? deriveGradeFromScore(summaryAverageScore),
    },
    attendance: {
      present: attendanceStats.present,
      absent: attendanceStats.absent,
      total: inferredTotal,
      percentage: attendancePercentage,
    },
    affectiveDomain: affectiveSelections,
    psychomotorDomain: psychomotorSelections,
    remarks: {
      classTeacher:
        remarkRecord?.remark?.trim() ??
        storedRemarkSummaryFromSubjects ??
        source.classTeacherRemarks?.trim() ??
        source.remarks?.classTeacher?.trim() ??
        "",
      headTeacher:
        source.remarks?.headTeacher?.trim() || resolvedBranding.defaultRemark,
    },
    termInfo,
    branding: resolvedBranding,
    teacher: normalizedTeacher,
    assessmentMaximums: {
      continuousAssessment: continuousAssessmentMaximum,
      exam: examMaximum,
      total: totalMaximum,
    },
    remarkAssignments: remarkAssignmentsRecord,
  };
};

export function EnhancedReportCard({ data }: { data?: RawReportCardData }) {
  const branding = useBranding();
  const { toast } = useToast();
  const [layoutConfig, setLayoutConfig] = useState<ReportCardLayoutConfig>(
    () => {
      const stored = safeStorage.getItem(LAYOUT_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as Partial<ReportCardLayoutConfig>;
          return applyLayoutDefaults(parsed);
        } catch (error) {
          logger.warn(
            "Failed to parse stored report card layout configuration",
            { error },
          );
        }
      }

      return applyLayoutDefaults(DEFAULT_LAYOUT_REFERENCE);
    },
  );
  const [columnConfig, setColumnConfig] = useState<ReportCardColumnConfig[]>(
    DEFAULT_REPORT_CARD_COLUMNS,
  );
  const resolvedColumns = useMemo(
    () => buildResolvedColumns(columnConfig),
    [columnConfig],
  );
  const [reportCardData, setReportCardData] =
    useState<NormalizedReportCard | null>(() =>
      normalizeReportCard(data, branding, layoutConfig, resolvedColumns),
    );
  const [studentPhoto, setStudentPhoto] = useState<string>("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const renderSubjectRemark = (subject: SubjectScore) => {
    const remarkText =
      typeof subject.remarks === "string" ? subject.remarks.trim() : "";
    if (subject.remarkStatus && remarkText) {
      const className = CLASS_TEACHER_REMARK_CLASS_MAP[subject.remarkStatus];
      return (
        <span className={`remark-pill remark-${className}`}>{remarkText}</span>
      );
    }

    return remarkText.length > 0 ? remarkText : "—";
  };

  useEffect(() => {
    let isMounted = true;

    const fetchLayout = async () => {
      try {
        const response = await fetch("/api/report-cards/layout");
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          layout: ReportCardLayoutConfig;
        };
        if (!isMounted) {
          return;
        }

        const normalized = applyLayoutDefaults(payload.layout);
        setLayoutConfig((previous) => {
          const prevSerialized = JSON.stringify(previous);
          const nextSerialized = JSON.stringify(normalized);
          if (prevSerialized === nextSerialized) {
            return previous;
          }
          safeStorage.setItem(LAYOUT_STORAGE_KEY, nextSerialized);
          return normalized;
        });
      } catch (error) {
        logger.warn("Unable to load report card layout configuration", {
          error,
        });
      }
    };

    void fetchLayout();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadColumns = async () => {
      try {
        const response = await fetch("/api/report-cards/config");
        if (!response.ok) {
          throw new Error("Failed to load report card configuration");
        }

        const payload = (await response.json()) as { columns?: unknown };
        if (!isMounted) {
          return;
        }

        const normalized = normalizeColumnsFromResponse(payload.columns);
        setColumnConfig((previous) => {
          const prevSerialized = JSON.stringify(previous);
          const nextSerialized = JSON.stringify(normalized);
          if (prevSerialized === nextSerialized) {
            return previous;
          }
          return normalized;
        });
      } catch (error) {
        logger.warn("Unable to load report card columns configuration", {
          error,
        });
        if (!isMounted) {
          return;
        }
        setColumnConfig((previous) => {
          const prevSerialized = JSON.stringify(previous);
          const fallbackSerialized = JSON.stringify(
            DEFAULT_REPORT_CARD_COLUMNS,
          );
          if (prevSerialized === fallbackSerialized) {
            return previous;
          }
          return DEFAULT_REPORT_CARD_COLUMNS;
        });
      }
    };

    void loadColumns();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    try {
      safeStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layoutConfig));
    } catch (error) {
      logger.warn("Unable to persist report card layout configuration", {
        error,
      });
    }
  }, [layoutConfig]);

  useEffect(() => {
    const browserWindow = resolveBrowserWindow();
    if (!browserWindow) {
      return undefined;
    }

    const updateData = () => {
      const normalized = normalizeReportCard(
        data,
        branding,
        layoutConfig,
        resolvedColumns,
      );
      setReportCardData(normalized);

      if (!normalized) {
        setStudentPhoto("");
        return;
      }

      if (normalized.student.passportUrl || normalized.student.photoUrl) {
        setStudentPhoto(
          normalized.student.passportUrl ?? normalized.student.photoUrl ?? "",
        );
        return;
      }

      const storageKey = `${normalized.student.id}-${normalized.student.term}-${normalized.student.session}`;
      const photoStore = parseJsonRecord(safeStorage.getItem("studentPhotos"));
      const storedPhoto = photoStore[storageKey];

      if (typeof storedPhoto === "string" && storedPhoto.trim().length > 0) {
        setStudentPhoto(storedPhoto);
      } else {
        setStudentPhoto("");
      }
    };

    updateData();

    const handleStorageChange = (event: StorageEvent) => {
      if (!event.key || !STORAGE_KEYS_TO_WATCH.includes(event.key)) {
        return;
      }
      updateData();
    };

    browserWindow.addEventListener("storage", handleStorageChange);

    return () => {
      browserWindow.removeEventListener("storage", handleStorageChange);
    };
  }, [data, branding, layoutConfig, resolvedColumns]);

  const affectiveTraits = useMemo(() => {
    if (!reportCardData) {
      return [] as Array<{ key: string; label: string }>;
    }

    const layoutOrdered = layoutConfig.affectiveTraits
      .filter((trait) => trait.enabled !== false)
      .map((trait) => ({
        key: trait.id,
        label:
          trait.label.trim().length > 0
            ? trait.label
            : getAffectiveTraitLabel(trait.id) ||
              formatBehavioralLabel(trait.id),
      }));

    const fallbackOrdered: Array<{ key: string; label: string }> = [
      ...PRIMARY_AFFECTIVE_TRAITS,
      ...AFFECTIVE_TRAITS,
    ];

    const baseOrder =
      layoutOrdered.length > 0 ? layoutOrdered : fallbackOrdered;
    const seen = new Set<string>();
    const traits: Array<{ key: string; label: string }> = [];

    baseOrder.forEach((trait) => {
      const key = trait.key;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      const label =
        trait.label.trim().length > 0
          ? trait.label
          : formatBehavioralLabel(key);
      traits.push({ key, label });
    });

    Object.keys(reportCardData.affectiveDomain).forEach((key) => {
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      const fallbackLabel = getAffectiveTraitLabel(key);
      const label =
        fallbackLabel && fallbackLabel.trim().length > 0
          ? fallbackLabel
          : formatBehavioralLabel(key);
      traits.push({ key, label });
    });

    return traits;
  }, [layoutConfig.affectiveTraits, reportCardData]);

  const psychomotorSkills = useMemo(() => {
    if (!reportCardData) {
      return [] as Array<{ key: string; label: string }>;
    }

    const layoutOrdered = layoutConfig.psychomotorSkills
      .filter((trait) => trait.enabled !== false)
      .map((trait) => ({
        key: trait.id,
        label:
          trait.label.trim().length > 0
            ? trait.label
            : getPsychomotorSkillLabel(trait.id) ||
              formatBehavioralLabel(trait.id),
      }));

    const fallbackOrdered: Array<{ key: string; label: string }> = [
      ...PRIMARY_PSYCHOMOTOR_SKILLS,
      ...PSYCHOMOTOR_SKILLS,
    ];

    const baseOrder =
      layoutOrdered.length > 0 ? layoutOrdered : fallbackOrdered;
    const seen = new Set<string>();
    const traits: Array<{ key: string; label: string }> = [];

    baseOrder.forEach((trait) => {
      const key = trait.key;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      const label =
        trait.label.trim().length > 0
          ? trait.label
          : formatBehavioralLabel(key);
      traits.push({ key, label });
    });

    Object.keys(reportCardData.psychomotorDomain).forEach((key) => {
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      const fallbackLabel = getPsychomotorSkillLabel(key);
      const label =
        fallbackLabel && fallbackLabel.trim().length > 0
          ? fallbackLabel
          : formatBehavioralLabel(key);
      traits.push({ key, label });
    });

    return traits;
  }, [layoutConfig.psychomotorSkills, reportCardData]);

  const layoutSectionMap = useMemo(() => {
    const map = new Map<string, ReportCardLayoutConfig["sections"][number]>();
    layoutConfig.sections.forEach((section) => {
      map.set(section.id, section);
    });
    return map;
  }, [layoutConfig.sections]);

  const getSectionConfig = (sectionId: string) =>
    layoutSectionMap.get(sectionId);

  const isSectionEnabled = (sectionId: string, fallback = true) => {
    const section = getSectionConfig(sectionId);
    return section ? section.enabled !== false : fallback;
  };

  const getSectionTitleResolved = (sectionId: string, fallback: string) => {
    const section = getSectionConfig(sectionId);
    if (section) {
      const trimmed = section.title.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
    return fallback;
  };

  const getFieldConfig = (sectionId: string, fieldId: string) =>
    getSectionConfig(sectionId)?.fields.find((field) => field.id === fieldId);

  const isFieldEnabled = (
    sectionId: string,
    fieldId: string,
    fallback = true,
  ) => {
    const field = getFieldConfig(sectionId, fieldId);
    return field ? field.enabled !== false : fallback;
  };

  const getFieldLabelResolved = (
    sectionId: string,
    fieldId: string,
    fallback: string,
  ) => {
    const field = getFieldConfig(sectionId, fieldId);
    if (field) {
      const trimmed = field.label.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
    return fallback;
  };

  const formatScoreValue = (value: number | undefined) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "—";
    }

    const rounded = Math.round(value * 10) / 10;
    if (Number.isInteger(rounded)) {
      return `${rounded}`;
    }

    return rounded.toFixed(1);
  };

  const formatTotalValue = (value: number | undefined) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "—";
    }

    const rounded = Math.round(value * 10) / 10;
    const formatter = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
      maximumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    });

    return formatter.format(rounded);
  };

  const formatAverageValue = (value: number | undefined) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "—";
    }

    return `${(Math.round(value * 10) / 10).toFixed(1)}%`;
  };

  const totalsRow = useMemo(() => {
    if (!reportCardData || reportCardData.subjects.length === 0) {
      return null;
    }

    const columnTotals: Record<string, number> = {};

    reportCardData.subjects.forEach((subject) => {
      Object.entries(subject.columnScores).forEach(([columnId, value]) => {
        columnTotals[columnId] = (columnTotals[columnId] ?? 0) + value;
      });
    });

    const continuousAssessment = resolvedColumns
      .filter((column) => !column.isExam)
      .reduce((sum, column) => sum + (columnTotals[column.config.id] ?? 0), 0);
    const exam = resolvedColumns
      .filter((column) => column.isExam)
      .reduce((sum, column) => sum + (columnTotals[column.config.id] ?? 0), 0);

    return {
      columnTotals,
      continuousAssessment,
      exam,
      overall: continuousAssessment + exam,
    };
  }, [reportCardData, resolvedColumns]);

  const hasContinuousAssessmentColumns = useMemo(
    () => resolvedColumns.some((column) => !column.isExam),
    [resolvedColumns],
  );
  const hasExamColumns = useMemo(
    () => resolvedColumns.some((column) => column.isExam),
    [resolvedColumns],
  );
  const assessmentColumnsToDisplay = useMemo(
    () => resolvedColumns.filter((column) => !column.isExam),
    [resolvedColumns],
  );
  const examColumnsToDisplay = useMemo(
    () => resolvedColumns.filter((column) => column.isExam),
    [resolvedColumns],
  );
  const showExamSummaryColumn = !hasExamColumns;

  const preparePdfDocument = useCallback(async () => {
    const target = containerRef.current;
    if (!target || !reportCardData) {
      return null;
    }

    const { clone, cleanup, width, height } = createPrintableClone(target);
    if (width <= 0 || height <= 0) {
      cleanup();
      return null;
    }

    try {
      const { toPng } = await getHtmlToImage();
      const dataUrl = await toPng(clone, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        cacheBust: true,
        canvasWidth: width,
        canvasHeight: height,
        filter: (element) => {
          const candidate = element as HTMLElement;
          if (!candidate?.classList) {
            return true;
          }

          return (
            !candidate.classList.contains("print:hidden") &&
            !candidate.classList.contains("no-export")
          );
        },
      });

      const widthMm = Number.parseFloat(convertPxToMm(width).toFixed(2));
      const heightMm = Number.parseFloat(convertPxToMm(height).toFixed(2));
      if (
        !Number.isFinite(widthMm) ||
        !Number.isFinite(heightMm) ||
        widthMm <= 0 ||
        heightMm <= 0
      ) {
        return null;
      }

      const orientation = width >= height ? "landscape" : "portrait";
      const { jsPDF } = await getJsPdf();
      const pdf = new jsPDF({
        orientation,
        unit: "mm",
        format: [widthMm, heightMm],
      });

      pdf.addImage(dataUrl, "PNG", 0, 0, widthMm, heightMm, undefined, "FAST");

      return pdf;
    } finally {
      cleanup();
    }
  }, [reportCardData]);

  const handlePrint = useCallback(async () => {
    if (isPrinting) {
      return;
    }

    try {
      setIsPrinting(true);
      const pdf = await preparePdfDocument();
      if (!pdf) {
        return;
      }

      const pdfOutput = pdf.output("blob");
      if (!(pdfOutput instanceof Blob)) {
        throw new Error("Unable to generate PDF blob");
      }

      const browserWindow = resolveBrowserWindow();
      if (!browserWindow) {
        throw new Error("Browser window context is not available");
      }

      const blobUrl = browserWindow.URL.createObjectURL(pdfOutput);
      const openedWindow = browserWindow.open(
        blobUrl,
        "_blank",
        "noopener,noreferrer",
      );

      if (!openedWindow) {
        browserWindow.location.href = blobUrl;
      } else {
        openedWindow.focus();
      }

      browserWindow.setTimeout(() => {
        browserWindow.URL.revokeObjectURL(blobUrl);
      }, 60000);
    } catch (error) {
      logger.error("Failed to prepare report card PDF", { error });
      toast({
        title: "Print failed",
        description: "Unable to prepare the report card PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPrinting(false);
    }
  }, [isPrinting, preparePdfDocument, toast]);

  const handleDownload = useCallback(async () => {
    if (isDownloading) {
      return;
    }

    try {
      setIsDownloading(true);
      const pdf = await preparePdfDocument();
      if (!pdf || !reportCardData) {
        return;
      }

      const filename = sanitizeFileName(
        `${reportCardData.student.name}-${reportCardData.student.term}-${reportCardData.student.session}`,
      );

      pdf.save(`${filename}.pdf`);
    } catch (error) {
      logger.error("Failed to export report card as PDF", { error });
      toast({
        title: "Download failed",
        description: "Unable to prepare the report card PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  }, [isDownloading, preparePdfDocument, reportCardData, toast]);

  const parsePositiveInteger = useCallback((value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return Math.floor(value);
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }

      const parsed = Number.parseInt(trimmed, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }

    return null;
  }, []);

  const extractAdmissionNumber = useCallback(
    (value: unknown): string | null => {
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }

      return null;
    },
    [],
  );

  const initialClassSize = useMemo(() => {
    if (!reportCardData) {
      return null;
    }

    const { student, summary, termInfo } = reportCardData;

    return (
      parsePositiveInteger(student.numberInClass) ??
      parsePositiveInteger(termInfo?.numberInClass) ??
      parsePositiveInteger(summary?.numberOfStudents) ??
      null
    );
  }, [parsePositiveInteger, reportCardData]);

  const initialAdmissionNumber = useMemo(() => {
    if (!reportCardData) {
      return null;
    }

    const { student } = reportCardData;
    const studentRecord = student as Record<string, unknown>;

    const candidate =
      extractAdmissionNumber(student.admissionNumber) ??
      extractAdmissionNumber(studentRecord["admission_number"]) ??
      extractAdmissionNumber(studentRecord["admissionNo"]) ??
      extractAdmissionNumber(studentRecord["admission_no"]);

    return candidate;
  }, [extractAdmissionNumber, reportCardData]);

  const normalizedStudentClass = useMemo(() => {
    const classValue = reportCardData?.student?.class;
    return typeof classValue === "string" ? classValue.trim() : "";
  }, [reportCardData?.student?.class]);

  const normalizedStudentId = useMemo(() => {
    const idValue = reportCardData?.student?.id;
    return typeof idValue === "string" ? idValue.trim() : "";
  }, [reportCardData?.student?.id]);

  const normalizedStudentName = useMemo(() => {
    const nameValue = reportCardData?.student?.name;
    return typeof nameValue === "string" ? nameValue.trim() : "";
  }, [reportCardData?.student?.name]);

  const [resolvedClassSize, setResolvedClassSize] = useState<number | null>(
    initialClassSize,
  );
  const [resolvedAdmissionNumber, setResolvedAdmissionNumber] = useState<
    string | null
  >(initialAdmissionNumber);

  useEffect(() => {
    setResolvedClassSize(initialClassSize);
  }, [initialClassSize]);

  useEffect(() => {
    setResolvedAdmissionNumber(initialAdmissionNumber);
  }, [initialAdmissionNumber]);

  useEffect(() => {
    if (!normalizedStudentClass) {
      return;
    }

    let isSubscribed = true;

    const fetchRosterDetails = async () => {
      try {
        const roster = await dbManager.getStudentsByClass(
          normalizedStudentClass,
        );
        if (!isSubscribed || !Array.isArray(roster)) {
          return;
        }

        const rosterEntries = roster as Array<Record<string, unknown>>;
        const rosterSize = rosterEntries.length;
        if (rosterSize > 0 && rosterSize !== resolvedClassSize) {
          setResolvedClassSize(rosterSize);
        }

        if (resolvedAdmissionNumber) {
          return;
        }

        const readString = (source: Record<string, unknown>, key: string) => {
          const value = source[key];
          return typeof value === "string" ? value.trim() : "";
        };

        const rosterNameMatch = (candidate: Record<string, unknown>) => {
          const rosterName = readString(candidate, "name").toLowerCase();
          const studentName = normalizedStudentName.toLowerCase();
          return rosterName && studentName ? rosterName === studentName : false;
        };

        const matchingEntry = rosterEntries.find((entry) => {
          const entryId = readString(entry, "id");
          if (normalizedStudentId && entryId) {
            return entryId === normalizedStudentId;
          }

          return rosterNameMatch(entry);
        });

        if (!matchingEntry) {
          return;
        }

        const admissionCandidate =
          extractAdmissionNumber(
            readString(matchingEntry, "admissionNumber"),
          ) ??
          extractAdmissionNumber(
            readString(matchingEntry, "admission_number"),
          ) ??
          extractAdmissionNumber(readString(matchingEntry, "admissionNo")) ??
          extractAdmissionNumber(readString(matchingEntry, "admission_no")) ??
          (() => {
            const metadata =
              (matchingEntry.metadata as Record<string, unknown> | undefined) ??
              undefined;
            return metadata
              ? extractAdmissionNumber(readString(metadata, "admissionNumber"))
              : null;
          })();

        if (admissionCandidate && isSubscribed) {
          setResolvedAdmissionNumber(admissionCandidate);
        }
      } catch (error) {
        logger.warn("Unable to resolve class roster details for report card", {
          error,
        });
      }
    };

    void fetchRosterDetails();

    return () => {
      isSubscribed = false;
    };
  }, [
    extractAdmissionNumber,
    resolvedAdmissionNumber,
    resolvedClassSize,
    normalizedStudentClass,
    normalizedStudentId,
    normalizedStudentName,
  ]);

  if (!reportCardData) {
    return (
      <div className="mx-auto w-full max-w-5xl py-6">
        <div className="rounded-lg border border-dashed border-[#2d5016] bg-white p-8 text-center text-[#2d5016] shadow-sm">
          <h2 className="text-lg font-semibold">
            No report card data available
          </h2>
          <p className="mt-2 text-sm">
            Please select a student with recorded assessments to preview the
            enhanced report card.
          </p>
        </div>
      </div>
    );
  }

  const { student, summary, termInfo } = reportCardData;
  const resolveDisplayValue = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }

    return "—";
  };

  const numberInClass = resolveDisplayValue(
    resolvedClassSize ??
      student.numberInClass ??
      termInfo?.numberInClass ??
      summary?.numberOfStudents ??
      "—",
  );
  const termLabel = resolveDisplayValue(student.term);
  const sessionLabel = resolveDisplayValue(student.session);
  const admissionNumber = resolveDisplayValue(
    resolvedAdmissionNumber ?? student.admissionNumber ?? student.id ?? "—",
  );
  const studentName = resolveDisplayValue(student.name);
  const classLabel = resolveDisplayValue(student.class);
  const gradeLabel = resolveDisplayValue(
    summary.grade ? summary.grade.toUpperCase() : undefined,
  );
  const totalMarksObtainable = formatTotalValue(summary.totalMarksObtainable);
  const totalMarksObtained = formatTotalValue(summary.totalMarksObtained);
  const averageScore = formatAverageValue(summary.averageScore);
  const positionLabel = resolveDisplayValue(summary.positionLabel);

  const fallbackClassRemark =
    layoutConfig.defaultRemarks.classTeacher?.trim() ?? "";
  const fallbackHeadRemark =
    layoutConfig.defaultRemarks.headTeacher?.trim() ?? "";
  const brandingHeadRemark =
    reportCardData.branding?.defaultRemark?.trim() ?? "";

  const classTeacherRemark = reportCardData.remarks.classTeacher?.trim().length
    ? reportCardData.remarks.classTeacher
    : fallbackClassRemark.length > 0
      ? fallbackClassRemark
      : "________________";

  const headTeacherRemark = reportCardData.remarks.headTeacher?.trim().length
    ? reportCardData.remarks.headTeacher
    : fallbackHeadRemark.length > 0
      ? fallbackHeadRemark
      : brandingHeadRemark.length > 0
        ? brandingHeadRemark
        : "________________";
  const vacationDate =
    formatDateDisplay(reportCardData.termInfo.vacationEnds) ??
    "________________";
  const resumptionDate =
    formatDateDisplay(reportCardData.termInfo.nextTermBegins) ??
    "________________";
  const studentFieldValues: Record<string, string> = {
    student_name: studentName,
    admission_number: admissionNumber,
    class_name: classLabel,
    number_in_class: numberInClass,
    term: termLabel,
    session: sessionLabel,
    grade: gradeLabel,
    total_obtainable: totalMarksObtainable,
    total_obtained: totalMarksObtained,
    average: averageScore,
    position: positionLabel,
  };

  const attendanceValues: Record<string, string> = {
    attendance_present: resolveDisplayValue(reportCardData.attendance.present),
    attendance_absent: resolveDisplayValue(reportCardData.attendance.absent),
    attendance_total: resolveDisplayValue(reportCardData.attendance.total),
    attendance_percentage: formatAverageValue(
      reportCardData.attendance.percentage,
    ),
  };

  const termDateValues: Record<string, string> = {
    vacation_date: vacationDate,
    resumption_date: resumptionDate,
  };

  const feeValues: Record<string, string> = {
    next_term_fees: resolveDisplayValue(reportCardData.termInfo.nextTermFees),
    fees_balance: resolveDisplayValue(reportCardData.termInfo.feesBalance),
  };

  const teacherSignatureEnabled = isFieldEnabled(
    "signatures",
    "teacher_signature_label",
    true,
  );
  const headSignatureEnabled = isFieldEnabled(
    "signatures",
    "head_signature_label",
    true,
  );
  const teacherSignatureLabel = getFieldLabelResolved(
    "signatures",
    "teacher_signature_label",
    getDefaultFieldLabel("signatures", "teacher_signature_label"),
  );
  const headSignatureLabel = getFieldLabelResolved(
    "signatures",
    "head_signature_label",
    getDefaultFieldLabel("signatures", "head_signature_label"),
  );
  const teacherSignatureUrl = readNonEmptyString(
    reportCardData.teacher?.signatureUrl,
  );
  const teacherSignatureName = readNonEmptyString(reportCardData.teacher?.name);
  const renderTeacherSignature = () => {
    if (!teacherSignatureEnabled) {
      return null;
    }

    return (
      <div className="signature-item">
        <span className="signature-label">{teacherSignatureLabel}</span>
        {teacherSignatureUrl ? (
          <div className="signature-image">
            <img src={teacherSignatureUrl} alt="Teacher's signature" />
          </div>
        ) : (
          <div className="signature-line" />
        )}
        {teacherSignatureName ? (
          <span className="signature-name">{teacherSignatureName}</span>
        ) : null}
      </div>
    );
  };
  const renderHeadSignature = () => {
    if (!headSignatureEnabled) {
      return null;
    }

    return (
      <div className="signature-item headmaster-signature">
        <span className="signature-label">{headSignatureLabel}</span>
        {reportCardData.branding.signature ? (
          <div className="signature-image">
            <img
              src={reportCardData.branding.signature}
              alt="Headmaster's signature"
            />
          </div>
        ) : (
          <div className="signature-placeholder">Signature Pending</div>
        )}
        {showHeadSignatureName ? (
          <span className="signature-name">{headSignatureName}</span>
        ) : null}
      </div>
    );
  };
  const headNameField = getFieldConfig("signatures", "head_name_label");
  const headSignatureName =
    headNameField && headNameField.label.trim().length > 0
      ? headNameField.label.trim()
      : (reportCardData.branding.headmasterName?.trim() ?? "");
  const showHeadSignatureName =
    (headNameField ? headNameField.enabled !== false : true) &&
    headSignatureName.trim().length > 0;

  const affectiveSignatureBlock =
    teacherSignatureEnabled || headSignatureEnabled ? (
      <div className="affective-signatures">
        {renderTeacherSignature()}
        {renderHeadSignature()}
      </div>
    ) : null;

  const gradingTitle = getSectionTitleResolved(
    "grading_key",
    getDefaultSectionTitle("grading_key"),
  );
  const gradingLegend = getFieldLabelResolved(
    "grading_key",
    "grading_legend",
    getDefaultFieldLabel("grading_key", "grading_legend"),
  );

  const studentFields = (
    getSectionConfig("student_overview")?.fields ?? []
  ).filter((field) => field.enabled !== false);
  const attendanceFields = (
    getSectionConfig("attendance")?.fields ?? []
  ).filter((field) => field.enabled !== false);
  const remarkFields = (getSectionConfig("remarks")?.fields ?? []).filter(
    (field) => field.enabled !== false,
  );
  const classTeacherFieldEnabled = remarkFields.some(
    (field) => field.id === "class_teacher_remark" && field.enabled !== false,
  );
  const headTeacherFieldEnabled = remarkFields.some(
    (field) => field.id === "head_teacher_remark" && field.enabled !== false,
  );
  const termDateFields = (getSectionConfig("term_dates")?.fields ?? []).filter(
    (field) => field.enabled !== false,
  );
  const feeFields = (getSectionConfig("fees")?.fields ?? []).filter(
    (field) => field.enabled !== false,
  );

  const hasAttendanceData =
    (typeof reportCardData.attendance.present === "number" &&
      reportCardData.attendance.present > 0) ||
    (typeof reportCardData.attendance.absent === "number" &&
      reportCardData.attendance.absent > 0) ||
    (typeof reportCardData.attendance.total === "number" &&
      reportCardData.attendance.total > 0) ||
    (typeof reportCardData.attendance.percentage === "number" &&
      reportCardData.attendance.percentage > 0);

  const hasFeeData = [termInfo?.nextTermFees, termInfo?.feesBalance].some(
    (value) => {
      if (typeof value === "number") {
        return Number.isFinite(value);
      }

      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length === 0) {
          return false;
        }

        if (/^[-—]+$/.test(trimmed)) {
          return false;
        }

        return true;
      }

      return false;
    },
  );

  const shouldShowAttendanceSection =
    isSectionEnabled("attendance") &&
    attendanceFields.length > 0 &&
    hasAttendanceData;
  const shouldShowFeeSection =
    isSectionEnabled("fees") && feeFields.length > 0 && hasFeeData;

  const showRemarksBlock =
    isSectionEnabled("remarks") &&
    (classTeacherFieldEnabled || headTeacherFieldEnabled);
  const showPsychomotorBlock =
    isSectionEnabled("behavioral_psychomotor") && psychomotorSkills.length > 0;
  const showAffectiveBlock =
    isSectionEnabled("behavioral_affective") && affectiveTraits.length > 0;
  const shouldRenderAffectiveContainer =
    showAffectiveBlock || teacherSignatureEnabled || headSignatureEnabled;
  const attendanceTitle = getSectionTitleResolved(
    "attendance",
    getDefaultSectionTitle("attendance"),
  );
  const psychomotorTitle = getSectionTitleResolved(
    "behavioral_psychomotor",
    getDefaultSectionTitle("behavioral_psychomotor"),
  );
  const affectiveTitle = getSectionTitleResolved(
    "behavioral_affective",
    getDefaultSectionTitle("behavioral_affective"),
  );
  const feesTitle = getSectionTitleResolved(
    "fees",
    getDefaultSectionTitle("fees"),
  );
  const classTeacherLabel = getFieldLabelResolved(
    "remarks",
    "class_teacher_remark",
    getDefaultFieldLabel("remarks", "class_teacher_remark"),
  );
  const headTeacherLabel = getFieldLabelResolved(
    "remarks",
    "head_teacher_remark",
    getDefaultFieldLabel("remarks", "head_teacher_remark"),
  );
  const gradingLegendDisplay = gradingLegend.trim();
  const gradingTitleDisplay = gradingTitle.trim();

  return (
    <div className="victory-report-card-wrapper">
      <div className="victory-report-card-actions no-export">
        <Button
          onClick={handlePrint}
          className="bg-[#2e7d32] px-4 py-2 text-sm font-medium text-white shadow-md hover:bg-[#256028]"
          disabled={isPrinting}
        >
          <Print className="mr-2 h-4 w-4" />
          {isPrinting ? "Preparing..." : "Print"}
        </Button>
        <Button
          onClick={handleDownload}
          variant="outline"
          className="border-[#2e7d32] px-4 py-2 text-sm font-medium text-[#2e7d32] hover:bg-[#2e7d32] hover:text-white"
          disabled={isDownloading}
        >
          <Download className="mr-2 h-4 w-4" />
          {isDownloading ? "Preparing..." : "Download"}
        </Button>
      </div>

      <div className="victory-report-card">
        <div className="report-container" ref={containerRef}>
          <div className="header-wrapper">
            <div className="logo">
              {reportCardData.branding.logo ? (
                <img src={reportCardData.branding.logo} alt="School logo" />
              ) : (
                <span>SCHOOL LOGO</span>
              )}
            </div>
            <div className="school-info">
              <p className="school-name">
                {reportCardData.branding.schoolName}
              </p>
              {reportCardData.branding.address ? (
                <p className="school-address">
                  {reportCardData.branding.address}
                </p>
              ) : null}
              {(reportCardData.branding.educationZone ||
                reportCardData.branding.councilArea) && (
                <p className="school-address">
                  {[
                    reportCardData.branding.educationZone,
                    reportCardData.branding.councilArea,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
              {(reportCardData.branding.contactPhone ||
                reportCardData.branding.contactEmail) && (
                <p className="school-address">
                  {[
                    reportCardData.branding.contactPhone,
                    reportCardData.branding.contactEmail,
                  ]
                    .filter(Boolean)
                    .join(" • ")}
                </p>
              )}
            </div>
            <div className="photo-placeholder">
              {studentPhoto ? (
                <img
                  src={studentPhoto}
                  alt={`${reportCardData.student.name} passport`}
                />
              ) : (
                <span>PHOTO</span>
              )}
            </div>
          </div>

          <div className="report-title">TERMINAL REPORT SHEET</div>

          {isSectionEnabled("student_overview") && studentFields.length > 0 && (
            <div className="student-info">
              <div className="student-grid">
                {studentFields.map((field) => (
                  <div key={field.id} className="student-field">
                    <div className="info-label">
                      {getFieldLabelResolved(
                        "student_overview",
                        field.id,
                        getDefaultFieldLabel("student_overview", field.id),
                      )}
                    </div>
                    <div className="info-value">
                      {studentFieldValues[field.id] ?? "—"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {shouldShowAttendanceSection && (
            <div className="attendance-box">
              <h4 className="attendance-title">{attendanceTitle}</h4>
              <div className="attendance-grid">
                {attendanceFields.map((field) => (
                  <div key={field.id} className="attendance-item">
                    <span className="attendance-label">
                      {getFieldLabelResolved(
                        "attendance",
                        field.id,
                        getDefaultFieldLabel("attendance", field.id),
                      )}
                    </span>
                    <span className="attendance-value">
                      {attendanceValues[field.id] ?? "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <table className="grades-table">
            <thead>
              <tr>
                <th>Subject</th>
                {assessmentColumnsToDisplay.map((column) => {
                  const columnMax = getColumnMaximum(column.config);
                  return (
                    <th key={column.config.id}>
                      <span>{column.config.name}</span>
                      {columnMax > 0 ? (
                        <>
                          <br />
                          <span>({formatTotalValue(columnMax)})</span>
                        </>
                      ) : null}
                    </th>
                  );
                })}
                {hasContinuousAssessmentColumns ? (
                  <th>
                    Total
                    <br />(
                    {formatTotalValue(
                      reportCardData.assessmentMaximums.continuousAssessment,
                    )}
                    )
                  </th>
                ) : null}
                {examColumnsToDisplay.map((column) => {
                  const columnMax = getColumnMaximum(column.config);
                  return (
                    <th key={column.config.id}>
                      <span>{column.config.name}</span>
                      {columnMax > 0 ? (
                        <>
                          <br />
                          <span>({formatTotalValue(columnMax)})</span>
                        </>
                      ) : null}
                    </th>
                  );
                })}
                {showExamSummaryColumn ? (
                  <th>
                    Exam
                    <br />(
                    {formatTotalValue(reportCardData.assessmentMaximums.exam)})
                  </th>
                ) : null}
                <th>
                  Total
                  <br />(
                  {formatTotalValue(reportCardData.assessmentMaximums.total)})
                </th>
                <th>
                  Subject
                  <br />
                  Position
                </th>
                <th>
                  Teacher&apos;s
                  <br />
                  Remarks
                </th>
              </tr>
            </thead>
            <tbody>
              {reportCardData.subjects.length > 0 ? (
                <>
                  {reportCardData.subjects.map((subject, index) => (
                    <tr key={`${subject.name}-${index}`}>
                      <td className="subject-name">{subject.name}</td>
                      {assessmentColumnsToDisplay.map((column) => (
                        <td key={column.config.id}>
                          {formatScoreValue(
                            subject.columnScores[column.config.id],
                          )}
                        </td>
                      ))}
                      {hasContinuousAssessmentColumns ? (
                        <td>{formatScoreValue(subject.caTotal)}</td>
                      ) : null}
                      {examColumnsToDisplay.map((column) => (
                        <td key={column.config.id}>
                          {formatScoreValue(
                            subject.columnScores[column.config.id],
                          )}
                        </td>
                      ))}
                      {showExamSummaryColumn ? (
                        <td>{formatScoreValue(subject.exam)}</td>
                      ) : null}
                      <td>{formatScoreValue(subject.total)}</td>
                      <td>{subject.position ?? ""}</td>
                      <td>{renderSubjectRemark(subject)}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td className="total-label">TOTAL</td>
                    {assessmentColumnsToDisplay.map((column) => (
                      <td key={column.config.id}>
                        {formatTotalValue(
                          totalsRow?.columnTotals[column.config.id] ?? 0,
                        )}
                      </td>
                    ))}
                    {hasContinuousAssessmentColumns ? (
                      <td>
                        {formatTotalValue(totalsRow?.continuousAssessment ?? 0)}
                      </td>
                    ) : null}
                    {examColumnsToDisplay.map((column) => (
                      <td key={column.config.id}>
                        {formatTotalValue(
                          totalsRow?.columnTotals[column.config.id] ?? 0,
                        )}
                      </td>
                    ))}
                    {showExamSummaryColumn ? (
                      <td>{formatTotalValue(totalsRow?.exam ?? 0)}</td>
                    ) : null}
                    <td>{formatTotalValue(totalsRow?.overall ?? 0)}</td>
                    <td></td>
                    <td></td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td
                    colSpan={
                      assessmentColumnsToDisplay.length +
                      examColumnsToDisplay.length +
                      (hasContinuousAssessmentColumns ? 1 : 0) +
                      (showExamSummaryColumn ? 1 : 0) +
                      4
                    }
                  >
                    No subject scores have been recorded for this student.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {(showRemarksBlock || showPsychomotorBlock || showAffectiveBlock) && (
            <div className="remark-section">
              {(showRemarksBlock || showPsychomotorBlock) && (
                <div className="remarks-column">
                  {showRemarksBlock && (
                    <div className="teacher-remarks">
                      {classTeacherFieldEnabled && (
                        <>
                          <strong>{classTeacherLabel}</strong>
                          <br />
                          {classTeacherRemark}
                        </>
                      )}
                      {classTeacherFieldEnabled && headTeacherFieldEnabled && (
                        <hr />
                      )}
                      {headTeacherFieldEnabled && (
                        <>
                          <strong>{headTeacherLabel}</strong>
                          <br />
                          <em>{headTeacherRemark}</em>
                        </>
                      )}
                    </div>
                  )}

                  {showPsychomotorBlock && (
                    <div className="domain-block psychomotor-block">
                      <strong>{psychomotorTitle}</strong>
                      <table className="af-domain-table checkmark-table">
                        <thead>
                          <tr>
                            <th>Skill</th>
                            <th className="check-column">Demonstrated</th>
                          </tr>
                        </thead>
                        <tbody>
                          {psychomotorSkills.length > 0 ? (
                            psychomotorSkills.map((skill) => (
                              <tr key={skill.key}>
                                <td>{skill.label}</td>
                                <td
                                  className={
                                    reportCardData.psychomotorDomain[skill.key]
                                      ? "tick"
                                      : ""
                                  }
                                >
                                  {reportCardData.psychomotorDomain[skill.key]
                                    ? "✓"
                                    : ""}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={2}>
                                No psychomotor records available.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {shouldRenderAffectiveContainer && (
                <div className="domain-block affective-block">
                  <strong>{affectiveTitle}</strong>
                  <div className="affective-domain-card">
                    {showAffectiveBlock ? (
                      <table className="af-domain-table checkmark-table">
                        <thead>
                          <tr>
                            <th>Trait</th>
                            <th className="check-column">Demonstrated</th>
                          </tr>
                        </thead>
                        <tbody>
                          {affectiveTraits.length > 0 ? (
                            affectiveTraits.map((trait) => (
                              <tr key={trait.key}>
                                <td>{trait.label}</td>
                                <td
                                  className={
                                    reportCardData.affectiveDomain[trait.key]
                                      ? "tick"
                                      : ""
                                  }
                                >
                                  {reportCardData.affectiveDomain[trait.key]
                                    ? "✓"
                                    : ""}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={2}>
                                No affective records available.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    ) : (
                      <div className="affective-placeholder">
                        Affective domain records are not enabled for this
                        layout.
                      </div>
                    )}
                    {affectiveSignatureBlock}
                  </div>
                </div>
              )}
            </div>
          )}

          {isSectionEnabled("term_dates") && termDateFields.length > 0 && (
            <div className="vacation-box">
              {termDateFields.map((field) => (
                <div key={field.id}>
                  <strong>
                    {getFieldLabelResolved(
                      "term_dates",
                      field.id,
                      getDefaultFieldLabel("term_dates", field.id),
                    )}
                    :
                  </strong>{" "}
                  {termDateValues[field.id] ?? "________________"}
                </div>
              ))}
            </div>
          )}

          {shouldShowFeeSection && (
            <div className="fees-box">
              <h4 className="fees-title">{feesTitle}</h4>
              <div className="fees-grid">
                {feeFields.map((field) => (
                  <div key={field.id} className="fees-item">
                    <span className="fees-label">
                      {getFieldLabelResolved(
                        "fees",
                        field.id,
                        getDefaultFieldLabel("fees", field.id),
                      )}
                    </span>
                    <span className="fees-value">
                      {feeValues[field.id] ?? "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isSectionEnabled("grading_key") &&
            gradingLegendDisplay.length > 0 && (
              <div className="grading-key-container">
                <div className="grading-key">
                  {gradingTitleDisplay.length > 0
                    ? gradingTitleDisplay.toUpperCase()
                    : "GRADING"}
                  : {gradingLegendDisplay}
                </div>
              </div>
            )}
        </div>
      </div>

      <style jsx global>{`
        .victory-report-card-wrapper {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 24px 16px;
          background-color: transparent;
        }

        .victory-report-card-actions {
          width: 100%;
          max-width: 980px;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-bottom: 16px;
        }

        .victory-report-card {
          width: 100%;
          display: flex;
          justify-content: center;
        }

        .victory-report-card .report-container {
          width: min(960px, 100%);
          max-width: 210mm;
          margin: 0 auto;
          border: 3px solid #2e7d32;
          background-color: #fff;
          color: #333;
          font-family: "Times New Roman", serif;
          padding: 0;
          box-sizing: border-box;
          overflow-x: hidden;
        }

        .victory-report-card .report-container * {
          box-sizing: border-box;
        }

        .header-wrapper {
          display: flex;
          align-items: center;
          border-bottom: 3px solid #2e7d32;
          padding: 10px 15px;
          background-color: #fff;
        }

        .logo {
          width: 120px;
          height: 120px;
          border: 2px solid #2e7d32;
          background-color: #f9f9f9;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          color: #999;
          margin-right: 15px;
        }

        .logo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .school-info {
          flex-grow: 1;
          background-color: #e0e0e0;
          border: 2px solid #2e7d32;
          border-radius: 6px;
          padding: 8px 12px;
          text-align: center;
        }

        .school-name {
          font-size: 32px;
          font-weight: bold;
          color: #2e7d32;
          margin: 0 0 4px 0;
          line-height: 1.1;
        }

        .school-address {
          font-size: 14px;
          color: #333;
          margin: 0;
          line-height: 1.3;
        }

        .school-info .school-address + .school-address {
          margin-top: 4px;
        }

        .photo-placeholder {
          width: 100px;
          height: 120px;
          border: 2px solid #2e7d32;
          background-color: #f5f5f5;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-left: 15px;
          font-size: 10px;
          color: #999;
        }

        .photo-placeholder img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          padding: 6px;
        }

        .report-title {
          text-align: center;
          font-size: 18px;
          font-weight: bold;
          color: #2e7d32;
          padding: 8px 0;
          margin: 0;
          border-top: 1px solid #2e7d32;
          border-bottom: 1px solid #2e7d32;
        }

        .student-info {
          border: 2px solid #2e7d32;
          margin: 10px 15px;
          font-size: 14px;
        }

        .student-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          border-top: 1px solid #2e7d32;
          border-left: 1px solid #2e7d32;
        }

        .student-field {
          display: grid;
          grid-template-columns: minmax(130px, max-content) 1fr;
          align-items: stretch;
          border-right: 1px solid #2e7d32;
          border-bottom: 1px solid #2e7d32;
          background-color: #fff;
        }

        .info-label {
          font-weight: bold;
          color: #2e7d32;
          padding: 6px 8px;
          border-right: 1px solid #2e7d32;
          font-size: 13px;
          background-color: #fafafa;
          letter-spacing: 0.04em;
          display: flex;
          align-items: center;
        }

        .info-value {
          padding: 6px 8px;
          font-size: 15px;
          font-weight: bold;
          background-color: #fff;
          display: flex;
          align-items: center;
        }

        .attendance-box {
          margin: 10px 15px;
          padding: 12px;
          border: 2px dashed #2e7d32;
          background-color: #f5fbf5;
        }

        .attendance-title {
          font-size: 13px;
          font-weight: 600;
          color: #2e7d32;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .attendance-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 10px;
        }

        .attendance-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .attendance-label {
          font-size: 11px;
          text-transform: uppercase;
          color: #1f4a1f;
          letter-spacing: 0.05em;
        }

        .attendance-value {
          font-size: 16px;
          font-weight: 600;
          color: #2e7d32;
        }

        .fees-box {
          margin: 10px 15px;
          padding: 12px 14px;
          border: 2px solid #b29032;
          background-color: #fffaf0;
        }

        .fees-title {
          font-size: 13px;
          font-weight: 600;
          color: #9a7c2a;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .fees-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 10px;
        }

        .fees-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .fees-label {
          font-size: 11px;
          text-transform: uppercase;
          color: #6b5800;
          letter-spacing: 0.05em;
        }

        .fees-value {
          font-size: 16px;
          font-weight: 600;
          color: #2e7d32;
        }

        .grades-table {
          width: calc(100% - 30px);
          margin: 10px 15px 30px;
          border-collapse: collapse;
          font-size: 14px;
          table-layout: fixed;
        }

        .grades-table th,
        .grades-table td {
          border: 1px solid #2e7d32;
          padding: 6px 4px;
          text-align: center;
          vertical-align: middle;
          font-size: 13px;
          line-height: 1.3;
          word-break: break-word;
          overflow-wrap: anywhere;
        }

        .grades-table th {
          background-color: #2e7d32;
          color: #fff;
          font-weight: bold;
        }

        .grades-table td {
          background-color: #fff;
        }

        .remark-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          border-radius: 9999px;
          border: 1px solid transparent;
          padding: 2px 10px;
          font-size: 0.85rem;
          line-height: 1.2;
          min-width: 72px;
        }

        .remark-pill.remark-excellent {
          color: #166534;
          border-color: rgba(22, 163, 74, 0.35);
          background-color: rgba(22, 163, 74, 0.12);
        }

        .remark-pill.remark-vgood {
          color: #0f766e;
          border-color: rgba(13, 148, 136, 0.35);
          background-color: rgba(13, 148, 136, 0.12);
        }

        .remark-pill.remark-good {
          color: #1d4ed8;
          border-color: rgba(37, 99, 235, 0.35);
          background-color: rgba(37, 99, 235, 0.12);
        }

        .remark-pill.remark-poor {
          color: #b91c1c;
          border-color: rgba(220, 38, 38, 0.35);
          background-color: rgba(220, 38, 38, 0.12);
        }

        .subject-name {
          text-align: left !important;
          padding-left: 8px;
          font-weight: bold;
          color: #2e7d32;
        }

        .total-row {
          font-weight: bold;
          background-color: #f9f9f9;
        }

        .total-label {
          text-align: left !important;
          padding-left: 8px;
        }

        .remark-section {
          margin-top: 12px;
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          align-items: stretch;
          padding: 0 15px 8px;
        }

        .remarks-column {
          display: flex;
          flex: 1 1 260px;
          flex-direction: column;
          gap: 12px;
        }

        .teacher-remarks,
        .domain-block {
          border: 1.5px solid #27613d;
          background: #fafdff;
          border-radius: 4px;
          padding: 12px 16px;
          font-size: 1em;
          flex: 1 1 auto;
        }

        .psychomotor-block {
          padding-bottom: 16px;
        }

        .affective-block {
          flex: 1 1 320px;
          min-width: 280px;
        }

        .affective-domain-card {
          margin-top: 12px;
          padding: 14px 16px;
          border: 1px solid #d9eadd;
          border-radius: 10px;
          background: #f6fdf8;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .affective-signatures {
          padding-top: 12px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          flex-wrap: wrap;
          border-top: 1px dashed #27613d;
        }

        .affective-signatures .signature-item {
          flex: 1 1 220px;
        }

        .affective-placeholder {
          margin-top: 0;
          font-size: 0.95em;
          color: #134e1f;
          background: #f0fdf4;
          border: 1px dashed #27613d;
          border-radius: 4px;
          padding: 12px;
        }

        .vacation-box {
          display: flex;
          gap: 24px;
          margin-top: 6px;
          font-size: 1em;
          align-items: center;
          padding: 0 15px 8px;
        }

        .signature-item {
          display: flex;
          flex-direction: column;
          gap: 12px;
          font-weight: 600;
          color: #27613d;
          align-items: flex-start;
          text-align: left;
          flex: 1 1 0;
          min-width: 220px;
        }

        .signature-item.headmaster-signature {
          margin-left: 0;
          align-items: flex-start;
          text-align: left;
        }

        @media (max-width: 600px) {
          .affective-domain-card {
            padding: 12px;
          }

          .affective-signatures {
            flex-direction: column;
            align-items: stretch;
            justify-content: flex-start;
            gap: 16px;
          }

          .signature-item {
            min-width: 0;
          }

          .signature-item.headmaster-signature {
            align-items: flex-start;
            text-align: left;
          }
        }

        .signature-label {
          font-size: 1em;
        }

        .signature-line {
          border-bottom: 1px dotted #27613d;
          width: 140px;
          height: 2px;
          margin-top: 12px;
          display: inline-block;
        }

        .signature-image {
          width: 140px;
          height: 70px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .signature-image img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }

        .signature-placeholder {
          width: 140px;
          height: 70px;
          border: 1px dashed #9ca3af;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6b7280;
          font-size: 0.75rem;
          font-style: italic;
        }

        .signature-name {
          font-size: 0.85em;
          font-weight: 600;
          color: #1b4332;
          letter-spacing: 0.02em;
        }

        .af-domain-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 6px;
        }

        .af-domain-table th,
        .af-domain-table td {
          padding: 4px;
          text-align: center;
          font-size: 0.95em;
          border: 1px solid #b2c7b9;
        }

        .af-domain-table th {
          background: #fbd54a;
          color: #27613d;
        }

        .af-domain-table td {
          background: #fafdff;
        }

        .af-domain-table td:first-child {
          text-align: left;
          font-weight: 600;
          color: #27613d;
        }

        .af-domain-table .tick {
          color: #05762b;
          font-size: 1.2em;
          font-weight: bold;
        }

        .checkmark-table .check-column {
          width: 120px;
        }

        .checkmark-table td:nth-child(2) {
          text-align: center;
        }

        .checkmark-table .tick {
          display: inline-block;
          min-width: 1.5em;
        }

        hr {
          border: 0;
          border-top: 1px solid #27613d;
          margin: 8px 0;
        }

        .grading-key-container {
          padding: 0 15px 12px;
          text-align: center;
          font-size: 13px;
          color: #27613d;
          font-weight: bold;
        }

        .grading-key {
          display: inline-block;
          background: #f9f9f9;
          border: 1px solid #27613d;
          padding: 6px 12px;
          border-radius: 4px;
          margin-top: 5px;
        }

        @media print {
          @page {
            size: auto;
            margin: 10mm;
          }

          body {
            margin: 0;
            background: #fff !important;
            color: #000;
            font-size: 10pt;
            line-height: 1.2;
          }

          .victory-report-card-wrapper {
            padding: 0;
          }

          .victory-report-card-actions {
            display: none !important;
          }

          .victory-report-card {
            width: 100%;
            justify-content: center;
            position: static;
          }

          .victory-report-card .report-container {
            width: auto !important;
            max-width: none;
            margin: 0 auto !important;
            padding: 0 !important;
            border-width: 3px;
            box-sizing: border-box;
            overflow: visible;
          }

          .victory-report-card .report-container,
          .victory-report-card .report-container * {
            box-sizing: border-box !important;
          }

          .header-wrapper,
          .student-info,
          .grades-table,
          .remark-section,
          .vacation-box,
          .affective-domain-card,
          .affective-signatures,
          .grading-key-container {
            page-break-inside: avoid;
          }

          .grades-table {
            width: 100% !important;
            margin: 8mm 0 6mm;
            font-size: 11px;
          }

          .grades-table th,
          .grades-table td {
            font-size: 9.5pt;
            padding: 4px 3px;
          }

          .grades-table th:nth-child(1),
          .grades-table td:nth-child(1) {
            width: 18%;
          }

          .grades-table th:nth-child(2),
          .grades-table td:nth-child(2),
          .grades-table th:nth-child(3),
          .grades-table td:nth-child(3),
          .grades-table th:nth-child(4),
          .grades-table td:nth-child(4),
          .grades-table th:nth-child(5),
          .grades-table td:nth-child(5),
          .grades-table th:nth-child(6),
          .grades-table td:nth-child(6),
          .grades-table th:nth-child(7),
          .grades-table td:nth-child(7) {
            width: 10%;
          }

          .grades-table th:nth-child(8),
          .grades-table td:nth-child(8) {
            width: 8%;
          }

          .grades-table th:nth-child(9),
          .grades-table td:nth-child(9) {
            width: 14%;
          }

          .remark-section {
            gap: 8mm;
            padding: 0 8mm 6mm;
          }

          .teacher-remarks,
          .domain-block {
            font-size: 9.5pt;
            max-width: 100%;
          }

          .remarks-column {
            flex: 1 1 48%;
            min-width: 0;
          }

          .psychomotor-block,
          .affective-block {
            min-width: 0;
            flex: 1 1 48%;
          }

          .vacation-box,
          .affective-signatures {
            gap: 12px;
            font-size: 9.5pt;
          }

          .grading-key-container {
            font-size: 9pt;
          }

          .af-domain-table {
            table-layout: fixed;
          }

          .af-domain-table th,
          .af-domain-table td {
            word-break: break-word;
          }

          .logo {
            width: 32mm;
            height: 38mm;
            margin-right: 8mm;
          }

          .photo-placeholder {
            width: 28mm;
            height: 38mm;
            margin-left: 8mm;
          }

          .school-name {
            font-size: 20pt;
          }
        }
      `}</style>
    </div>
  );
}
