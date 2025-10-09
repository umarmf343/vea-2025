"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  BookOpen,
  Users,
  FileText,
  GraduationCap,
  Clock,
  User,
  Plus,
  Save,
  Loader2,
  Eye,
  Send,
  Trash2,
  Pencil,
  Sparkles,
  CalendarClock,
  Download,
  Trophy,
  CheckCircle,
  RefreshCw,
  AlertTriangle,
  UserPlus,
  ArrowRightLeft,
  Check,
  UploadCloud,
} from "lucide-react";
import { StudyMaterials } from "@/components/study-materials";
import { Noticeboard } from "@/components/noticeboard";
import { NotificationCenter } from "@/components/notification-center";
import { InternalMessaging } from "@/components/internal-messaging";
import { TutorialLink } from "@/components/tutorial-link";
import { ExamScheduleOverview } from "@/components/exam-schedule-overview";
import { EnhancedReportCard } from "@/components/enhanced-report-card";
import { ReportCardPreviewOverlay } from "@/components/report-card-preview-overlay";
import {
  CONTINUOUS_ASSESSMENT_MAXIMUMS,
  deriveGradeFromScore,
  mapTermKeyToLabel,
} from "@/lib/grade-utils";
import { safeStorage } from "@/lib/safe-storage";
import { dbManager } from "@/lib/database-manager";
import { logger } from "@/lib/logger";
import { normalizeTimetableCollection } from "@/lib/timetable";
import { useToast } from "@/hooks/use-toast";
import { SchoolCalendarViewer } from "@/components/school-calendar-viewer";
import {
  TimetableWeeklyView,
  type TimetableWeeklyViewSlot,
} from "@/components/timetable-weekly-view";
import { cn } from "@/lib/utils";
import {
  STUDENT_MARKS_STORAGE_KEY,
  buildRawReportCardFromStoredRecord,
  getStoredStudentMarksRecord,
  readStudentMarksStore,
} from "@/lib/report-card-data";
import { mapReportCardRecordToRaw } from "@/lib/report-card-transformers";
import { buildReportCardHtml } from "@/lib/report-card-html";
import {
  REPORT_CARD_WORKFLOW_EVENT,
  getWorkflowRecords,
  getWorkflowSummary,
  resetReportCardSubmission,
  submitReportCardsForApproval,
  type ReportCardCumulativeSummary,
  type ReportCardWorkflowRecord,
} from "@/lib/report-card-workflow";
import type { ReportCardRecord, ReportCardSubjectRecord } from "@/lib/database";
import {
  AFFECTIVE_TRAITS,
  createBehavioralRecordSkeleton,
  PSYCHOMOTOR_SKILLS,
  interpretBehavioralSelection,
  normalizeBehavioralDomainKey,
} from "@/lib/report-card-constants";
import type {
  ClassTeacherRemarkEntry,
  ClassTeacherSubjectRemark,
  RawReportCardData,
  StoredStudentMarkRecord,
  StoredSubjectRecord,
} from "@/lib/report-card-types";
import {
  clearAssignmentReminderHistory,
  markAssignmentReminderSent,
  shouldSendAssignmentReminder,
} from "@/lib/assignment-reminders";
import { resolveStudentPassportFromCache } from "@/lib/student-passport";
import { resolveCachedAdmissionNumber } from "@/lib/student-cache";
import {
  DEFAULT_REPORT_CARD_COLUMNS,
  buildResolvedColumns,
  getColumnMaximum,
  normalizeColumnType,
  normalizeColumnsFromResponse,
  type ReportCardColumnConfig,
} from "@/lib/report-card-columns";

type BrowserRuntime = typeof globalThis & Partial<Window>;

const SUBJECT_REMARK_OPTIONS = [
  "Excellent",
  "V. Good",
  "Good",
  "Poor",
] as const;

type RemarkStyleKey = "excellent" | "vgood" | "good" | "poor";

const REMARK_STYLE_MAP: Record<
  RemarkStyleKey,
  {
    container: string;
    label: string;
    radio: string;
  }
> = {
  excellent: {
    container: "border-[#16a34a] bg-[#dcfce7]",
    label: "text-[#166534]",
    radio:
      "data-[state=checked]:border-[#16a34a] data-[state=checked]:bg-[#16a34a]/15 data-[state=checked]:text-[#16a34a] data-[state=checked]:[&_[data-slot=radio-group-indicator]_svg]:fill-[#16a34a]",
  },
  vgood: {
    container: "border-[#0d9488] bg-[#ccfbf1]",
    label: "text-[#0f766e]",
    radio:
      "data-[state=checked]:border-[#0d9488] data-[state=checked]:bg-[#0d9488]/15 data-[state=checked]:text-[#0d9488] data-[state=checked]:[&_[data-slot=radio-group-indicator]_svg]:fill-[#0d9488]",
  },
  good: {
    container: "border-[#2563eb] bg-[#dbeafe]",
    label: "text-[#1d4ed8]",
    radio:
      "data-[state=checked]:border-[#2563eb] data-[state=checked]:bg-[#2563eb]/15 data-[state=checked]:text-[#2563eb] data-[state=checked]:[&_[data-slot=radio-group-indicator]_svg]:fill-[#2563eb]",
  },
  poor: {
    container: "border-[#dc2626] bg-[#fee2e2]",
    label: "text-[#b91c1c]",
    radio:
      "data-[state=checked]:border-[#dc2626] data-[state=checked]:bg-[#dc2626]/15 data-[state=checked]:text-[#dc2626] data-[state=checked]:[&_[data-slot=radio-group-indicator]_svg]:fill-[#dc2626]",
  },
};

const normalizeRemarkStyleKey = (value: string): RemarkStyleKey => {
  const normalized = value.toLowerCase().replace(/[^a-z]/g, "");

  if (normalized.includes("excellent")) {
    return "excellent";
  }

  if (normalized.includes("vgood") || normalized.includes("verygood")) {
    return "vgood";
  }

  if (normalized.includes("poor")) {
    return "poor";
  }

  return "good";
};

const getRemarkStyles = (value: string) =>
  REMARK_STYLE_MAP[normalizeRemarkStyleKey(value)];

const CLASS_TEACHER_REMARK_LABELS: Record<ClassTeacherSubjectRemark, string> = {
  Excellent: "Excellent",
  "V.Good": "Very Good",
  Good: "Good",
  Poor: "Poor",
};

const CLASS_TEACHER_REMARK_OPTIONS = [
  {
    value: "Excellent" as ClassTeacherSubjectRemark,
    label: CLASS_TEACHER_REMARK_LABELS.Excellent,
    display: "Excellent",
    styleKey: "excellent" as RemarkStyleKey,
    badgeClass: "border-[#16a34a]/40 bg-[#16a34a]/10 text-[#166534]",
  },
  {
    value: "V.Good" as ClassTeacherSubjectRemark,
    label: CLASS_TEACHER_REMARK_LABELS["V.Good"],
    display: "V.Good",
    styleKey: "vgood" as RemarkStyleKey,
    badgeClass: "border-[#0d9488]/40 bg-[#0d9488]/10 text-[#0f766e]",
  },
  {
    value: "Good" as ClassTeacherSubjectRemark,
    label: CLASS_TEACHER_REMARK_LABELS.Good,
    display: "Good",
    styleKey: "good" as RemarkStyleKey,
    badgeClass: "border-[#2563eb]/40 bg-[#2563eb]/10 text-[#1d4ed8]",
  },
  {
    value: "Poor" as ClassTeacherSubjectRemark,
    label: CLASS_TEACHER_REMARK_LABELS.Poor,
    display: "Poor",
    styleKey: "poor" as RemarkStyleKey,
    badgeClass: "border-[#dc2626]/40 bg-[#dc2626]/10 text-[#b91c1c]",
  },
] as const;

type ClassTeacherRemarkValue = ClassTeacherSubjectRemark;

const interpretClassTeacherRemark = (
  value: unknown,
): ClassTeacherRemarkValue | null => {
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

  const directMatch = CLASS_TEACHER_REMARK_OPTIONS.find(
    (option) => option.value.toLowerCase().replace(/\s+/g, "") === normalized,
  );

  return directMatch ? directMatch.value : null;
};

const mapClassTeacherRemarkToSubjectRemark = (
  value: ClassTeacherRemarkValue,
): string => CLASS_TEACHER_REMARK_LABELS[value] ?? value;
const SUBJECT_REFRESH_TIMEOUT_MS = 15000;

const CLASS_TEACHER_REMARK_OPTION_MAP = CLASS_TEACHER_REMARK_OPTIONS.reduce(
  (acc, option) => {
    acc[option.value] = option;
    return acc;
  },
  {} as Record<
    ClassTeacherRemarkValue,
    (typeof CLASS_TEACHER_REMARK_OPTIONS)[number]
  >,
);

type RemarkChoiceOption<Value extends string> = {
  value: Value;
  display: string;
};

interface RemarkChoiceGroupProps<Value extends string> {
  idPrefix: string;
  options: readonly RemarkChoiceOption<Value>[];
  value: Value | undefined | null;
  onChange: (value: Value) => void;
  disabled?: boolean;
  className?: string;
}

const buildOptionId = (prefix: string, value: string) =>
  `${prefix}-${value.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

function RemarkChoiceGroup<Value extends string>({
  idPrefix,
  options,
  value,
  onChange,
  disabled = false,
  className,
}: RemarkChoiceGroupProps<Value>) {
  return (
    <RadioGroup
      value={(value ?? undefined) as string | undefined}
      onValueChange={(nextValue) => onChange(nextValue as Value)}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {options.map((option) => {
        const optionId = buildOptionId(idPrefix, option.value);
        const isSelected = value === option.value;
        const styles = getRemarkStyles(option.display);

        return (
          <div
            key={option.value}
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-2 text-xs transition-colors",
              isSelected
                ? styles.container
                : "border-slate-300 bg-white text-slate-500",
              disabled && !isSelected && "opacity-60",
              disabled && "cursor-not-allowed",
            )}
          >
            <RadioGroupItem
              value={option.value}
              id={optionId}
              disabled={disabled}
              className={cn(
                "border-slate-300 text-slate-400 transition-colors",
                styles.radio,
                disabled && "cursor-not-allowed",
              )}
            />
            <Label
              htmlFor={optionId}
              className={cn(
                "cursor-pointer text-xs font-semibold transition-colors",
                isSelected ? styles.label : "text-slate-500",
                disabled && "cursor-not-allowed",
              )}
            >
              {option.display}
            </Label>
          </div>
        );
      })}
    </RadioGroup>
  );
}

const SUBJECT_REMARK_CHOICES: readonly RemarkChoiceOption<
  (typeof SUBJECT_REMARK_OPTIONS)[number]
>[] = SUBJECT_REMARK_OPTIONS.map((value) => ({ value, display: value }));

const CLASS_TEACHER_REMARK_CHOICES: readonly RemarkChoiceOption<ClassTeacherRemarkValue>[] =
  CLASS_TEACHER_REMARK_OPTIONS.map((option) => ({
    value: option.value,
    display: option.display,
  }));

const REMARK_KEY_SEPARATOR = "::";

const buildRemarkKey = (subjectKey: string, studentId: string) =>
  `${subjectKey}${REMARK_KEY_SEPARATOR}${studentId}`;

const parseRemarkKey = (
  key: string,
): { subjectKey: string; studentId: string } => {
  const separatorIndex = key.lastIndexOf(REMARK_KEY_SEPARATOR);
  if (separatorIndex === -1) {
    return { subjectKey: key, studentId: "" };
  }

  return {
    subjectKey: key.slice(0, separatorIndex),
    studentId: key.slice(separatorIndex + REMARK_KEY_SEPARATOR.length),
  };
};

const getBrowserRuntime = (): BrowserRuntime | null => {
  if (typeof globalThis === "undefined") {
    return null;
  }

  return globalThis as BrowserRuntime;
};

const sanitizeFileName = (value: string) => {
  const trimmed = value.trim().toLowerCase();
  const sanitized = trimmed
    .replace(/[^a-z0-9\-_.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return sanitized.length > 0 ? sanitized : "report-card";
};

const normalizeClassToken = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }

  const collapsed = trimmed.replace(/[^a-z0-9]/g, "");
  return collapsed || trimmed;
};

const normalizeStudentString = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "";
};

const normalizeSubjectArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);

  return Array.from(new Set(normalized));
};

const normalizeTeacherClassAssignments = (
  input: unknown,
): TeacherClassAssignment[] => {
  if (!Array.isArray(input)) {
    return [];
  }

  return (input as Array<{ id?: unknown; name?: unknown; subjects?: unknown }>)
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const rawId = typeof entry.id === "string" ? entry.id.trim() : "";
      const rawName = typeof entry.name === "string" ? entry.name.trim() : "";
      const subjects = normalizeSubjectArray(entry.subjects);
      const fallbackId = rawId || rawName || `class_${index + 1}`;
      const fallbackName = rawName || rawId || `Class ${index + 1}`;

      return { id: fallbackId, name: fallbackName, subjects };
    })
    .filter((entry): entry is TeacherClassAssignment => entry !== null);
};

type TeacherClassAssignment = {
  id: string;
  name: string;
  subjects: string[];
};

type TeacherAssignmentsCacheEntry = {
  subjects: string[];
  classes: TeacherClassAssignment[];
  updatedAt: string;
};

type TeacherSubjectOption = {
  key: string;
  subject: string;
  classId: string;
  className: string;
  label: string;
};

const buildTeacherSubjectOptions = (
  classes: TeacherClassAssignment[],
  fallbackSubjects: string[],
): TeacherSubjectOption[] => {
  const options: TeacherSubjectOption[] = [];
  const seenKeys = new Set<string>();

  const registerOption = (
    subjectName: string,
    classId: string,
    className: string,
    baseToken: string,
  ) => {
    const normalizedSubject = subjectName.trim();
    if (!normalizedSubject) {
      return;
    }

    const baseKey = `${normalizedSubject.toLowerCase()}::${baseToken}`;
    let key = baseKey;
    let attempt = 1;
    while (seenKeys.has(key)) {
      key = `${baseKey}::${attempt}`;
      attempt += 1;
    }

    seenKeys.add(key);
    options.push({
      key,
      subject: normalizedSubject,
      classId,
      className,
      label: normalizedSubject,
    });
  };

  classes.forEach((cls, classIndex) => {
    if (!cls) {
      return;
    }

    const rawClassId = typeof cls.id === "string" ? cls.id.trim() : "";
    const rawClassName = typeof cls.name === "string" ? cls.name.trim() : "";
    const normalizedClassNameToken = rawClassName
      .replace(/\s+/g, "")
      .toLowerCase();
    const classToken =
      normalizeClassToken(rawClassId) ||
      normalizedClassNameToken ||
      `class_${classIndex + 1}`;
    const classId =
      rawClassId ||
      (normalizedClassNameToken
        ? `class_${normalizedClassNameToken}`
        : `class_${classIndex + 1}`);
    const className = rawClassName || rawClassId || `Class ${classIndex + 1}`;

    const subjects = Array.isArray(cls.subjects)
      ? cls.subjects.filter(
          (subject): subject is string => typeof subject === "string",
        )
      : [];

    subjects.forEach((subject, subjectIndex) => {
      const token = `${classToken || "class"}_${subjectIndex}`;
      registerOption(subject, classId, className, token);
    });
  });

  if (options.length === 0) {
    fallbackSubjects
      .filter(
        (subject): subject is string =>
          typeof subject === "string" && subject.trim().length > 0,
      )
      .forEach((subject, index) => {
        registerOption(subject, "", "", `subject_${index}`);
      });
  }

  return options;
};

const isClassTeacherGeneralRemarkSubject = (subject: string): boolean => {
  if (typeof subject !== "string") {
    return false;
  }

  const normalized = subject.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return (
    normalized.includes("general remark") && normalized.includes("class teacher")
  );
};

type TeacherAssignmentsCacheStore = Record<
  string,
  TeacherAssignmentsCacheEntry
>;

const TEACHER_ASSIGNMENTS_CACHE_KEY = "vea_teacher_assignments_cache_v1";

const areSubjectListsEqual = (left: string[], right: string[]): boolean => {
  if (left === right) {
    return true;
  }

  if (left.length !== right.length) {
    return false;
  }

  const normalize = (subjects: string[]) =>
    subjects
      .map((subject) =>
        typeof subject === "string" ? subject.trim().toLowerCase() : "",
      )
      .filter((subject) => subject.length > 0)
      .sort();

  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);

  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }

  return normalizedLeft.every(
    (subject, index) => subject === normalizedRight[index],
  );
};

const areClassAssignmentsEqual = (
  left: TeacherClassAssignment[],
  right: TeacherClassAssignment[],
): boolean => {
  if (left === right) {
    return true;
  }

  if (left.length !== right.length) {
    return false;
  }

  const serializeAssignments = (assignments: TeacherClassAssignment[]) =>
    assignments
      .map((assignment) => {
        const idToken = normalizeClassToken(assignment.id);
        const nameToken = normalizeClassToken(assignment.name);
        const subjects = normalizeSubjectArray(assignment.subjects)
          .map((subject) => subject.toLowerCase())
          .sort()
          .join(",");

        return `${idToken}|${nameToken}|${subjects}`;
      })
      .sort();

  const leftSerialized = serializeAssignments(left);
  const rightSerialized = serializeAssignments(right);

  if (leftSerialized.length !== rightSerialized.length) {
    return false;
  }

  return leftSerialized.every(
    (entry, index) => entry === rightSerialized[index],
  );
};

const readTeacherAssignmentsCache = (
  teacherId: string,
): TeacherAssignmentsCacheEntry | null => {
  if (!teacherId) {
    return null;
  }

  const raw = safeStorage.getItem(TEACHER_ASSIGNMENTS_CACHE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as TeacherAssignmentsCacheStore;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const entry = parsed[teacherId];
    if (!entry || typeof entry !== "object") {
      return null;
    }

    const subjects = normalizeSubjectArray(
      (entry as { subjects?: unknown }).subjects,
    );
    const classes = normalizeTeacherClassAssignments(
      (entry as { classes?: unknown }).classes,
    );

    if (subjects.length === 0 && classes.length === 0) {
      return null;
    }

    const updatedAt =
      typeof (entry as { updatedAt?: unknown }).updatedAt === "string"
        ? ((entry as { updatedAt: string }).updatedAt as string)
        : new Date(0).toISOString();

    return { subjects, classes, updatedAt };
  } catch (error) {
    logger.warn("Failed to read teacher assignments cache", { error });
    return null;
  }
};

const persistTeacherAssignmentsCache = (
  teacherId: string,
  subjects: string[],
  classes: TeacherClassAssignment[],
) => {
  if (!teacherId) {
    return;
  }

  try {
    const normalizedSubjects = normalizeSubjectArray(subjects);
    const normalizedClasses = normalizeTeacherClassAssignments(classes);

    const raw = safeStorage.getItem(TEACHER_ASSIGNMENTS_CACHE_KEY);
    let store: TeacherAssignmentsCacheStore = {};

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as TeacherAssignmentsCacheStore;
        if (parsed && typeof parsed === "object") {
          store = parsed;
        }
      } catch (parseError) {
        logger.warn("Failed to parse existing teacher assignments cache", {
          error: parseError,
        });
      }
    }

    store[teacherId] = {
      subjects: normalizedSubjects,
      classes: normalizedClasses,
      updatedAt: new Date().toISOString(),
    };

    safeStorage.setItem(TEACHER_ASSIGNMENTS_CACHE_KEY, JSON.stringify(store));
  } catch (error) {
    logger.warn("Failed to persist teacher assignments cache", { error });
  }
};

type AssignmentStudentInfo = {
  id: string;
  name: string | null;
  className: string | null;
};

type TeacherScopedStudent = {
  id: string;
  name: string;
  className: string;
  classId: string | null;
  subjects: string[];
  status: string;
};

const TEACHER_STUDENTS_CACHE_KEY = "vea_teacher_students_cache";
const TEACHER_STUDENTS_CACHE_NOTICE =
  "Showing the last known student roster because the live student service is temporarily unavailable.";
const TEACHER_SIGNATURE_STORAGE_KEY = "teacherSignatures";
const TEACHER_SIGNATURE_EVENT = "teacherSignatureUpdated";

interface TeacherSignatureStoreEntry {
  url: string;
  fileName?: string;
  uploadedAt?: string;
}

const readTeacherSignatureStore = (): Record<
  string,
  TeacherSignatureStoreEntry
> => {
  const raw = safeStorage.getItem(TEACHER_SIGNATURE_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<
      string,
      TeacherSignatureStoreEntry
    >;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return parsed;
  } catch (error) {
    logger.warn("Failed to parse teacher signature store", { error });
    return {};
  }
};

const persistTeacherSignatureStore = (
  store: Record<string, TeacherSignatureStoreEntry>,
) => {
  try {
    safeStorage.setItem(TEACHER_SIGNATURE_STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    logger.warn("Failed to persist teacher signature store", { error });
  }
};

interface TeacherDashboardProps {
  teacher: {
    id: string;
    name: string;
    email: string;
    subjects: string[];
    classes: TeacherClassAssignment[];
  };
  isContextLoading?: boolean;
  contextError?: string | null;
  onRefreshAssignments?: () => void | Promise<void>;
}

interface TeacherExamSummary {
  id: string;
  subject: string;
  className: string;
  examDate: string;
  startTime: string;
  endTime: string;
  term: string;
  session: string;
  status: "scheduled" | "completed" | "cancelled";
}

type TeacherTimetableSlot = TimetableWeeklyViewSlot;

type BehavioralDomainState = Record<string, Record<string, boolean>>;
type AttendanceState = Record<
  string,
  { present: number; absent: number; total: number }
>;
type StudentStatusState = Record<string, string>;
type ClassTeacherRemarksState = Record<string, ClassTeacherRemarkEntry>;

type TermInfoState = {
  numberInClass: string;
  nextTermBegins: string;
  vacationEnds: string;
  nextTermFees: string;
  feesBalance: string;
};

const createEmptyTermInfo = (): TermInfoState => ({
  numberInClass: "",
  nextTermBegins: "",
  vacationEnds: "",
  nextTermFees: "",
  feesBalance: "",
});

interface MarksRecord {
  studentId: string;
  studentName: string;
  firstCA: number;
  secondCA: number;
  noteAssignment: number;
  caTotal: number;
  exam: number;
  grandTotal: number;
  totalMarksObtainable: number;
  totalMarksObtained: number;
  averageScore: number;
  position: number;
  grade: string;
  teacherRemark: string;
}

interface RemarkStudentOption {
  studentId: string;
  studentName: string;
  classId: string | null;
  className: string | null;
}

type TeacherAssignmentStatus =
  | "draft"
  | "sent"
  | "submitted"
  | "graded"
  | "overdue";

interface AssignmentSubmissionRecord {
  id: string;
  studentId: string;
  status: "pending" | "submitted" | "graded";
  submittedAt: string | null;
  files?: { id: string; name: string; url?: string | null }[];
  comment?: string | null;
  grade?: string | null;
  score?: number | null;
}

interface TeacherAssignmentSummary {
  id: string;
  title: string;
  description: string;
  subject: string;
  className: string;
  classId?: string | null;
  dueDate: string;
  status: TeacherAssignmentStatus;
  maximumScore: number | null;
  submissions: AssignmentSubmissionRecord[];
  assignedStudentIds: string[];
  resourceName?: string | null;
  resourceType?: string | null;
  resourceUrl?: string | null;
  resourceSize?: number | null;
  createdAt?: string | null;
  updatedAt?: string;
}

type RawAssignmentRecord = Awaited<
  ReturnType<typeof dbManager.getAssignments>
>[number];

const ASSIGNMENT_STATUS_META: Record<
  TeacherAssignmentStatus,
  { label: string; badgeClass: string; accent: string; glow: string }
> = {
  draft: {
    label: "Draft",
    badgeClass: "border border-slate-200 bg-slate-100 text-slate-700",
    accent: "from-slate-100/70",
    glow: "shadow-[0_0_30px_-15px_rgba(71,85,105,0.8)]",
  },
  sent: {
    label: "Sent",
    badgeClass: "border border-blue-200 bg-blue-100 text-blue-700",
    accent: "from-blue-100/70",
    glow: "shadow-[0_0_30px_-15px_rgba(59,130,246,0.8)]",
  },
  submitted: {
    label: "Submitted",
    badgeClass: "border border-amber-200 bg-amber-100 text-amber-700",
    accent: "from-amber-100/70",
    glow: "shadow-[0_0_30px_-15px_rgba(217,119,6,0.8)]",
  },
  graded: {
    label: "Graded",
    badgeClass: "border border-emerald-200 bg-emerald-100 text-emerald-700",
    accent: "from-emerald-100/70",
    glow: "shadow-[0_0_30px_-12px_rgba(16,185,129,0.8)]",
  },
  overdue: {
    label: "Overdue",
    badgeClass: "border border-red-200 bg-red-100 text-red-700",
    accent: "from-red-100/70",
    glow: "shadow-[0_0_30px_-12px_rgba(248,113,113,0.8)]",
  },
};

export function TeacherDashboard({
  teacher,
  isContextLoading = false,
  contextError = null,
  onRefreshAssignments,
}: TeacherDashboardProps) {
  const { toast } = useToast();
  const cachedAssignments = useMemo(
    () => readTeacherAssignmentsCache(teacher.id),
    [teacher.id],
  );
  const [teacherAssignmentSources, setTeacherAssignmentSources] = useState<
    TeacherClassAssignment[]
  >(() => {
    if (Array.isArray(teacher.classes) && teacher.classes.length > 0) {
      return teacher.classes;
    }

    return cachedAssignments?.classes ?? [];
  });
  const [teacherSubjects, setTeacherSubjects] = useState<string[]>(() => {
    const normalizedSubjects = normalizeSubjectArray(teacher.subjects);
    if (normalizedSubjects.length > 0) {
      return normalizedSubjects;
    }

    return cachedAssignments?.subjects ?? [];
  });
  const [hasCompletedSubjectFetch, setHasCompletedSubjectFetch] = useState(
    () => {
      const normalizedSubjects = normalizeSubjectArray(teacher.subjects);
      if (normalizedSubjects.length > 0) {
        return true;
      }

      return Boolean(cachedAssignments?.subjects?.length);
    },
  );
  const [isTeacherSubjectsLoading, setIsTeacherSubjectsLoading] =
    useState(false);
  const [teacherSubjectsError, setTeacherSubjectsError] = useState<
    string | null
  >(null);
  const cachedAssignmentStateRef = useRef<TeacherAssignmentsCacheEntry>({
    subjects:
      cachedAssignments?.subjects ?? normalizeSubjectArray(teacher.subjects),
    classes: cachedAssignments?.classes ?? teacher.classes,
    updatedAt: cachedAssignments?.updatedAt ?? new Date(0).toISOString(),
  });
  const [columnConfig, setColumnConfig] = useState<ReportCardColumnConfig[]>(
    DEFAULT_REPORT_CARD_COLUMNS,
  );
  const resolvedColumns = useMemo(
    () => buildResolvedColumns(columnConfig),
    [columnConfig],
  );
  const [teacherSignature, setTeacherSignature] = useState(() => {
    const store = readTeacherSignatureStore();
    const entry = store[teacher.id];

    return {
      url: entry?.url ?? null,
      fileName: entry?.fileName ?? null,
      uploadedAt: entry?.uploadedAt ?? null,
    };
  });
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);
  const signatureFileInputRef = useRef<HTMLInputElement | null>(null);
  const hasScheduledAuthRedirectRef = useRef(false);
  const firstTestColumn = useMemo(() => {
    return (
      resolvedColumns.find(
        (column) =>
          !column.isExam &&
          normalizeColumnType(column.config.type) === "test" &&
          column.occurrence === 1,
      ) ?? null
    );
  }, [resolvedColumns]);
  const secondTestColumn = useMemo(() => {
    return (
      resolvedColumns.find(
        (column) =>
          !column.isExam &&
          normalizeColumnType(column.config.type) === "test" &&
          column.occurrence === 2,
      ) ?? null
    );
  }, [resolvedColumns]);
  const assignmentColumn = useMemo(() => {
    return (
      resolvedColumns.find(
        (column) =>
          !column.isExam &&
          normalizeColumnType(column.config.type) === "assignment",
      ) ?? null
    );
  }, [resolvedColumns]);
  const examColumn = useMemo(
    () => resolvedColumns.find((column) => column.isExam) ?? null,
    [resolvedColumns],
  );
  const firstTestMaximum = useMemo(
    () => (firstTestColumn ? getColumnMaximum(firstTestColumn.config) : 0),
    [firstTestColumn],
  );
  const secondTestMaximum = useMemo(
    () => (secondTestColumn ? getColumnMaximum(secondTestColumn.config) : 0),
    [secondTestColumn],
  );
  const assignmentMaximum = useMemo(
    () => (assignmentColumn ? getColumnMaximum(assignmentColumn.config) : 0),
    [assignmentColumn],
  );
  const examMaximum = useMemo(
    () => (examColumn ? getColumnMaximum(examColumn.config) : 0),
    [examColumn],
  );
  const hasFirstTestColumn = firstTestMaximum > 0;
  const hasSecondTestColumn = secondTestMaximum > 0;
  const hasAssignmentColumn = assignmentMaximum > 0;
  const hasExamColumn = examMaximum > 0;
  const continuousAssessmentMaximum =
    firstTestMaximum + secondTestMaximum + assignmentMaximum;
  const hasContinuousColumns =
    hasFirstTestColumn || hasSecondTestColumn || hasAssignmentColumn;
  const fallbackTotalMaximum =
    CONTINUOUS_ASSESSMENT_MAXIMUMS.ca1 +
    CONTINUOUS_ASSESSMENT_MAXIMUMS.ca2 +
    CONTINUOUS_ASSESSMENT_MAXIMUMS.assignment +
    CONTINUOUS_ASSESSMENT_MAXIMUMS.exam;
  const defaultTotalMaximum = useMemo(() => {
    const total =
      firstTestMaximum + secondTestMaximum + assignmentMaximum + examMaximum;
    return total > 0 ? total : fallbackTotalMaximum;
  }, [
    assignmentMaximum,
    examMaximum,
    fallbackTotalMaximum,
    firstTestMaximum,
    secondTestMaximum,
  ]);
  const firstTestLabel =
    firstTestColumn?.config.name ?? "1st Continuous Assessment";
  const secondTestLabel =
    secondTestColumn?.config.name ?? "2nd Continuous Assessment";
  const assignmentLabel = assignmentColumn?.config.name ?? "Note / Assignment";
  const examLabel = examColumn?.config.name ?? "Exam";
  const assessmentWeightingSummary = useMemo(() => {
    const segments: string[] = [];
    if (hasFirstTestColumn) {
      segments.push(`${firstTestLabel} ${firstTestMaximum}`);
    }
    if (hasSecondTestColumn) {
      segments.push(`${secondTestLabel} ${secondTestMaximum}`);
    }
    if (hasAssignmentColumn) {
      segments.push(`${assignmentLabel} ${assignmentMaximum}`);
    }
    if (hasExamColumn) {
      segments.push(`${examLabel} ${examMaximum}`);
    }
    return segments.join(", ");
  }, [
    assignmentLabel,
    assignmentMaximum,
    examLabel,
    examMaximum,
    firstTestLabel,
    firstTestMaximum,
    hasAssignmentColumn,
    hasExamColumn,
    hasFirstTestColumn,
    hasSecondTestColumn,
    secondTestLabel,
    secondTestMaximum,
  ]);
  const teacherSignatureUploadedAtLabel = useMemo(() => {
    if (!teacherSignature.uploadedAt) {
      return null;
    }

    const parsed = new Date(teacherSignature.uploadedAt);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }, [teacherSignature.uploadedAt]);
  useEffect(() => {
    let isMounted = true;

    const loadColumns = async () => {
      try {
        const response = await fetch("/api/report-cards/config");
        if (!response.ok) {
          throw new Error("Unable to load report card configuration");
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
        logger.warn(
          "Unable to load report card columns configuration for teacher dashboard",
          { error },
        );
        if (!isMounted) {
          return;
        }
        setColumnConfig(DEFAULT_REPORT_CARD_COLUMNS);
      }
    };

    void loadColumns();

    return () => {
      isMounted = false;
    };
  }, []);
  useEffect(() => {
    const handleSignatureEvent = (payload: unknown) => {
      if (!payload || typeof payload !== "object") {
        return;
      }

      const eventPayload = payload as {
        teacherId?: string;
        signatureUrl?: string | null;
        fileName?: string | null;
        uploadedAt?: string | null;
      };

      if (eventPayload.teacherId !== teacher.id) {
        return;
      }

      setTeacherSignature({
        url: eventPayload.signatureUrl ?? null,
        fileName: eventPayload.fileName ?? null,
        uploadedAt: eventPayload.uploadedAt ?? null,
      });
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key && event.key !== TEACHER_SIGNATURE_STORAGE_KEY) {
        return;
      }

      const store = readTeacherSignatureStore();
      const entry = store[teacher.id];

      setTeacherSignature({
        url: entry?.url ?? null,
        fileName: entry?.fileName ?? null,
        uploadedAt: entry?.uploadedAt ?? null,
      });
    };

    dbManager.on(TEACHER_SIGNATURE_EVENT, handleSignatureEvent);

    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleStorageEvent);
    }

    return () => {
      dbManager.off(TEACHER_SIGNATURE_EVENT, handleSignatureEvent);
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", handleStorageEvent);
      }
    };
  }, [teacher.id]);
  const normalizeScores = useCallback(
    (
      input: Partial<{
        ca1: number;
        ca2: number;
        assignment: number;
        exam: number;
      }>,
    ) => {
      const clampValue = (raw: unknown, max: number) => {
        if (!Number.isFinite(max) || max <= 0) {
          return 0;
        }

        const numeric = typeof raw === "number" ? raw : Number(raw);
        if (!Number.isFinite(numeric)) {
          return 0;
        }

        if (numeric <= 0) {
          return 0;
        }

        if (numeric >= max) {
          return Math.round(max);
        }

        return Math.round(numeric);
      };

      return {
        ca1: hasFirstTestColumn ? clampValue(input.ca1, firstTestMaximum) : 0,
        ca2: hasSecondTestColumn ? clampValue(input.ca2, secondTestMaximum) : 0,
        assignment: hasAssignmentColumn
          ? clampValue(input.assignment, assignmentMaximum)
          : 0,
        exam: hasExamColumn ? clampValue(input.exam, examMaximum) : 0,
      };
    },
    [
      assignmentMaximum,
      examMaximum,
      firstTestMaximum,
      hasAssignmentColumn,
      hasExamColumn,
      hasFirstTestColumn,
      hasSecondTestColumn,
      secondTestMaximum,
    ],
  );

  const calculateScoreTotals = useCallback(
    (
      input: Partial<{
        ca1: number;
        ca2: number;
        assignment: number;
        exam: number;
      }>,
    ) => {
      const normalized = normalizeScores(input);
      const caTotal = normalized.ca1 + normalized.ca2 + normalized.assignment;
      const grandTotal = caTotal + normalized.exam;

      return { normalized, caTotal, grandTotal };
    },
    [normalizeScores],
  );

  const deriveGradeForTotals = useCallback(
    (total: number, obtainable: number) => {
      const safeTotal = Number.isFinite(total)
        ? Math.max(0, Math.round(total))
        : 0;
      const safeObtainable =
        Number.isFinite(obtainable) && obtainable > 0
          ? Math.round(obtainable)
          : defaultTotalMaximum;
      if (safeObtainable <= 0) {
        return deriveGradeFromScore(safeTotal);
      }

      const percentage = Math.max(
        0,
        Math.min(Math.round((safeTotal / safeObtainable) * 100), 100),
      );
      return deriveGradeFromScore(percentage);
    },
    [defaultTotalMaximum],
  );

  const scheduleAuthRedirect = useCallback(() => {
    if (hasScheduledAuthRedirectRef.current) {
      return;
    }

    hasScheduledAuthRedirectRef.current = true;

    const runtimeInstance = getBrowserRuntime();

    try {
      safeStorage.removeItem("vea_auth_token");
    } catch (storageError) {
      logger.warn("Failed to clear auth token after unauthorized response", {
        error:
          storageError instanceof Error ? storageError.message : storageError,
      });
    }

    const performRedirect = () => {
      const runtimeLocation = runtimeInstance?.location;
      if (!runtimeLocation) {
        return;
      }

      try {
        if (typeof runtimeLocation.replace === "function") {
          runtimeLocation.replace("/");
        } else {
          runtimeLocation.href = "/";
        }
      } catch (navigationError) {
        logger.warn("Failed to navigate after auth expiry", {
          error:
            navigationError instanceof Error
              ? navigationError.message
              : navigationError,
        });
      }
    };

    if (runtimeInstance && typeof runtimeInstance.setTimeout === "function") {
      runtimeInstance.setTimeout(performRedirect, 400);
    } else {
      performRedirect();
    }
  }, []);
  const handleTeacherSignatureUpload = useCallback(
    async (file: File | null) => {
      if (!file) {
        return;
      }

      if (!file.type.startsWith("image/")) {
        toast({
          variant: "destructive",
          title: "Unsupported file",
          description: "Please upload an image file (PNG, JPG, or SVG).",
        });
        return;
      }

      const MAX_FILE_SIZE_BYTES = 1.5 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({
          variant: "destructive",
          title: "File too large",
          description: "Please upload a signature image smaller than 1.5MB.",
        });
        return;
      }

      setIsUploadingSignature(true);

      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") {
              resolve(reader.result);
            } else {
              reject(new Error("Unable to read the selected signature file."));
            }
          };
          reader.onerror = () =>
            reject(new Error("Unable to process the selected signature file."));
          reader.readAsDataURL(file);
        });

        const uploadedAt = new Date().toISOString();
        const store = readTeacherSignatureStore();
        store[teacher.id] = {
          url: dataUrl,
          fileName: file.name,
          uploadedAt,
        };
        persistTeacherSignatureStore(store);

        setTeacherSignature({ url: dataUrl, fileName: file.name, uploadedAt });
        dbManager.triggerEvent(TEACHER_SIGNATURE_EVENT, {
          teacherId: teacher.id,
          signatureUrl: dataUrl,
          fileName: file.name,
          uploadedAt,
        });

        toast({
          title: "Signature updated",
          description:
            "Your digital signature will now appear on report cards and previews.",
        });
      } catch (error) {
        logger.warn("Failed to upload teacher signature", { error });
        toast({
          variant: "destructive",
          title: "Upload failed",
          description:
            error instanceof Error
              ? error.message
              : "We couldn't process this signature file. Please try again with a different image.",
        });
      } finally {
        setIsUploadingSignature(false);
      }
    },
    [teacher.id, toast],
  );

  const handleRemoveTeacherSignature = useCallback(() => {
    const store = readTeacherSignatureStore();
    if (store[teacher.id]) {
      delete store[teacher.id];
      persistTeacherSignatureStore(store);
    }

    setTeacherSignature({ url: null, fileName: null, uploadedAt: null });
    dbManager.triggerEvent(TEACHER_SIGNATURE_EVENT, {
      teacherId: teacher.id,
      signatureUrl: null,
      fileName: null,
      uploadedAt: null,
    });

    if (signatureFileInputRef.current) {
      signatureFileInputRef.current.value = "";
    }

    toast({
      title: "Signature removed",
      description:
        "Your report cards will no longer display a signature until you upload a new one.",
    });
  }, [teacher.id, toast]);

  const handleTeacherSignatureFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      void handleTeacherSignatureUpload(file ?? null);
      event.target.value = "";
    },
    [handleTeacherSignatureUpload],
  );
  const teacherClasses = useMemo(() => {
    const deduped: TeacherClassAssignment[] = [];
    const idIndex = new Map<string, number>();
    const nameIndex = new Map<string, number>();

    teacherAssignmentSources.forEach((cls, index) => {
      if (!cls) {
        return;
      }

      const rawId = typeof cls.id === "string" ? cls.id.trim() : "";
      const rawName = typeof cls.name === "string" ? cls.name.trim() : "";
      const idToken = normalizeClassToken(rawId);
      const nameToken = normalizeClassToken(rawName);

      const subjects = Array.isArray(cls.subjects)
        ? Array.from(
            new Set(
              cls.subjects
                .map((subject) =>
                  typeof subject === "string" ? subject.trim() : "",
                )
                .filter((subject) => subject.length > 0),
            ),
          )
        : [];

      const resolvedId =
        rawId ||
        (rawName
          ? `class_${normalizeClassToken(rawName)}`
          : `class_${index + 1}`);
      const resolvedName = rawName || rawId || `Class ${index + 1}`;

      const existingIndex =
        (idToken && idIndex.has(idToken) ? idIndex.get(idToken) : undefined) ??
        (nameToken && nameIndex.has(nameToken)
          ? nameIndex.get(nameToken)
          : undefined) ??
        -1;

      if (existingIndex >= 0) {
        const existing = deduped[existingIndex];
        const mergedSubjects = new Set([...existing.subjects, ...subjects]);
        const preferredName =
          existing.name && existing.name !== existing.id
            ? existing.name
            : resolvedName && resolvedName !== resolvedId
              ? resolvedName
              : existing.name || resolvedName;

        deduped[existingIndex] = {
          id: existing.id || resolvedId,
          name: preferredName || existing.id || resolvedId,
          subjects: Array.from(mergedSubjects),
        };

        if (idToken && !idIndex.has(idToken)) {
          idIndex.set(idToken, existingIndex);
        }

        if (nameToken && !nameIndex.has(nameToken)) {
          nameIndex.set(nameToken, existingIndex);
        }

        return;
      }

      const insertionIndex = deduped.length;
      deduped.push({ id: resolvedId, name: resolvedName, subjects });

      if (idToken) {
        idIndex.set(idToken, insertionIndex);
      }

      if (nameToken) {
        nameIndex.set(nameToken, insertionIndex);
      }
    });

    return deduped;
  }, [teacherAssignmentSources]);
  const firstTeacherClass = teacherClasses[0] ?? null;
  const teacherClassNames = useMemo(
    () => teacherClasses.map((cls) => cls.name),
    [teacherClasses],
  );
  const teacherClassIds = useMemo(
    () => teacherClasses.map((cls) => cls.id),
    [teacherClasses],
  );
  const noClassesAssigned = teacherClasses.length === 0;
  const teacherClassTokenList = useMemo(() => {
    const tokens = new Set<string>();
    teacherClasses.forEach((cls) => {
      const idToken = normalizeClassToken(cls.id);
      const nameToken = normalizeClassToken(cls.name);
      if (idToken) {
        tokens.add(idToken);
      }
      if (nameToken) {
        tokens.add(nameToken);
      }
    });
    return Array.from(tokens);
  }, [teacherClasses]);
  const teacherClassTokenKey = useMemo(
    () => teacherClassTokenList.join("|"),
    [teacherClassTokenList],
  );
  const teacherHasAssignedClasses = teacherClassTokenList.length > 0;
  const normalizeClassName = useCallback(
    (value: string) => value.replace(/\s+/g, "").toLowerCase(),
    [],
  );
  const [selectedTab, setSelectedTab] = useState("overview");
  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [assignmentDialogMode, setAssignmentDialogMode] = useState<
    "create" | "edit"
  >("create");
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(
    null,
  );
  const [showSubmissions, setShowSubmissions] = useState(false);
  const [selectedAssignment, setSelectedAssignment] =
    useState<TeacherAssignmentSummary | null>(null);
  const [previewAssignment, setPreviewAssignment] =
    useState<TeacherAssignmentSummary | null>(null);
  const [assignmentRoster, setAssignmentRoster] = useState<
    Record<string, AssignmentStudentInfo>
  >({});
  const [selectedClass, setSelectedClass] = useState(
    () => firstTeacherClass?.name ?? "",
  );
  const [selectedClassId, setSelectedClassId] = useState(
    () => firstTeacherClass?.id ?? "",
  );
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedSubjectKey, setSelectedSubjectKey] = useState("");
  const [isSubjectSwitcherOpen, setIsSubjectSwitcherOpen] = useState(false);
  const isComponentMountedRef = useRef(false);
  useEffect(() => {
    isComponentMountedRef.current = true;
    return () => {
      isComponentMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const normalizedClasses = normalizeTeacherClassAssignments(teacher.classes);

    setTeacherAssignmentSources((previous) => {
      if (normalizedClasses.length === 0 && previous.length > 0) {
        return previous;
      }

      if (areClassAssignmentsEqual(previous, normalizedClasses)) {
        return previous;
      }

      return normalizedClasses;
    });
  }, [teacher.classes]);

  useEffect(() => {
    const normalizedSubjects = normalizeSubjectArray(teacher.subjects);

    setTeacherSubjects((previous) => {
      if (normalizedSubjects.length === 0 && previous.length > 0) {
        return previous;
      }

      if (areSubjectListsEqual(previous, normalizedSubjects)) {
        return previous;
      }

      return normalizedSubjects;
    });
  }, [teacher.subjects]);

  useEffect(() => {
    cachedAssignmentStateRef.current = {
      subjects: teacherSubjects,
      classes: teacherAssignmentSources,
      updatedAt: new Date().toISOString(),
    };
  }, [teacherAssignmentSources, teacherSubjects]);

  useEffect(() => {
    if (teacherSubjects.length === 0 && teacherAssignmentSources.length === 0) {
      return;
    }

    persistTeacherAssignmentsCache(
      teacher.id,
      teacherSubjects,
      teacherAssignmentSources,
    );
  }, [teacher.id, teacherAssignmentSources, teacherSubjects]);

  const fetchAssignedSubjects = useCallback(async (): Promise<boolean> => {
    const cachedAssignments = cachedAssignmentStateRef.current;
    const runtime = getBrowserRuntime();
    const abortController =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let shouldResetLoadingFlag = false;

    if (abortController && runtime?.setTimeout) {
      timeoutId = runtime.setTimeout(() => {
        abortController.abort();
      }, SUBJECT_REFRESH_TIMEOUT_MS);
    }

    if (isComponentMountedRef.current) {
      console.log("📡 Fetching teacher subjects...");
    } else {
      console.log("📡 Fetching teacher subjects... (component not mounted)");
    }

    try {
      if (isComponentMountedRef.current) {
        setIsTeacherSubjectsLoading(true);
        shouldResetLoadingFlag = true;
        setTeacherSubjectsError(null);
      }

      const token = safeStorage.getItem("vea_auth_token");
      if (!token) {
        console.log("❌ Subject fetch failed: Missing authentication token");
        if (isComponentMountedRef.current) {
          const cached = readTeacherAssignmentsCache(teacher.id);
          if (cached) {
            setTeacherSubjects(cached.subjects);
            setTeacherAssignmentSources(cached.classes);
          }
          const sessionExpiredMessage =
            "Your session has expired. Please log in again to refresh your subject assignments.";
          setTeacherSubjectsError(sessionExpiredMessage);
          toast({
            variant: "destructive",
            title: "Session expired",
            description: sessionExpiredMessage,
          });
          scheduleAuthRedirect();
        }
        return false;
      }

      const response = await fetch(
        `/api/teachers/${encodeURIComponent(teacher.id)}/subjects`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
          signal: abortController?.signal,
        },
      );

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const fallbackMessage =
          response.status === 401
            ? "Your session has expired. Please log in again to refresh your subject assignments."
            : response.status === 403
              ? "You do not have permission to load subject assignments."
              : "Unable to load your subject assignments.";
        const message =
          typeof (payload as { error?: unknown }).error === "string"
            ? ((payload as { error?: string }).error as string)
            : fallbackMessage;
        const errorWithStatus = new Error(message) as Error & {
          status?: number;
        };
        errorWithStatus.status = response.status;
        throw errorWithStatus;
      }

      const normalizedSubjects = normalizeSubjectArray(
        (payload as { subjects?: unknown }).subjects,
      );
      const normalizedClasses = normalizeTeacherClassAssignments(
        (payload as { classes?: unknown }).classes,
      );

      if (!isComponentMountedRef.current) {
        console.log(
          "✅ Subjects loaded: component unmounted before state update",
        );
        return false;
      }

      setTeacherSubjects(normalizedSubjects);
      setTeacherAssignmentSources(normalizedClasses);
      persistTeacherAssignmentsCache(
        teacher.id,
        normalizedSubjects,
        normalizedClasses,
      );

      if (normalizedSubjects.length === 0) {
        const message =
          typeof (payload as { message?: unknown }).message === "string"
            ? ((payload as { message?: string }).message as string)
            : null;
        setTeacherSubjectsError(
          message ??
            "No subjects have been assigned to you yet. Please contact your administrator.",
        );
      } else {
        setTeacherSubjectsError(null);
      }

      console.log(`✅ Subjects loaded: ${normalizedSubjects.length} items`);
      return true;
    } catch (error) {
      if (!isComponentMountedRef.current) {
        return false;
      }

      const status =
        typeof (error as { status?: number }).status === "number"
          ? ((error as { status?: number }).status as number)
          : null;
      const logDetails =
        status !== null
          ? `${status} ${error instanceof Error ? error.message : String(error)}`
          : error instanceof Error
            ? error.message
            : String(error);

      console.log(`❌ Subject fetch failed: ${logDetails}`);

      if (error instanceof DOMException && error.name === "AbortError") {
        const timeoutMessage =
          "The request to refresh your subjects took too long. Please check your connection and try again.";
        setTeacherSubjectsError(timeoutMessage);
        toast({
          variant: "destructive",
          title: "Subject refresh timed out",
          description: timeoutMessage,
        });
      } else {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to load your subject assignments.";
        setTeacherSubjectsError(message);
        logger.warn(
          "Teacher subject refresh failed; using cached assignments",
          {
            error: error instanceof Error ? error.message : error,
            teacherId: teacher.id,
            status,
          },
        );

        if (status === 401 || status === 403) {
          toast({
            variant: "destructive",
            title: "Session expired",
            description:
              "Please log in again to continue working with your subjects.",
          });
          scheduleAuthRedirect();
        } else if (status === null) {
          toast({
            title: "Offline mode: using last known data.",
            description:
              "We couldn't reach the server. Showing the last known subjects.",
          });
        } else {
          toast({
            variant: "destructive",
            title: "Failed to refresh subjects",
            description: message,
          });
        }
      }

      const storedAssignments = readTeacherAssignmentsCache(teacher.id);
      const restoredSubjects = storedAssignments?.subjects?.length
        ? storedAssignments.subjects
        : Array.isArray(cachedAssignments.subjects)
          ? [...cachedAssignments.subjects]
          : [];
      const restoredClasses = storedAssignments?.classes?.length
        ? storedAssignments.classes
        : Array.isArray(cachedAssignments.classes)
          ? cachedAssignments.classes.map((entry) => ({
              ...entry,
              subjects: Array.isArray(entry.subjects)
                ? [...entry.subjects]
                : [],
            }))
          : [];

      setTeacherSubjects(restoredSubjects);
      setTeacherAssignmentSources(restoredClasses);

      return false;
    } finally {
      if (timeoutId !== null && runtime?.clearTimeout) {
        runtime.clearTimeout(timeoutId);
      }
      console.log("✅ Resetting isTeacherSubjectsLoading to false");
      if (isComponentMountedRef.current) {
        setHasCompletedSubjectFetch(true);
        if (shouldResetLoadingFlag) {
          setIsTeacherSubjectsLoading(false);
        }
      }
    }
  }, [cachedAssignmentStateRef, scheduleAuthRedirect, teacher.id, toast]);

  useEffect(() => {
    void (async () => {
      const success = await fetchAssignedSubjects();
      if (!success) {
        logger.warn("Initial subject assignment fetch failed", {
          teacherId: teacher.id,
        });
      }
    })();
  }, [fetchAssignedSubjects, teacher.id]);

  const [selectedTerm, setSelectedTerm] = useState("first");
  const [selectedSession, setSelectedSession] = useState("2024/2025");
  const [workflowRecords, setWorkflowRecords] = useState<
    ReportCardWorkflowRecord[]
  >([]);
  const [isSubmittingForApproval, setIsSubmittingForApproval] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSavingAcademicRecords, setIsSavingAcademicRecords] = useState(false);
  const [isCancellingSubmission, setIsCancellingSubmission] = useState(false);
  const [additionalData, setAdditionalData] = useState(() => ({
    affectiveDomain: {
      student_john_doe: {
        neatness: "Excellent",
        honesty: "Excellent",
        punctuality: "Excellent",
        leadership: "Very Good",
        relationship: "Excellent",
      },
    } as BehavioralDomainState,
    psychomotorDomain: {
      student_john_doe: {
        handwriting: "Excellent",
        sport: "Very Good",
        drawing: "Good",
        craft: "Very Good",
      },
    } as BehavioralDomainState,
    classTeacherRemarks: {} as ClassTeacherRemarksState,
    attendance: {
      student_john_doe: { present: 58, absent: 2, total: 60 },
      student_alice_smith: { present: 55, absent: 5, total: 60 },
      student_mike_johnson: { present: 53, absent: 7, total: 60 },
    } as AttendanceState,
    studentStatus: {
      student_john_doe: "promoted",
      student_alice_smith: "promoted",
      student_mike_johnson: "promoted-on-trial",
    } as StudentStatusState,
    termInfo: {
      numberInClass: "25",
      nextTermBegins: "2025-05-06",
      vacationEnds: "2025-04-30",
      nextTermFees: "₦52,500",
      feesBalance: "₦0",
    },
  }));
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewStudentId, setPreviewStudentId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<RawReportCardData | null>(
    null,
  );
  const [isPreviewDownloading, setIsPreviewDownloading] = useState(false);

  const assignmentFormDefaultMaximum = useMemo(() => {
    const fallback = CONTINUOUS_ASSESSMENT_MAXIMUMS.assignment ?? 20;
    return assignmentMaximum > 0 ? assignmentMaximum : fallback;
  }, [assignmentMaximum]);
  const assignmentDefaultSyncRef = useRef(assignmentFormDefaultMaximum);

  const [assignmentForm, setAssignmentForm] = useState(() => ({
    title: "",
    description: "",
    dueDate: "",
    subject: firstTeacherClass?.subjects[0] ?? teacherSubjects[0] ?? "",
    classId: firstTeacherClass?.id ?? "",
    className: firstTeacherClass?.name ?? "",
    maximumScore: String(assignmentFormDefaultMaximum),
    file: null as File | null,
    resourceName: "",
    resourceType: "",
    resourceUrl: "",
    resourceSize: null as number | null,
  }));
  const [assignments, setAssignments] = useState<TeacherAssignmentSummary[]>(
    [],
  );
  const [isAssignmentsLoading, setIsAssignmentsLoading] = useState(true);
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  const [assignmentActionId, setAssignmentActionId] = useState<string | null>(
    null,
  );
  const [deletingAssignmentId, setDeletingAssignmentId] = useState<
    string | null
  >(null);
  const [gradingDrafts, setGradingDrafts] = useState<
    Record<string, { score: string; comment: string }>
  >({});
  const [gradingSubmissionId, setGradingSubmissionId] = useState<string | null>(
    null,
  );
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [teacherStudents, setTeacherStudents] = useState<
    TeacherScopedStudent[]
  >([]);
  const [isTeacherStudentsLoading, setIsTeacherStudentsLoading] =
    useState(false);
  const [teacherStudentsError, setTeacherStudentsError] = useState<
    string | null
  >(null);
  const [teacherStudentsMessage, setTeacherStudentsMessage] = useState<
    string | null
  >(null);
  const [marksData, setMarksData] = useState<MarksRecord[]>([]);
  const [selectedRemarkStudentId, setSelectedRemarkStudentId] =
    useState<string>("");
  const [addStudentDialogSubjectKey, setAddStudentDialogSubjectKey] =
    useState<string>("");
  const signatureInputId = useId();
  const assignmentSubjectFieldId = useId();
  const assignmentClassFieldId = useId();

  const resolvedAssignmentMaximum = (() => {
    const parsed = Number(assignmentForm.maximumScore);
    return Number.isFinite(parsed) && parsed > 0
      ? Math.round(parsed)
      : assignmentFormDefaultMaximum;
  })();
  useEffect(() => {
    setAssignmentForm((prev) => {
      const previousDefault = assignmentDefaultSyncRef.current;
      assignmentDefaultSyncRef.current = assignmentFormDefaultMaximum;

      if (prev.maximumScore === String(assignmentFormDefaultMaximum)) {
        return prev;
      }

      const parsed = Number(prev.maximumScore);
      if (
        prev.maximumScore &&
        Number.isFinite(parsed) &&
        parsed > 0 &&
        Math.round(parsed) !== previousDefault
      ) {
        return prev;
      }

      return {
        ...prev,
        maximumScore: String(assignmentFormDefaultMaximum),
      };
    });
  }, [assignmentFormDefaultMaximum]);
  const isEditingAssignment = assignmentDialogMode === "edit";
  const assignmentDialogTitle = isEditingAssignment
    ? "Update Assignment"
    : "Create New Assignment";
  const assignmentDialogDescription = isEditingAssignment
    ? "Refresh the assignment details before you share or resend it to your class."
    : "Design a rich assignment experience for your students with attachments and clear guidance.";

  const assignmentInsights = useMemo(() => {
    if (assignments.length === 0) {
      return {
        total: 0,
        draftCount: 0,
        sentCount: 0,
        overdueCount: 0,
        activeAssignments: 0,
        totalCapacity: 0,
        submissionCount: 0,
        gradedCount: 0,
        pendingGrading: 0,
        submissionRate: 0,
        gradingRate: 0,
        averageScore: null as number | null,
      };
    }

    let draftCount = 0;
    let sentCount = 0;
    let overdueCount = 0;
    let totalCapacity = 0;
    let submissionCount = 0;
    let gradedCount = 0;
    let pendingGrading = 0;
    let scoreSum = 0;
    let scoreEntries = 0;

    assignments.forEach((assignment) => {
      const status = assignment.status;
      if (status === "draft") {
        draftCount += 1;
      } else if (status === "sent" || status === "submitted") {
        sentCount += 1;
      } else if (status === "overdue") {
        overdueCount += 1;
      }

      const assignedStudents = Array.isArray(assignment.assignedStudentIds)
        ? assignment.assignedStudentIds.length
        : 0;
      const capacity = assignedStudents || assignment.submissions.length;
      totalCapacity += capacity;

      assignment.submissions.forEach((submission) => {
        if (["submitted", "graded"].includes(submission.status)) {
          submissionCount += 1;
        }
        if (submission.status === "graded") {
          gradedCount += 1;
        }
        if (submission.status === "submitted") {
          pendingGrading += 1;
        }
        if (typeof submission.score === "number") {
          scoreSum += submission.score;
          scoreEntries += 1;
        }
      });

      if (status !== "draft" && status !== "graded" && status !== "overdue") {
        const dueTimestamp = Date.parse(assignment.dueDate);
        if (!Number.isNaN(dueTimestamp) && dueTimestamp < Date.now()) {
          overdueCount += 1;
        }
      }
    });

    const activeAssignments = Math.max(assignments.length - draftCount, 0);
    const submissionRate =
      totalCapacity > 0
        ? Math.round((submissionCount / totalCapacity) * 100)
        : submissionCount > 0
          ? 100
          : 0;
    const gradingRate =
      submissionCount > 0
        ? Math.round((gradedCount / submissionCount) * 100)
        : 0;
    const averageScore =
      scoreEntries > 0
        ? Math.round((scoreSum / scoreEntries) * 100) / 100
        : null;

    return {
      total: assignments.length,
      draftCount,
      sentCount,
      overdueCount,
      activeAssignments,
      totalCapacity,
      submissionCount,
      gradedCount,
      pendingGrading,
      submissionRate,
      gradingRate,
      averageScore,
    };
  }, [assignments]);

  const normalizeTeacherStudentRecords = useCallback(
    (records: unknown): TeacherScopedStudent[] => {
      if (!Array.isArray(records)) {
        return [];
      }

      const tokenSet = new Set(teacherClassTokenList);
      const fallbackClassName = teacherClasses[0]?.name ?? "";

      return records
        .map((entry) => {
          if (!entry || typeof entry !== "object") {
            return null;
          }

          const source = entry as Record<string, unknown>;
          const primaryId = normalizeStudentString(source.id);
          const alternateId = normalizeStudentString(
            (source as { studentId?: unknown }).studentId,
          );
          const id =
            primaryId ||
            alternateId ||
            `student_${Math.random().toString(36).slice(2)}`;

          const name =
            normalizeStudentString(source.name) || `Student ${id.slice(-4)}`;

          const classNameCandidate =
            normalizeStudentString(source.class) ||
            normalizeStudentString(
              (source as { className?: unknown }).className,
            ) ||
            normalizeStudentString(
              (
                (source as { metadata?: { assignedClassName?: unknown } })
                  .metadata ?? {}
              ).assignedClassName,
            );
          const classIdCandidate =
            normalizeStudentString((source as { classId?: unknown }).classId) ||
            normalizeStudentString(
              (source as { class_id?: unknown }).class_id,
            ) ||
            normalizeStudentString(
              (
                (
                  source as {
                    metadata?: { classId?: unknown; class_id?: unknown };
                  }
                ).metadata ?? {}
              ).classId,
            ) ||
            normalizeStudentString(
              (
                (
                  source as {
                    metadata?: { classId?: unknown; class_id?: unknown };
                  }
                ).metadata ?? {}
              ).class_id,
            );

          const resolvedClassName =
            classNameCandidate || classIdCandidate || fallbackClassName;

          const candidateTokens = new Set<string>();
          const classNameToken = normalizeClassToken(classNameCandidate);
          const classIdToken = normalizeClassToken(classIdCandidate);

          if (classNameToken) {
            candidateTokens.add(classNameToken);
          }

          if (classIdToken) {
            candidateTokens.add(classIdToken);
          }

          if (tokenSet.size > 0) {
            if (candidateTokens.size === 0) {
              if (teacherHasAssignedClasses) {
                return null;
              }
            } else {
              let matchesToken = false;
              for (const token of candidateTokens) {
                if (token && tokenSet.has(token)) {
                  matchesToken = true;
                  break;
                }
              }

              if (!matchesToken) {
                return null;
              }
            }
          }

          const rawSubjects = (source as { subjects?: unknown }).subjects;
          const subjects = Array.isArray(rawSubjects)
            ? rawSubjects
                .filter(
                  (subject): subject is string =>
                    typeof subject === "string" && subject.trim().length > 0,
                )
                .map((subject) => subject.trim())
            : [];

          const status =
            normalizeStudentString((source as { status?: unknown }).status) ||
            "active";

          return {
            id,
            name,
            className: resolvedClassName || fallbackClassName || "",
            classId: classIdCandidate || null,
            subjects,
            status,
          };
        })
        .filter((student): student is TeacherScopedStudent => Boolean(student));
    },
    [teacherClasses, teacherClassTokenList, teacherHasAssignedClasses],
  );

  const cacheTeacherStudentRoster = useCallback(
    (records: TeacherScopedStudent[]) => {
      try {
        if (!Array.isArray(records) || records.length === 0) {
          safeStorage.removeItem(TEACHER_STUDENTS_CACHE_KEY);
          return;
        }

        safeStorage.setItem(
          TEACHER_STUDENTS_CACHE_KEY,
          JSON.stringify(records),
        );
      } catch (error) {
        logger.warn("Failed to cache teacher student roster", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [],
  );

  const readTeacherStudentCache = useCallback((): TeacherScopedStudent[] => {
    try {
      const raw = safeStorage.getItem(TEACHER_STUDENTS_CACHE_KEY);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw) as unknown;
      return normalizeTeacherStudentRecords(parsed);
    } catch (error) {
      logger.warn("Failed to read cached teacher student roster", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }, [normalizeTeacherStudentRecords]);

  const refreshTeacherStudents = useCallback(async (): Promise<
    TeacherScopedStudent[]
  > => {
    if (!teacherHasAssignedClasses) {
      setIsTeacherStudentsLoading(false);
      setTeacherStudents([]);
      setTeacherStudentsError(null);
      setTeacherStudentsMessage(
        "You are not assigned to any students. Contact your administrator.",
      );
      return [];
    }

    const token = safeStorage.getItem("vea_auth_token");
    if (!token) {
      setTeacherStudents([]);
      setTeacherStudentsError("Your session has expired. Please log in again.");
      setTeacherStudentsMessage(null);
      setIsTeacherStudentsLoading(false);
      return [];
    }

    setIsTeacherStudentsLoading(true);
    setTeacherStudentsError(null);

    try {
      const response = await fetch("/api/students", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 404) {
          const fallbackMessage =
            normalizeStudentString(
              (payload as { message?: unknown }).message,
            ) ||
            "Student records are not available right now. Please try again later.";
          const cachedStudents = readTeacherStudentCache();

          if (cachedStudents.length > 0) {
            logger.info("Student endpoint returned 404; using cached roster", {
              teacherId: teacher.id,
            });

            setTeacherStudents(cachedStudents);
            setTeacherStudentsError(null);
            setTeacherStudentsMessage(TEACHER_STUDENTS_CACHE_NOTICE);
            return cachedStudents;
          }

          logger.warn("Student endpoint returned 404 for teacher scope", {
            teacherId: teacher.id,
          });

          setTeacherStudents([]);
          setTeacherStudentsError(null);
          setTeacherStudentsMessage(fallbackMessage);
          return [];
        }

        const message =
          typeof (payload as { error?: unknown }).error === "string"
            ? (payload as { error?: string }).error
            : "Unable to load students";
        throw new Error(message);
      }

      const rawStudents = Array.isArray(
        (payload as { students?: unknown }).students,
      )
        ? ((payload as { students?: unknown[] }).students ?? [])
        : [];
      const normalizedRecords = normalizeTeacherStudentRecords(rawStudents);
      setTeacherStudents(normalizedRecords);
      cacheTeacherStudentRoster(normalizedRecords);

      const responseMessage = normalizeStudentString(
        (payload as { message?: unknown }).message,
      );
      if (responseMessage) {
        setTeacherStudentsMessage(responseMessage);
      } else if (normalizedRecords.length === 0) {
        setTeacherStudentsMessage(
          "No students found for your assigned classes yet.",
        );
      } else {
        setTeacherStudentsMessage(null);
      }

      return normalizedRecords;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load students";
      logger.error("Failed to load teacher students", {
        error: message,
        teacherId: teacher.id,
      });
      const cachedStudents = readTeacherStudentCache();

      if (cachedStudents.length > 0) {
        setTeacherStudents(cachedStudents);
        setTeacherStudentsError(null);
        setTeacherStudentsMessage(TEACHER_STUDENTS_CACHE_NOTICE);
        return cachedStudents;
      }

      setTeacherStudentsError(message);
      setTeacherStudents([]);
      return [];
    } finally {
      setIsTeacherStudentsLoading(false);
    }
  }, [
    cacheTeacherStudentRoster,
    normalizeTeacherStudentRecords,
    readTeacherStudentCache,
    teacher.id,
    teacherHasAssignedClasses,
    teacherClassTokenKey,
  ]);

  const [teacherExams, setTeacherExams] = useState<TeacherExamSummary[]>([]);
  const [isExamLoading, setIsExamLoading] = useState(true);
  const [teacherTimetable, setTeacherTimetable] = useState<
    TeacherTimetableSlot[]
  >([]);
  const [isTeacherTimetableLoading, setIsTeacherTimetableLoading] =
    useState(true);
  const [isSyncingGrades, setIsSyncingGrades] = useState(false);
  const [cumulativeSummaries, setCumulativeSummaries] = useState<
    Record<string, ReportCardCumulativeSummary>
  >({});
  const [isGeneratingCumulative, setIsGeneratingCumulative] = useState(false);
  const [isAddStudentDialogOpen, setIsAddStudentDialogOpen] = useState(false);
  const [isRosterLoading, setIsRosterLoading] = useState(false);
  const [rosterCandidates, setRosterCandidates] = useState<
    AssignmentStudentInfo[]
  >([]);
  const [selectedRosterId, setSelectedRosterId] = useState<string | null>(null);
  const [rosterNotice, setRosterNotice] = useState<string | null>(null);

  const normalizedTermLabel = useMemo(
    () => mapTermKeyToLabel(selectedTerm),
    [selectedTerm],
  );

  const subjectSummary =
    teacherSubjects.length > 0
      ? teacherSubjects.join(", ")
      : "No subjects assigned yet";
  const classSummary =
    teacherClassNames.length > 0
      ? teacherClassNames.join(", ")
      : "No classes assigned yet";
  const studentSummary = isTeacherStudentsLoading
    ? "Loading students..."
    : teacherStudents.length > 0
      ? `${teacherStudents.length} assigned ${teacherStudents.length === 1 ? "student" : "students"}`
      : (teacherStudentsMessage ?? "No students assigned yet");
  const examSummary = isExamLoading
    ? "Loading exams..."
    : teacherExams.length > 0
      ? `${teacherExams.length} scheduled ${teacherExams.length === 1 ? "exam" : "exams"}`
      : "No exams scheduled yet";

  const handleSelectClass = useCallback(
    (value: string) => {
      if (value === "__no_classes__") {
        setSelectedClass("");
        setSelectedClassId("");
        setSelectedSubject("");
        setMarksData((prev) => (prev.length > 0 ? [] : prev));
        return;
      }

      if (value !== selectedClass) {
        setSelectedSubject("");
        setMarksData((prev) => (prev.length > 0 ? [] : prev));
      }

      setSelectedClass(value);

      const normalizedValue = normalizeClassName(value);
      const match = teacherClasses.find((cls) => {
        const normalizedName = normalizeClassName(cls.name);
        return normalizedName === normalizedValue || cls.id === value;
      });

      setSelectedClassId(match?.id ?? "");
    },
    [normalizeClassName, selectedClass, teacherClasses],
  );

  const normalizedTeacherSubjects = useMemo(
    () =>
      Array.from(
        new Set(
          teacherSubjects
            .map((subject) =>
              typeof subject === "string" ? subject.trim() : "",
            )
            .filter((subject) => subject.length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
    [teacherSubjects],
  );

  const teacherSubjectOptions = useMemo(
    () => buildTeacherSubjectOptions(teacherClasses, normalizedTeacherSubjects),
    [teacherClasses, normalizedTeacherSubjects],
  );

  const subjectOptionByKey = useMemo(() => {
    const map = new Map<string, TeacherSubjectOption>();
    teacherSubjectOptions.forEach((option) => {
      map.set(option.key, option);
    });
    return map;
  }, [teacherSubjectOptions]);

  const buildClassTeacherRemarkSummary = useCallback(
    (
      entries:
        | Array<{ subjectKey: string; remark: ClassTeacherRemarkValue }>
        | undefined,
    ) => {
      if (!entries || entries.length === 0) {
        return "";
      }

      const formatted = entries
        .map(({ subjectKey, remark }) => {
          const subjectOption = subjectOptionByKey.get(subjectKey);
          const label =
            subjectOption?.subject ??
            (subjectKey === "general" ? "General" : subjectKey);
          const displayRemark = mapClassTeacherRemarkToSubjectRemark(remark);

          if (!label || !displayRemark) {
            return null;
          }

          return `${label}: ${displayRemark}`;
        })
        .filter((entry): entry is string => Boolean(entry));

      return formatted.join(" • ");
    },
    [subjectOptionByKey],
  );

  const getStudentRemarkEntries = useCallback(
    (studentId: string) => {
      if (!studentId) {
        return [] as Array<{
          key: string;
          subjectKey: string;
          remark: ClassTeacherRemarkValue;
        }>;
      }

      return Object.entries(additionalData.classTeacherRemarks)
        .map(([compositeKey, entry]) => {
          if (!entry || typeof entry !== "object" || !entry.remark) {
            return null;
          }

          const { subjectKey, studentId: entryStudentId } =
            parseRemarkKey(compositeKey);
          if (!subjectKey || entryStudentId !== studentId) {
            return null;
          }

          return { key: compositeKey, subjectKey, remark: entry.remark };
        })
        .filter(
          (
            entry,
          ): entry is {
            key: string;
            subjectKey: string;
            remark: ClassTeacherRemarkValue;
          } => entry !== null,
        );
    },
    [additionalData.classTeacherRemarks],
  );

  const availableSubjectOptions = useMemo(() => {
    if (teacherSubjectOptions.length === 0) {
      return [] as TeacherSubjectOption[];
    }

    const normalizedIdToken = normalizeClassToken(selectedClassId);
    const normalizedNameToken = normalizeClassName(selectedClass);

    const resolvedOptions = (!normalizedIdToken && !normalizedNameToken)
      ? teacherSubjectOptions
      : teacherSubjectOptions.filter((option) => {
          const optionIdToken = normalizeClassToken(option.classId);
          const optionNameToken = normalizeClassName(option.className);

          if (
            normalizedIdToken &&
            optionIdToken &&
            optionIdToken === normalizedIdToken
          ) {
            return true;
          }

          if (
            normalizedNameToken &&
            optionNameToken &&
            optionNameToken === normalizedNameToken
          ) {
            return true;
          }

          if (!optionIdToken && !optionNameToken) {
            return true;
          }

          return false;
        });

    if (resolvedOptions.length === 0) {
      return [] as TeacherSubjectOption[];
    }

    const deduped: TeacherSubjectOption[] = [];
    const seenGeneralSubjects = new Set<string>();

    resolvedOptions.forEach((option) => {
      if (isClassTeacherGeneralRemarkSubject(option.subject)) {
        const key = option.subject.trim().toLowerCase();
        if (seenGeneralSubjects.has(key)) {
          return;
        }

        seenGeneralSubjects.add(key);
      }

      deduped.push(option);
    });

    return deduped;
  }, [
    normalizeClassName,
    selectedClass,
    selectedClassId,
    teacherSubjectOptions,
  ]);

  const availableSubjects = useMemo(
    () => availableSubjectOptions.map((option) => option.subject),
    [availableSubjectOptions],
  );

  const selectedSubjectOption = selectedSubjectKey
    ? (subjectOptionByKey.get(selectedSubjectKey) ?? null)
    : null;
  const selectedSubjectHasClassAssignment = Boolean(
    selectedSubjectOption &&
      ((selectedSubjectOption.classId &&
        selectedSubjectOption.classId.trim().length > 0) ||
        (selectedSubjectOption.className &&
          selectedSubjectOption.className.trim().length > 0)),
  );
  const hasRemarkSubjects = availableSubjectOptions.length > 0;
  const remarkStudentOptions = useMemo(() => {
    if (!selectedSubjectKey) {
      return [] as RemarkStudentOption[];
    }

    const subjectOption = subjectOptionByKey.get(selectedSubjectKey) ?? null;
    if (subjectOption && !selectedSubjectHasClassAssignment) {
      return [] as RemarkStudentOption[];
    }
    const classTokens = new Set<string>();

    const registerClassToken = (value: string | null | undefined) => {
      if (!value || typeof value !== "string") {
        return;
      }

      const trimmed = value.trim();
      if (!trimmed) {
        return;
      }

      classTokens.add(trimmed.toLowerCase());

      const normalizedIdToken = normalizeClassToken(trimmed);
      if (normalizedIdToken) {
        classTokens.add(normalizedIdToken);
      }

      const normalizedNameToken = normalizeClassName(trimmed);
      if (normalizedNameToken) {
        classTokens.add(normalizedNameToken);
      }
    };

    if (subjectOption) {
      registerClassToken(subjectOption.classId);
      registerClassToken(subjectOption.className);
    }

    const shouldMatchClassTokens = classTokens.size > 0;
    const entries = new Map<string, RemarkStudentOption>();

    const registerStudent = (candidate: {
      studentId: string | null | undefined;
      studentName: string | null | undefined;
      classId?: string | null;
      className?: string | null;
    }) => {
      const rawId =
        typeof candidate.studentId === "string"
          ? candidate.studentId.trim()
          : candidate.studentId
            ? String(candidate.studentId).trim()
            : "";

      if (!rawId) {
        return;
      }

      const sanitizedName =
        typeof candidate.studentName === "string" &&
        candidate.studentName.trim().length > 0
          ? candidate.studentName.trim()
          : "";
      const sanitizedClassId =
        typeof candidate.classId === "string" &&
        candidate.classId.trim().length > 0
          ? candidate.classId.trim()
          : null;
      const sanitizedClassName =
        typeof candidate.className === "string" &&
        candidate.className.trim().length > 0
          ? candidate.className.trim()
          : null;

      const existing = entries.get(rawId);
      const nextName = sanitizedName || existing?.studentName || rawId;
      const nextClassId = sanitizedClassId ?? existing?.classId ?? null;
      const nextClassName = sanitizedClassName ?? existing?.className ?? null;

      entries.set(rawId, {
        studentId: rawId,
        studentName: nextName,
        classId: nextClassId,
        className: nextClassName,
      });
    };

    const matchesSubjectClass = (
      classId: string | null,
      className: string | null,
    ) => {
      if (!shouldMatchClassTokens) {
        return true;
      }

      const tokens = new Set<string>();
      const collectTokens = (value: string | null | undefined) => {
        if (!value || typeof value !== "string") {
          return;
        }

        const trimmed = value.trim();
        if (!trimmed) {
          return;
        }

        tokens.add(trimmed.toLowerCase());

        const normalizedIdToken = normalizeClassToken(trimmed);
        if (normalizedIdToken) {
          tokens.add(normalizedIdToken);
        }

        const normalizedNameToken = normalizeClassName(trimmed);
        if (normalizedNameToken) {
          tokens.add(normalizedNameToken);
        }
      };

      collectTokens(classId);
      collectTokens(className);

      if (tokens.size === 0) {
        return false;
      }

      return Array.from(tokens).some(
        (token) => token && classTokens.has(token),
      );
    };

    teacherStudents.forEach((student) => {
      if (matchesSubjectClass(student.classId, student.className)) {
        registerStudent({
          studentId: student.id,
          studentName: student.name,
          classId: student.classId,
          className: student.className,
        });
      }
    });

    marksData.forEach((record) => {
      registerStudent({
        studentId: record.studentId,
        studentName: record.studentName,
        classId: subjectOption?.classId ?? null,
        className: subjectOption?.className ?? null,
      });
    });

    return Array.from(entries.values()).sort((left, right) =>
      left.studentName.localeCompare(right.studentName, undefined, {
        sensitivity: "base",
      }),
    );
  }, [
    marksData,
    normalizeClassName,
    normalizeClassToken,
    selectedSubjectHasClassAssignment,
    selectedSubjectKey,
    subjectOptionByKey,
    teacherStudents,
  ]);

  const remarkStudentOptionById = useMemo(() => {
    const map = new Map<string, RemarkStudentOption>();
    remarkStudentOptions.forEach((student) => {
      map.set(student.studentId, student);
    });
    return map;
  }, [remarkStudentOptions]);

  useEffect(() => {
    if (remarkStudentOptions.length === 0) {
      if (selectedRemarkStudentId) {
        setSelectedRemarkStudentId("");
      }
      return;
    }

    if (
      !selectedRemarkStudentId ||
      !remarkStudentOptions.some(
        (student) => student.studentId === selectedRemarkStudentId,
      )
    ) {
      setSelectedRemarkStudentId(remarkStudentOptions[0].studentId);
    }
  }, [remarkStudentOptions, selectedRemarkStudentId]);

  const selectedRemarkStudent = useMemo(
    () =>
      selectedRemarkStudentId
        ? (remarkStudentOptionById.get(selectedRemarkStudentId) ?? null)
        : null,
    [remarkStudentOptionById, selectedRemarkStudentId],
  );

  const selectedRemarkKey =
    selectedRemarkStudent && selectedSubjectKey
      ? buildRemarkKey(selectedSubjectKey, selectedRemarkStudent.studentId)
      : "";
  const selectedRemarkEntry = selectedRemarkKey
    ? additionalData.classTeacherRemarks[selectedRemarkKey]
    : undefined;
  const selectedRemarkValue: ClassTeacherRemarkValue | "" =
    selectedRemarkEntry?.remark ?? "";
  const currentRemarkOption = selectedRemarkValue
    ? (CLASS_TEACHER_REMARK_OPTION_MAP[selectedRemarkValue] ?? null)
    : null;

  const isStudentSelectDisabledForRemarks =
    !selectedSubjectKey || !selectedSubjectHasClassAssignment;
  const hasRemarkStudentsForSelection = remarkStudentOptions.length > 0;
  const studentSelectPlaceholder = !selectedSubjectKey
    ? "Select a subject first"
    : !selectedSubjectHasClassAssignment
      ? "Subject has no class"
      : hasRemarkStudentsForSelection
        ? "Select student"
        : "No students available";
  const studentDropdownStatusMessage = !selectedSubjectKey
    ? null
    : !selectedSubjectHasClassAssignment
      ? "This subject is not assigned to a class."
      : hasRemarkStudentsForSelection
        ? "Remarks are saved per student and subject."
        : "No students found for the selected subject's class.";

  const hasAvailableSubjects = availableSubjectOptions.length > 0;
  const hasCachedSubjectOptions =
    hasAvailableSubjects ||
    (Array.isArray(cachedAssignmentStateRef.current.subjects) &&
      cachedAssignmentStateRef.current.subjects.length > 0);
  const shouldDisableSubjectSelectDueToSubjects =
    hasCompletedSubjectFetch &&
    !isTeacherSubjectsLoading &&
    availableSubjectOptions.length === 0 &&
    !hasCachedSubjectOptions;
  const isSubjectSelectDisabled = shouldDisableSubjectSelectDueToSubjects;
  const subjectSelectPlaceholder = isTeacherSubjectsLoading
    ? "Loading subjects..."
    : hasCompletedSubjectFetch && availableSubjectOptions.length === 0
      ? "No subjects assigned"
      : "Select subject";

  const addStudentDialogOption = addStudentDialogSubjectKey
    ? (subjectOptionByKey.get(addStudentDialogSubjectKey) ?? null)
    : null;

  const handleSelectSubject = useCallback(
    (value: string) => {
      const option = subjectOptionByKey.get(value);

      if (!option) {
        setSelectedSubjectKey("");
        setSelectedSubject("");
        return;
      }

      if (value === selectedSubjectKey) {
        if (option.classId && option.classId !== selectedClassId) {
          setSelectedClassId(option.classId);
        }
        if (option.className && option.className !== selectedClass) {
          setSelectedClass(option.className);
        }
        return;
      }

      setMarksData([]);
      setSelectedSubjectKey(value);
      setSelectedSubject(option.subject);

      if (option.classId && option.classId !== selectedClassId) {
        setSelectedClassId(option.classId);
      }
      if (option.className && option.className !== selectedClass) {
        setSelectedClass(option.className);
      }
    },
    [
      selectedClass,
      selectedClassId,
      selectedSubjectKey,
      setMarksData,
      subjectOptionByKey,
    ],
  );

  const handleSubjectSwitch = useCallback(
    (value: string) => {
      setIsSubjectSwitcherOpen(false);
      handleSelectSubject(value);
    },
    [handleSelectSubject],
  );

  useEffect(() => {
    if (!selectedSubjectKey) {
      return;
    }

    const subjectOption = subjectOptionByKey.get(selectedSubjectKey);
    if (!subjectOption) {
      return;
    }

    const resolvedClassId = subjectOption.classId?.trim() ?? "";
    const resolvedClassName = subjectOption.className?.trim() ?? "";

    if (resolvedClassId !== selectedClassId) {
      setSelectedClassId(resolvedClassId);
    }

    if (resolvedClassName && resolvedClassName !== selectedClass) {
      setSelectedClass(resolvedClassName);
    } else if (!resolvedClassName && selectedClass) {
      setSelectedClass("");
    }
  }, [selectedClass, selectedClassId, selectedSubjectKey, subjectOptionByKey]);

  useEffect(() => {
    if (teacherClasses.length === 0) {
      if (selectedClass || selectedClassId) {
        setSelectedClass("");
        setSelectedClassId("");
      }
      return;
    }

    const normalizedCurrent = normalizeClassName(selectedClass);
    const matchById = teacherClasses.find((cls) => cls.id === selectedClassId);
    const matchByName = teacherClasses.find(
      (cls) => normalizeClassName(cls.name) === normalizedCurrent,
    );
    const resolved = matchById ?? matchByName ?? teacherClasses[0] ?? null;

    if (!resolved) {
      return;
    }

    if (selectedClass !== resolved.name) {
      setSelectedClass(resolved.name);
    }

    if (selectedClassId !== (resolved.id ?? "")) {
      setSelectedClassId(resolved.id ?? "");
    }
  }, [normalizeClassName, selectedClass, selectedClassId, teacherClasses]);

  useEffect(() => {
    if (selectedSubject.trim().length === 0) {
      setMarksData((prev) => (prev.length > 0 ? [] : prev));
    }
  }, [selectedSubject]);

  useEffect(() => {
    if (availableSubjectOptions.length === 0) {
      if (selectedSubjectKey) {
        setSelectedSubjectKey("");
      }
      if (selectedSubject) {
        setSelectedSubject("");
      }
      return;
    }

    const optionKeys = new Set(
      availableSubjectOptions.map((option) => option.key),
    );

    if (selectedSubjectKey && optionKeys.has(selectedSubjectKey)) {
      const currentOption = subjectOptionByKey.get(selectedSubjectKey);
      if (currentOption) {
        if (selectedSubject !== currentOption.subject) {
          setSelectedSubject(currentOption.subject);
        }
        if (
          currentOption.classId &&
          currentOption.classId !== selectedClassId
        ) {
          setSelectedClassId(currentOption.classId);
        }
        if (
          currentOption.className &&
          currentOption.className !== selectedClass
        ) {
          setSelectedClass(currentOption.className);
        }
      }
      return;
    }

    const fallback = availableSubjectOptions[0];
    setSelectedSubjectKey(fallback.key);
    setSelectedSubject(fallback.subject);
    if (fallback.classId && fallback.classId !== selectedClassId) {
      setSelectedClassId(fallback.classId);
    }
    if (fallback.className && fallback.className !== selectedClass) {
      setSelectedClass(fallback.className);
    }
  }, [
    availableSubjectOptions,
    selectedClass,
    selectedClassId,
    selectedSubject,
    selectedSubjectKey,
    subjectOptionByKey,
  ]);

  useEffect(() => {
    setAssignmentForm((prev) => {
      const normalizedSelection = normalizeClassName(selectedClass);
      const defaultClass =
        teacherClasses.find((cls) => cls.id === selectedClassId) ??
        teacherClasses.find(
          (cls) => normalizeClassName(cls.name) === normalizedSelection,
        );
      const fallbackClass = defaultClass ?? teacherClasses[0] ?? null;
      const normalizedPrevSubject =
        typeof prev.subject === "string"
          ? prev.subject.trim().toLowerCase()
          : "";
      const normalizedOptions = availableSubjectOptions.map((option) =>
        option.subject.trim().toLowerCase(),
      );
      const nextSubjectOption = availableSubjectOptions[0] ?? null;
      const nextSubject =
        normalizedPrevSubject &&
        normalizedOptions.includes(normalizedPrevSubject)
          ? prev.subject
          : (nextSubjectOption?.subject ?? "");

      return {
        ...prev,
        subject: nextSubject,
        classId:
          prev.classId ||
          nextSubjectOption?.classId ||
          (fallbackClass?.id ?? ""),
        className:
          prev.className ||
          nextSubjectOption?.className ||
          (fallbackClass?.name ?? ""),
      };
    });
  }, [
    availableSubjectOptions,
    normalizeClassName,
    selectedClass,
    selectedClassId,
    teacherClasses,
  ]);

  const formatExamDate = (value: string) => {
    try {
      return new Intl.DateTimeFormat("en-NG", {
        day: "numeric",
        month: "short",
      }).format(new Date(value));
    } catch (error) {
      return value;
    }
  };

  useEffect(() => {
    if (!teacherHasAssignedClasses) {
      setTeacherStudents([]);
      setTeacherStudentsError(null);
      setTeacherStudentsMessage(
        "You are not assigned to any students. Contact your administrator.",
      );
      return;
    }

    setTeacherStudentsMessage(null);
    void refreshTeacherStudents();
  }, [refreshTeacherStudents, teacherHasAssignedClasses]);

  useEffect(() => {
    if (selectedTab === "students") {
      void refreshTeacherStudents();
    }
  }, [refreshTeacherStudents, selectedTab]);

  useEffect(() => {
    const handleStudentsRefreshed = (payload?: unknown) => {
      if (!teacherHasAssignedClasses) {
        return;
      }

      if (Array.isArray(payload)) {
        const normalized = normalizeTeacherStudentRecords(payload);
        setTeacherStudents(normalized);
        setTeacherStudentsError(null);
        if (normalized.length === 0) {
          setTeacherStudentsMessage(
            "No students found for your assigned classes yet.",
          );
        } else {
          setTeacherStudentsMessage(null);
        }
        return;
      }

      void refreshTeacherStudents();
    };

    dbManager.on("studentsRefreshed", handleStudentsRefreshed);
    return () => {
      dbManager.off("studentsRefreshed", handleStudentsRefreshed);
    };
  }, [
    normalizeTeacherStudentRecords,
    refreshTeacherStudents,
    teacherHasAssignedClasses,
  ]);

  const buildInitialGradingDrafts = (
    submissions: AssignmentSubmissionRecord[],
  ) =>
    submissions.reduce(
      (acc, submission) => {
        acc[submission.id] = {
          score:
            typeof submission.score === "number"
              ? String(submission.score)
              : "",
          comment: submission.comment ?? "",
        };
        return acc;
      },
      {} as Record<string, { score: string; comment: string }>,
    );

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("Unable to read file"));
      reader.readAsDataURL(file);
    });

  const normaliseAssignmentRecord = useCallback(
    (record: RawAssignmentRecord): TeacherAssignmentSummary => {
      const submissions = Array.isArray(record.submissions)
        ? record.submissions
        : [];
      const assignedStudentIds = Array.isArray(record.assignedStudentIds)
        ? record.assignedStudentIds
        : [];

      const normalisedSubmissions: AssignmentSubmissionRecord[] =
        submissions.map((submission) => ({
          id: submission.id,
          studentId: submission.studentId,
          status: submission.status,
          submittedAt: submission.submittedAt ?? null,
          files: Array.isArray(submission.files)
            ? submission.files.map((file) => ({
                id:
                  typeof file.id === "string"
                    ? file.id
                    : `${submission.id}_${Math.random().toString(36).slice(2)}`,
                name:
                  typeof file.name === "string"
                    ? file.name
                    : "Submission attachment",
                url:
                  typeof (file as { url?: unknown }).url === "string"
                    ? (file as { url?: string }).url
                    : null,
              }))
            : [],
          comment: submission.comment ?? null,
          grade: submission.grade ?? null,
          score: typeof submission.score === "number" ? submission.score : null,
        }));

      return {
        id: String(record.id),
        title: record.title,
        description: record.description ?? "",
        subject: record.subject,
        className:
          record.className ?? (record as { class?: string }).class ?? "General",
        classId: record.classId ?? null,
        dueDate: record.dueDate,
        status: (record.status ?? "draft") as TeacherAssignmentStatus,
        maximumScore:
          typeof (record as { maximumScore?: unknown }).maximumScore ===
          "number"
            ? ((record as { maximumScore?: number }).maximumScore as number)
            : (record as { maximumScore?: string | number | null }).maximumScore
              ? Number(
                  (record as { maximumScore?: string | number | null })
                    .maximumScore,
                )
              : null,
        submissions: normalisedSubmissions,
        assignedStudentIds,
        resourceName: record.resourceName ?? null,
        resourceType: record.resourceType ?? null,
        resourceUrl: record.resourceUrl ?? null,
        resourceSize:
          typeof record.resourceSize === "number"
            ? record.resourceSize
            : record.resourceSize
              ? Number(record.resourceSize)
              : null,
        createdAt:
          "createdAt" in record
            ? ((record as { createdAt?: string | null }).createdAt ?? null)
            : null,
        updatedAt: record.updatedAt,
      };
    },
    [],
  );

  const resolveAssignmentRoster = useCallback(
    async (assignment: TeacherAssignmentSummary) => {
      const roster = new Map<string, AssignmentStudentInfo>();

      const addStudent = (student: AssignmentStudentInfo) => {
        if (!student.id) {
          return;
        }

        const existing = roster.get(student.id);
        roster.set(student.id, {
          id: student.id,
          name: student.name ?? existing?.name ?? null,
          className:
            student.className ??
            existing?.className ??
            assignment.className ??
            null,
        });
      };

      const assignedIds = new Set(
        assignment.assignedStudentIds
          .filter((id) => typeof id === "string" && id.trim().length > 0)
          .map((id) => id.trim()),
      );

      const classLabel = assignment.className ?? assignment.classId ?? "";

      if (classLabel) {
        try {
          const students = await dbManager.getStudentsByClass(classLabel);
          students.forEach((student: any) => {
            const id =
              typeof student?.id === "string"
                ? student.id
                : String(student?.id ?? "");
            if (!id) {
              return;
            }

            if (assignedIds.size === 0 || assignedIds.has(id)) {
              addStudent({
                id,
                name:
                  typeof student?.name === "string"
                    ? student.name
                    : typeof student?.fullName === "string"
                      ? student.fullName
                      : null,
                className:
                  typeof student?.class === "string"
                    ? student.class
                    : typeof student?.className === "string"
                      ? student.className
                      : (assignment.className ?? null),
              });
            }
          });
        } catch (error) {
          logger.error("Unable to load class roster for assignment", { error });
        }
      }

      if (assignedIds.size > 0) {
        const missingAssigned = Array.from(assignedIds).filter(
          (id) => !roster.has(id),
        );
        if (missingAssigned.length > 0) {
          try {
            const users = await dbManager.getAllUsers();
            missingAssigned.forEach((studentId) => {
              const match = users.find((user: any) => {
                const candidateId =
                  typeof user?.id === "string"
                    ? user.id
                    : String(user?.id ?? "");
                return candidateId.trim() === studentId;
              });

              if (match) {
                addStudent({
                  id: studentId,
                  name:
                    typeof match?.name === "string"
                      ? match.name
                      : typeof match?.fullName === "string"
                        ? match.fullName
                        : null,
                  className:
                    typeof match?.className === "string"
                      ? match.className
                      : typeof match?.class === "string"
                        ? match.class
                        : (assignment.className ?? null),
                });
              }
            });
          } catch (error) {
            logger.error("Unable to resolve assigned students for roster", {
              error,
            });
          }
        }
      }

      if (roster.size === 0 && teacherStudents.length > 0) {
        const normalizedLabelTokens = new Set<string>();
        const normalizedLabelName = normalizeClassName(classLabel);
        const normalizedLabelDisplay = normalizeClassToken(classLabel);

        if (normalizedLabelName) {
          normalizedLabelTokens.add(normalizedLabelName);
        }
        if (normalizedLabelDisplay) {
          normalizedLabelTokens.add(normalizedLabelDisplay);
        }
        if (classLabel) {
          normalizedLabelTokens.add(classLabel.trim().toLowerCase());
        }

        teacherStudents
          .filter((student) => {
            if (normalizedLabelTokens.size === 0) {
              return true;
            }

            const studentTokens = new Set<string>();
            if (student.className) {
              studentTokens.add(normalizeClassName(student.className));
              studentTokens.add(normalizeClassToken(student.className));
              studentTokens.add(student.className.trim().toLowerCase());
            }
            if (student.classId) {
              studentTokens.add(normalizeClassToken(student.classId));
              studentTokens.add(student.classId.trim().toLowerCase());
            }

            return Array.from(studentTokens).some(
              (token) => token && normalizedLabelTokens.has(token),
            );
          })
          .forEach((student) => {
            if (assignedIds.size === 0 || assignedIds.has(student.id)) {
              addStudent({
                id: student.id,
                name: student.name,
                className: student.className ?? assignment.className ?? null,
              });
            }
          });
      }

      assignment.submissions.forEach((submission) => {
        if (!roster.has(submission.studentId)) {
          addStudent({
            id: submission.studentId,
            name: null,
            className: assignment.className ?? null,
          });
        }
      });

      return Object.fromEntries(roster.entries());
    },
    [normalizeClassName, teacherStudents],
  );

  const combinedSubmissionRecords = useMemo(() => {
    if (!selectedAssignment) {
      return [] as Array<{
        student: AssignmentStudentInfo;
        submission: AssignmentSubmissionRecord;
      }>;
    }

    const submissionMap = new Map(
      selectedAssignment.submissions.map(
        (submission) => [submission.studentId, submission] as const,
      ),
    );

    const combined = new Map<
      string,
      { student: AssignmentStudentInfo; submission: AssignmentSubmissionRecord }
    >();
    const createPlaceholder = (
      studentId: string,
    ): AssignmentSubmissionRecord => ({
      id: `pending-${studentId}`,
      studentId,
      status: "pending",
      submittedAt: null,
      files: [],
      comment: null,
      grade: null,
      score: null,
    });

    Object.values(assignmentRoster).forEach((student) => {
      const submission =
        submissionMap.get(student.id) ?? createPlaceholder(student.id);
      combined.set(student.id, { student, submission });
    });

    selectedAssignment.submissions.forEach((submission) => {
      const current = combined.get(submission.studentId);
      if (current) {
        combined.set(submission.studentId, {
          student: current.student,
          submission,
        });
      } else {
        combined.set(submission.studentId, {
          student: {
            id: submission.studentId,
            name: null,
            className: selectedAssignment.className ?? null,
          },
          submission,
        });
      }
    });

    return Array.from(combined.values()).sort((a, b) => {
      const nameA = a.student.name ?? a.student.id;
      const nameB = b.student.name ?? b.student.id;
      return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
    });
  }, [assignmentRoster, selectedAssignment]);

  const pendingSubmissionRecords = useMemo(
    () =>
      combinedSubmissionRecords.filter(
        (entry) => entry.submission.status === "pending",
      ),
    [combinedSubmissionRecords],
  );

  const receivedSubmissionRecords = useMemo(
    () =>
      combinedSubmissionRecords.filter(
        (entry) => entry.submission.status !== "pending",
      ),
    [combinedSubmissionRecords],
  );

  const gradedSubmissionCount = useMemo(
    () =>
      receivedSubmissionRecords.filter(
        (entry) => entry.submission.status === "graded",
      ).length,
    [receivedSubmissionRecords],
  );

  const loadAssignments = useCallback(async () => {
    try {
      setIsAssignmentsLoading(true);
      const records = await dbManager.getAssignments({ teacherId: teacher.id });

      const normalised = records.map((record) =>
        normaliseAssignmentRecord(record),
      );

      setAssignments(normalised);
    } catch (error) {
      logger.error("Failed to load teacher assignments", { error });
      toast({
        variant: "destructive",
        title: "Unable to load assignments",
        description:
          "We could not retrieve your assignments. Please try again shortly.",
      });
    } finally {
      setIsAssignmentsLoading(false);
    }
  }, [normaliseAssignmentRecord, teacher.id, toast]);

  useEffect(() => {
    void loadAssignments();

    const handleAssignmentsUpdate = () => {
      void loadAssignments();
    };

    dbManager.on("assignmentsUpdate", handleAssignmentsUpdate);

    return () => {
      dbManager.off("assignmentsUpdate", handleAssignmentsUpdate);
    };
  }, [loadAssignments]);

  const loadExams = useCallback(async () => {
    try {
      if (isComponentMountedRef.current) {
        setIsExamLoading(true);
      }
      const schedules = await dbManager.getExamSchedules();

      if (!isComponentMountedRef.current) {
        return;
      }

      const normalizedClasses = new Set(
        teacherClassNames.map((cls) => normalizeClassName(cls)),
      );
      const relevantExams = schedules.filter((exam) =>
        normalizedClasses.has(normalizeClassName(exam.className)),
      );

      setTeacherExams(relevantExams);
    } catch (error) {
      logger.error("Failed to load teacher exams", { error });
    } finally {
      if (isComponentMountedRef.current) {
        setIsExamLoading(false);
      }
    }
  }, [normalizeClassName, teacherClassNames]);

  useEffect(() => {
    void loadExams();

    const handleExamUpdate = () => {
      void loadExams();
    };

    dbManager.on("examScheduleUpdated", handleExamUpdate);
    dbManager.on("examResultsUpdated", handleExamUpdate);

    return () => {
      dbManager.off("examScheduleUpdated", handleExamUpdate);
      dbManager.off("examResultsUpdated", handleExamUpdate);
    };
  }, [loadExams]);

  const loadTimetable = useCallback(async () => {
    if (!selectedClass) {
      if (isComponentMountedRef.current) {
        setTeacherTimetable([]);
        setIsTeacherTimetableLoading(false);
      }
      return;
    }

    try {
      if (isComponentMountedRef.current) {
        setIsTeacherTimetableLoading(true);
      }
      const slots = await dbManager.getTimetable(selectedClass);

      if (!isComponentMountedRef.current) {
        return;
      }

      const normalized = normalizeTimetableCollection(slots).map(
        ({ id, day, time, subject, teacher, location }) => ({
          id,
          day,
          time,
          subject,
          teacher,
          location,
        }),
      );
      setTeacherTimetable(normalized);
    } catch (error) {
      logger.error("Failed to load teacher timetable", { error });
      if (isComponentMountedRef.current) {
        setTeacherTimetable([]);
      }
    } finally {
      if (isComponentMountedRef.current) {
        setIsTeacherTimetableLoading(false);
      }
    }
  }, [selectedClass]);

  useEffect(() => {
    void loadTimetable();

    const handleTimetableUpdate = (
      payload: { className?: string } | undefined,
    ) => {
      if (!selectedClass) {
        return;
      }

      const updatedClassName =
        typeof payload?.className === "string"
          ? payload.className
          : selectedClass;

      if (
        normalizeClassName(updatedClassName) ===
        normalizeClassName(selectedClass)
      ) {
        void loadTimetable();
      }
    };

    dbManager.on("timetableUpdated", handleTimetableUpdate);

    return () => {
      dbManager.off("timetableUpdated", handleTimetableUpdate);
    };
  }, [loadTimetable, normalizeClassName, selectedClass]);

  const lastPersistedSelectionRef = useRef<string | null>(null);
  const suppressMarksRefreshRef = useRef(false);

  const loadRosterCandidates = useCallback(async () => {
    if (!selectedClass && !selectedClassId) {
      setRosterCandidates([]);
      setSelectedRosterId(null);
      setRosterNotice("Select a class to load the roster.");
      return;
    }

    setIsRosterLoading(true);
    setRosterNotice(null);

    const existingIds = new Set(
      marksData.map((student) => String(student.studentId)),
    );
    const candidateMap = new Map<string, AssignmentStudentInfo>();

    const selectedTokens = new Set<string>();
    const normalizedSelectedName = selectedClass
      ? normalizeClassName(selectedClass)
      : "";
    const normalizedSelectedDisplay = selectedClass
      ? normalizeClassToken(selectedClass)
      : "";
    const normalizedSelectedId = selectedClassId
      ? normalizeClassToken(selectedClassId)
      : "";

    if (normalizedSelectedName) {
      selectedTokens.add(normalizedSelectedName);
    }
    if (normalizedSelectedDisplay) {
      selectedTokens.add(normalizedSelectedDisplay);
    }
    if (normalizedSelectedId) {
      selectedTokens.add(normalizedSelectedId);
    }
    if (selectedClass) {
      selectedTokens.add(selectedClass.trim().toLowerCase());
    }
    if (selectedClassId) {
      selectedTokens.add(selectedClassId.trim().toLowerCase());
    }

    const registerCandidates = (records: TeacherScopedStudent[]) => {
      records.forEach((student) => {
        const normalizedId = normalizeStudentString(student.id);
        if (
          !normalizedId ||
          existingIds.has(normalizedId) ||
          candidateMap.has(normalizedId)
        ) {
          return;
        }

        const candidateClassName = student.className || selectedClass || "";
        const candidateClassId = student.classId || null;

        const candidateTokens = new Set<string>();
        const normalizedCandidateName = candidateClassName
          ? normalizeClassName(candidateClassName)
          : "";
        const normalizedCandidateDisplay = candidateClassName
          ? normalizeClassToken(candidateClassName)
          : "";
        const normalizedCandidateId = candidateClassId
          ? normalizeClassToken(candidateClassId)
          : "";

        if (normalizedCandidateName) {
          candidateTokens.add(normalizedCandidateName);
        }
        if (normalizedCandidateDisplay) {
          candidateTokens.add(normalizedCandidateDisplay);
        }
        if (normalizedCandidateId) {
          candidateTokens.add(normalizedCandidateId);
        }
        if (candidateClassName) {
          candidateTokens.add(candidateClassName.trim().toLowerCase());
        }
        if (candidateClassId) {
          candidateTokens.add(candidateClassId.trim().toLowerCase());
        }

        const matchesSelection =
          selectedTokens.size === 0 ||
          Array.from(candidateTokens).some(
            (token) => token && selectedTokens.has(token),
          );

        if (!matchesSelection) {
          return;
        }

        candidateMap.set(normalizedId, {
          id: normalizedId,
          name: student.name,
          className: candidateClassName || selectedClass || null,
        });
      });
    };

    registerCandidates(teacherStudents);

    if (teacherStudents.length === 0) {
      const refreshed = await refreshTeacherStudents();
      if (Array.isArray(refreshed) && refreshed.length > 0) {
        registerCandidates(refreshed);
      }
    }

    let nextNotice: string | null = null;
    const token = safeStorage.getItem("vea_auth_token");

    if (!token) {
      nextNotice = "Your session has expired. Please log in again.";
    } else {
      try {
        const searchParams = new URLSearchParams();
        const classQuery = selectedClassId || selectedClass;
        if (classQuery) {
          searchParams.set("class", classQuery);
        }

        const response = await fetch(
          `/api/students${searchParams.size > 0 ? `?${searchParams.toString()}` : ""}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          },
        );
        const payload = await response.json().catch(() => ({}));

        if (response.ok) {
          const normalized = normalizeTeacherStudentRecords(
            (payload as { students?: unknown }).students ?? [],
          );
          registerCandidates(normalized);

          if (candidateMap.size === 0) {
            nextNotice =
              normalizeStudentString(
                (payload as { message?: unknown }).message,
              ) || "No students available for this class.";
          } else {
            const infoMessage = normalizeStudentString(
              (payload as { message?: unknown }).message,
            );
            if (infoMessage) {
              nextNotice = infoMessage;
            }
          }
        } else {
          let message =
            typeof (payload as { error?: unknown }).error === "string"
              ? (payload as { error?: string }).error
              : null;

          if (response.status === 401) {
            message = "Your session has expired. Please log in again.";
          } else if (response.status === 403) {
            message = "You do not have permission to view this class roster.";
          } else if (response.status === 404) {
            message =
              normalizeStudentString(
                (payload as { message?: unknown }).message,
              ) || "No students available for this class.";
          } else if (!message) {
            message = "Unable to load the class roster. Please try again.";
          }

          nextNotice = message;
        }
      } catch (error) {
        logger.warn("Unable to load class roster for grade entry", { error });
        nextNotice =
          candidateMap.size === 0
            ? "We couldn't load the class roster from the database. Please refresh or try again shortly."
            : "Some students may be missing because the roster could not be fully loaded.";
      }
    }

    const nextCandidates = Array.from(candidateMap.values()).sort((a, b) => {
      const left = a.name ?? a.id;
      const right = b.name ?? b.id;
      return left.localeCompare(right, undefined, { sensitivity: "base" });
    });

    if (nextCandidates.length === 0 && !nextNotice) {
      nextNotice = "No students available for this class.";
    }

    setRosterCandidates(nextCandidates);
    setSelectedRosterId(null);
    setRosterNotice(nextNotice);
    setIsRosterLoading(false);
  }, [
    marksData,
    normalizeClassName,
    normalizeTeacherStudentRecords,
    refreshTeacherStudents,
    selectedClass,
    selectedClassId,
    teacherStudents,
  ]);

  useEffect(() => {
    if (!isAddStudentDialogOpen) {
      return;
    }

    void loadRosterCandidates();
  }, [isAddStudentDialogOpen, loadRosterCandidates]);

  useEffect(() => {
    if (isAddStudentDialogOpen) {
      setAddStudentDialogSubjectKey(selectedSubjectKey);
    } else {
      setAddStudentDialogSubjectKey("");
    }
  }, [isAddStudentDialogOpen, selectedSubjectKey]);

  const handleOpenAddStudentDialog = useCallback(() => {
    if (!selectedClass) {
      toast({
        variant: "destructive",
        title: "Select a class",
        description:
          "Choose one of your assigned classes before adding students to the grade sheet.",
      });
      return;
    }

    if (!hasAvailableSubjects) {
      toast({
        variant: "destructive",
        title: "No subjects available",
        description:
          "You do not have any subjects assigned for this class. Contact your administrator.",
      });
      return;
    }

    setIsAddStudentDialogOpen(true);
  }, [hasAvailableSubjects, selectedClass, toast]);

  const handleCloseAddStudentDialog = useCallback(() => {
    setIsAddStudentDialogOpen(false);
    setSelectedRosterId(null);
    setRosterNotice(null);
  }, []);

  const emitMarksStoreUpdate = useCallback((payload: unknown) => {
    suppressMarksRefreshRef.current = true;
    dbManager.triggerEvent(STUDENT_MARKS_STORAGE_KEY, payload);
    setTimeout(() => {
      suppressMarksRefreshRef.current = false;
    }, 0);
  }, []);

  const calculatePositionsAndAverages = useCallback(
    (data: MarksRecord[]) => {
      const sorted = [...data].sort(
        (a, b) => b.totalMarksObtained - a.totalMarksObtained,
      );

      return data.map((student) => {
        const position =
          sorted.findIndex((s) => s.studentId === student.studentId) + 1;
        const averageScore =
          student.totalMarksObtained > 0 && student.totalMarksObtainable > 0
            ? Math.round(
                (student.totalMarksObtained / student.totalMarksObtainable) *
                  100,
              )
            : 0;

        return {
          ...student,
          position,
          averageScore,
          grade: deriveGradeForTotals(
            student.totalMarksObtained,
            student.totalMarksObtainable,
          ),
        };
      });
    },
    [deriveGradeForTotals],
  );

  const handleConfirmAddStudents = useCallback(() => {
    const preferredOption = addStudentDialogSubjectKey
      ? subjectOptionByKey.get(addStudentDialogSubjectKey)
      : null;
    const fallbackOption = selectedSubjectKey
      ? subjectOptionByKey.get(selectedSubjectKey)
      : null;
    const resolvedOption = preferredOption ?? fallbackOption ?? null;
    const effectiveSubject =
      resolvedOption?.subject?.trim() ?? selectedSubject.trim();

    if (!effectiveSubject) {
      toast({
        variant: "destructive",
        title: "Select a subject",
        description:
          "Pick one of your assigned subjects before adding a learner to the grade sheet.",
      });
      return;
    }

    const normalizedEffectiveSubject = effectiveSubject.toLowerCase();
    const normalizedAvailableSubjects = new Set(
      availableSubjectOptions.map((option) =>
        option.subject.trim().toLowerCase(),
      ),
    );

    if (!normalizedAvailableSubjects.has(normalizedEffectiveSubject)) {
      toast({
        variant: "destructive",
        title: "Subject not assigned",
        description:
          "Choose a subject from your assignment list before adding a learner.",
      });
      return;
    }

    if (!selectedRosterId) {
      toast({
        variant: "destructive",
        title: "Select a student",
        description: "Choose a learner from the class list to continue.",
      });
      return;
    }

    const candidate = rosterCandidates.find(
      (entry) => entry.id === selectedRosterId,
    );
    if (!candidate) {
      toast({
        variant: "destructive",
        title: "Student unavailable",
        description:
          "The selected learner could not be found. Please refresh and try again.",
      });
      return;
    }

    if (
      marksData.some(
        (student) => String(student.studentId) === String(candidate.id),
      )
    ) {
      toast({
        title: "Already added",
        description:
          "This learner is already on the grade sheet and ready for editing.",
      });
      handleCloseAddStudentDialog();
      return;
    }

    const storedRecord = getStoredStudentMarksRecord(
      String(candidate.id),
      normalizedTermLabel,
      selectedSession,
    );
    const storedSubject = storedRecord
      ? storedRecord.subjects?.[effectiveSubject]
      : null;
    const resolvedSubjectKey = resolvedOption?.key ?? selectedSubjectKey;

    const initialScores = normalizeScores({
      ca1: storedSubject?.ca1 ?? 0,
      ca2: storedSubject?.ca2 ?? 0,
      assignment: storedSubject?.assignment ?? 0,
      exam: storedSubject?.exam ?? 0,
    });
    const totals = calculateScoreTotals(initialScores);
    const storedTotalObtainable =
      typeof storedSubject?.totalObtainable === "number" &&
      Number.isFinite(storedSubject.totalObtainable)
        ? Math.round(storedSubject.totalObtainable)
        : null;
    const storedTotalObtained =
      typeof storedSubject?.totalObtained === "number" &&
      Number.isFinite(storedSubject.totalObtained)
        ? Math.round(storedSubject.totalObtained)
        : null;
    const totalObtainable =
      storedTotalObtainable && storedTotalObtainable > 0
        ? storedTotalObtainable
        : defaultTotalMaximum;
    const totalObtained =
      storedTotalObtained !== null ? storedTotalObtained : totals.grandTotal;
    const averageScore =
      typeof storedSubject?.averageScore === "number" && totalObtainable > 0
        ? Math.round(storedSubject.averageScore)
        : totalObtainable > 0
          ? Math.round((totalObtained / totalObtainable) * 100)
          : 0;
    const initialGrade =
      typeof storedSubject?.grade === "string" &&
      storedSubject.grade.trim().length > 0
        ? storedSubject.grade
        : deriveGradeForTotals(totalObtained, totalObtainable);

    const newRecord: MarksRecord = {
      studentId: candidate.id,
      studentName: candidate.name ?? `Student ${candidate.id}`,
      firstCA: initialScores.ca1,
      secondCA: initialScores.ca2,
      noteAssignment: initialScores.assignment,
      caTotal: totals.caTotal,
      exam: initialScores.exam,
      grandTotal: totals.grandTotal,
      totalMarksObtainable: totalObtainable,
      totalMarksObtained: totalObtained,
      averageScore,
      position:
        typeof storedSubject?.position === "number"
          ? storedSubject.position
          : 0,
      grade: initialGrade,
      teacherRemark: storedSubject?.remark ?? "",
    };

    setMarksData((prev) => calculatePositionsAndAverages([...prev, newRecord]));

    setAdditionalData((prev) => {
      const nextAffective = { ...prev.affectiveDomain };
      const nextPsychomotor = { ...prev.psychomotorDomain };
      const nextRemarks: ClassTeacherRemarksState = {
        ...prev.classTeacherRemarks,
      };
      const nextAttendance = { ...prev.attendance };
      const nextStatus = { ...prev.studentStatus };

      if (!nextAffective[newRecord.studentId]) {
        nextAffective[newRecord.studentId] =
          createBehavioralRecordSkeleton(AFFECTIVE_TRAITS);
      }
      if (!nextPsychomotor[newRecord.studentId]) {
        nextPsychomotor[newRecord.studentId] =
          createBehavioralRecordSkeleton(PSYCHOMOTOR_SKILLS);
      }

      const interpretedRemark = interpretClassTeacherRemark(
        storedSubject?.remark,
      );
      if (interpretedRemark && resolvedSubjectKey) {
        const remarkKey = buildRemarkKey(
          resolvedSubjectKey,
          newRecord.studentId,
        );
        nextRemarks[remarkKey] = { remark: interpretedRemark };
      }
      if (!nextAttendance[newRecord.studentId]) {
        nextAttendance[newRecord.studentId] = {
          present: 0,
          absent: 0,
          total: 0,
        };
      }
      if (!nextStatus[newRecord.studentId]) {
        nextStatus[newRecord.studentId] = storedRecord?.status ?? "promoted";
      }

      return {
        ...prev,
        affectiveDomain: nextAffective,
        psychomotorDomain: nextPsychomotor,
        classTeacherRemarks: nextRemarks,
        attendance: nextAttendance,
        studentStatus: nextStatus,
      };
    });

    setRosterCandidates((prev) =>
      prev.filter((entry) => entry.id !== candidate.id),
    );

    toast({
      title: `${candidate.name ?? `Student ${candidate.id}`} added`,
      description:
        "Update their scores and remarks, then save when you are done.",
    });

    handleCloseAddStudentDialog();
  }, [
    addStudentDialogSubjectKey,
    availableSubjectOptions,
    calculatePositionsAndAverages,
    handleCloseAddStudentDialog,
    marksData,
    normalizedTermLabel,
    rosterCandidates,
    selectedRosterId,
    selectedSession,
    selectedSubject,
    selectedSubjectKey,
    setAdditionalData,
    subjectOptionByKey,
    toast,
  ]);

  const buildStudentPreview = useCallback(
    (
      student: MarksRecord,
      aggregatedRaw?: RawReportCardData | null,
    ): RawReportCardData => {
      const attendanceStats = additionalData.attendance[student.studentId] ?? {
        present: 0,
        absent: 0,
        total: 0,
      };
      const totalAttendance =
        attendanceStats.total && attendanceStats.total > 0
          ? attendanceStats.total
          : attendanceStats.present + attendanceStats.absent;

      const summaryGrade = deriveGradeFromScore(student.averageScore);
      const studentRemarkEntries = getStudentRemarkEntries(student.studentId);
      const classTeacherRemarkSummary =
        buildClassTeacherRemarkSummary(studentRemarkEntries);
      const remarkAssignmentsForStudent = studentRemarkEntries.reduce(
        (acc, entry) => {
          acc[entry.key] = { remark: entry.remark };
          return acc;
        },
        {} as Record<string, ClassTeacherRemarkEntry>,
      );
      const activeSubjectRemarkEntry = selectedSubjectKey
        ? studentRemarkEntries.find(
            (entry) => entry.subjectKey === selectedSubjectKey,
          )
        : undefined;
      const activeSubjectRemarkDisplay = activeSubjectRemarkEntry
        ? mapClassTeacherRemarkToSubjectRemark(activeSubjectRemarkEntry.remark)
        : student.teacherRemark;
      const baseSummary = {
        totalMarksObtainable: student.totalMarksObtainable,
        totalMarksObtained: student.totalMarksObtained,
        averageScore: student.averageScore,
        position: student.position,
        numberOfStudents: marksData.length,
        grade: summaryGrade,
      };

      const fallbackAdmissionNumber = `VEA/${student.studentId}`;
      const aggregatedAdmissionCandidate =
        typeof aggregatedRaw?.student?.admissionNumber === "string"
          ? aggregatedRaw.student.admissionNumber.trim()
          : "";
      const cachedAdmissionNumber =
        resolveCachedAdmissionNumber({
          id: String(student.studentId),
          admissionNumber:
            aggregatedAdmissionCandidate || fallbackAdmissionNumber,
          name: aggregatedRaw?.student?.name ?? student.studentName,
        }) ?? null;
      const admissionNumber =
        (cachedAdmissionNumber && cachedAdmissionNumber.length > 0
          ? cachedAdmissionNumber
          : null) ??
        (aggregatedAdmissionCandidate && aggregatedAdmissionCandidate.length > 0
          ? aggregatedAdmissionCandidate
          : fallbackAdmissionNumber);

      const { passportUrl, photoUrl } = resolveStudentPassportFromCache(
        {
          id: String(student.studentId),
          admissionNumber,
          name: aggregatedRaw?.student?.name ?? student.studentName,
        },
        aggregatedRaw?.student ?? null,
      );

      const basePreview: RawReportCardData = {
        student: {
          id: String(student.studentId),
          name: student.studentName,
          admissionNumber,
          class: selectedClass,
          term: normalizedTermLabel,
          session: selectedSession,
          numberInClass: additionalData.termInfo.numberInClass,
          status: additionalData.studentStatus[student.studentId],
          passportUrl,
          photoUrl,
        },
        subjects: [
          {
            name: selectedSubject || "Subject",
            subjectKey: selectedSubjectKey || undefined,
            ca1: student.firstCA,
            ca2: student.secondCA,
            assignment: student.noteAssignment,
            caTotal: student.caTotal,
            exam: student.exam,
            total: student.grandTotal,
            grade: student.grade,
            remarks: activeSubjectRemarkDisplay,
            position: student.position,
          },
        ],
        summary: baseSummary,
        totalObtainable: student.totalMarksObtainable,
        totalObtained: student.totalMarksObtained,
        average: student.averageScore,
        position: student.position,
        affectiveDomain:
          additionalData.affectiveDomain[student.studentId] ??
          createBehavioralRecordSkeleton(AFFECTIVE_TRAITS),
        psychomotorDomain:
          additionalData.psychomotorDomain[student.studentId] ??
          createBehavioralRecordSkeleton(PSYCHOMOTOR_SKILLS),
        classTeacherRemarks: classTeacherRemarkSummary,
        remarks: {
          classTeacher: classTeacherRemarkSummary || student.teacherRemark,
        },
        attendance: {
          present: attendanceStats.present ?? 0,
          absent: attendanceStats.absent ?? 0,
          total: totalAttendance,
        },
        termInfo: {
          numberInClass: additionalData.termInfo.numberInClass,
          vacationEnds: additionalData.termInfo.vacationEnds,
          nextTermBegins: additionalData.termInfo.nextTermBegins,
          nextTermFees: additionalData.termInfo.nextTermFees,
          feesBalance: additionalData.termInfo.feesBalance,
        },
        teacher: {
          id: teacher.id,
          name: teacher.name,
          signatureUrl: teacherSignature.url,
        },
        classTeacherRemarkAssignments:
          Object.keys(remarkAssignmentsForStudent).length > 0
            ? remarkAssignmentsForStudent
            : undefined,
      };

      if (!aggregatedRaw) {
        return basePreview;
      }

      const enrichedSummary = aggregatedRaw.summary
        ? {
            ...aggregatedRaw.summary,
            numberOfStudents:
              additionalData.termInfo.numberInClass ??
              aggregatedRaw.summary.numberOfStudents,
          }
        : baseSummary;

      return {
        ...aggregatedRaw,
        ...basePreview,
        student: {
          ...basePreview.student,
          ...aggregatedRaw.student,
          admissionNumber,
          numberInClass: additionalData.termInfo.numberInClass,
          status:
            additionalData.studentStatus[student.studentId] ??
            aggregatedRaw.student?.status,
        },
        subjects:
          Array.isArray(aggregatedRaw.subjects) &&
          aggregatedRaw.subjects.length > 0
            ? aggregatedRaw.subjects
            : basePreview.subjects,
        summary: enrichedSummary,
        totalObtainable:
          aggregatedRaw.totalObtainable ??
          enrichedSummary.totalMarksObtainable ??
          basePreview.totalObtainable,
        totalObtained:
          aggregatedRaw.totalObtained ??
          enrichedSummary.totalMarksObtained ??
          basePreview.totalObtained,
        average:
          aggregatedRaw.average ??
          enrichedSummary.averageScore ??
          basePreview.average,
        position:
          aggregatedRaw.position ??
          enrichedSummary.position ??
          basePreview.position,
        affectiveDomain: basePreview.affectiveDomain,
        psychomotorDomain: basePreview.psychomotorDomain,
        classTeacherRemarks: basePreview.classTeacherRemarks,
        remarks: {
          classTeacher:
            basePreview.remarks?.classTeacher ??
            aggregatedRaw.remarks?.classTeacher ??
            student.teacherRemark,
          headTeacher:
            aggregatedRaw.remarks?.headTeacher ??
            basePreview.remarks?.headTeacher,
        },
        attendance: basePreview.attendance,
        termInfo: basePreview.termInfo,
        teacher: {
          id: teacher.id,
          name: teacher.name,
          signatureUrl: teacherSignature.url,
        },
      };
    },
    [
      additionalData,
      buildClassTeacherRemarkSummary,
      getStudentRemarkEntries,
      marksData.length,
      normalizedTermLabel,
      selectedClass,
      selectedSession,
      selectedSubject,
      selectedSubjectKey,
      teacher.id,
      teacher.name,
      teacherSignature.url,
    ],
  );

  const handleMarksUpdate = (
    studentId: string,
    field: string,
    value: unknown,
  ) => {
    setMarksData((prev) => {
      const updated = prev.map((student) => {
        if (student.studentId !== studentId) {
          return student;
        }

        if (field === "teacherRemark") {
          return {
            ...student,
            teacherRemark:
              typeof value === "string" ? value : student.teacherRemark,
          };
        }

        if (field === "totalMarksObtainable") {
          const numericValue =
            typeof value === "number" ? value : Number(value);
          const safeValue =
            Number.isFinite(numericValue) && numericValue > 0
              ? Math.round(numericValue)
              : defaultTotalMaximum;
          return {
            ...student,
            totalMarksObtainable: safeValue,
            grade: deriveGradeForTotals(student.totalMarksObtained, safeValue),
          };
        }

        const numericValue = typeof value === "number" ? value : Number(value);
        const safeValue = Number.isFinite(numericValue)
          ? Number(numericValue)
          : 0;
        const currentScores = {
          ca1: field === "firstCA" ? safeValue : student.firstCA,
          ca2: field === "secondCA" ? safeValue : student.secondCA,
          assignment:
            field === "noteAssignment" ? safeValue : student.noteAssignment,
          exam: field === "exam" ? safeValue : student.exam,
        };
        const { normalized, caTotal, grandTotal } =
          calculateScoreTotals(currentScores);
        const totalMarksObtained = grandTotal;

        return {
          ...student,
          firstCA: normalized.ca1,
          secondCA: normalized.ca2,
          noteAssignment: normalized.assignment,
          exam: normalized.exam,
          caTotal,
          grandTotal,
          totalMarksObtained,
          grade: deriveGradeForTotals(
            totalMarksObtained,
            student.totalMarksObtainable,
          ),
        };
      });

      return calculatePositionsAndAverages(updated);
    });
  };

  const handleClassTeacherRemarkSelection = useCallback(
    (studentId: string, subjectKey: string, value: ClassTeacherRemarkValue) => {
      if (!studentId || !subjectKey) {
        return;
      }

      setAdditionalData((prev) => {
        const nextRemarks: ClassTeacherRemarksState = {
          ...prev.classTeacherRemarks,
        };
        const remarkKey = buildRemarkKey(subjectKey, studentId);
        nextRemarks[remarkKey] = { remark: value };

        return {
          ...prev,
          classTeacherRemarks: nextRemarks,
        };
      });

      setMarksData((previous) =>
        previous.map((entry) => {
          if (entry.studentId !== studentId) {
            return entry;
          }

          const mappedRemark = mapClassTeacherRemarkToSubjectRemark(value);
          if (entry.teacherRemark === mappedRemark) {
            return entry;
          }

          return { ...entry, teacherRemark: mappedRemark };
        }),
      );
    },
    [setAdditionalData, setMarksData],
  );

  const persistAcademicMarksToStorage = useCallback(() => {
    if (!selectedClass || !selectedSubject || marksData.length === 0) {
      return;
    }

    try {
      const timestamp = new Date().toISOString();
      const store = readStudentMarksStore();
      const updatedStore: Record<string, StoredStudentMarkRecord> = {
        ...store,
      };

      let reportCards: ReportCardRecord[] = [];
      try {
        const rawReportCards = safeStorage.getItem("reportCards");
        if (rawReportCards) {
          const parsed = JSON.parse(rawReportCards);
          if (Array.isArray(parsed)) {
            reportCards = parsed as ReportCardRecord[];
          }
        }
      } catch (parseError) {
        logger.warn("Unable to parse stored report cards", parseError);
      }

      marksData.forEach((student) => {
        const studentKey = `${student.studentId}-${normalizedTermLabel}-${selectedSession}`;
        const previousRecord = updatedStore[studentKey];
        const subjects: Record<string, StoredSubjectRecord> = {
          ...(previousRecord?.subjects ?? {}),
        };

        subjects[selectedSubject] = {
          subject: selectedSubject,
          className: selectedClass,
          ca1: student.firstCA,
          ca2: student.secondCA,
          assignment: student.noteAssignment,
          caTotal: student.caTotal,
          exam: student.exam,
          total: student.grandTotal,
          grade: student.grade,
          remark: student.teacherRemark,
          position:
            student.position ??
            previousRecord?.subjects?.[selectedSubject]?.position ??
            null,
          totalObtainable: student.totalMarksObtainable,
          totalObtained: student.totalMarksObtained,
          averageScore: student.averageScore,
          teacherId: teacher.id,
          teacherName: teacher.name,
          updatedAt: timestamp,
        };

        const aggregatedSubjects = Object.values(subjects);
        const totalMarksObtainable = aggregatedSubjects.reduce(
          (sum, subject) => sum + (subject.totalObtainable ?? 100),
          0,
        );
        const totalMarksObtained = aggregatedSubjects.reduce(
          (sum, subject) => sum + subject.total,
          0,
        );
        const overallAverage =
          totalMarksObtainable > 0
            ? Number(
                ((totalMarksObtained / totalMarksObtainable) * 100).toFixed(2),
              )
            : undefined;

        const mergedRecord: StoredStudentMarkRecord = {
          studentId: String(student.studentId),
          studentName: student.studentName,
          className: selectedClass,
          term: normalizedTermLabel,
          session: selectedSession,
          subjects,
          lastUpdated: timestamp,
          status:
            additionalData.studentStatus[student.studentId] ??
            previousRecord?.status,
          numberInClass:
            additionalData.termInfo.numberInClass ||
            previousRecord?.numberInClass,
          overallAverage: overallAverage ?? previousRecord?.overallAverage,
          overallPosition:
            student.position ?? previousRecord?.overallPosition ?? null,
        };

        updatedStore[studentKey] = mergedRecord;

        const subjectRecords: ReportCardSubjectRecord[] = Object.values(
          subjects,
        ).map((subject) => ({
          name: subject.subject,
          ca1: subject.ca1,
          ca2: subject.ca2,
          assignment: subject.assignment,
          exam: subject.exam,
          total: subject.total,
          grade: subject.grade,
          remark: subject.remark,
          position: subject.position ?? null,
        }));

        const existingIndex = reportCards.findIndex(
          (record) =>
            record.studentId === String(student.studentId) &&
            record.term === normalizedTermLabel &&
            record.session === selectedSession,
        );

        const existingRecord =
          existingIndex >= 0 ? reportCards[existingIndex] : null;
        const reportCardId =
          existingRecord?.id ??
          `report_${student.studentId}_${normalizedTermLabel}_${selectedSession}`;
        const headTeacherRemark = existingRecord?.headTeacherRemark ?? null;
        const remarkEntriesForStudent = getStudentRemarkEntries(
          student.studentId,
        );
        const classTeacherRemark =
          buildClassTeacherRemarkSummary(remarkEntriesForStudent) ||
          student.teacherRemark;

        const aggregatedRaw = buildRawReportCardFromStoredRecord(mergedRecord);
        const previewPayload = buildStudentPreview(student, aggregatedRaw);

        const existingMetadata =
          existingRecord &&
          typeof existingRecord.metadata === "object" &&
          existingRecord.metadata !== null
            ? (existingRecord.metadata as Record<string, unknown>)
            : {};

        const updatedReportCard: ReportCardRecord = {
          id: reportCardId,
          studentId: String(student.studentId),
          studentName: student.studentName,
          className: selectedClass,
          term: normalizedTermLabel,
          session: selectedSession,
          subjects: subjectRecords,
          classTeacherRemark,
          headTeacherRemark,
          metadata: {
            ...existingMetadata,
            enhancedReportCard: previewPayload,
            enhancedUpdatedAt: timestamp,
            enhancedUpdatedBy: teacher.id,
          },
          createdAt: existingRecord?.createdAt ?? timestamp,
          updatedAt: timestamp,
        };

        if (existingIndex >= 0) {
          reportCards[existingIndex] = updatedReportCard;
        } else {
          reportCards.push(updatedReportCard);
        }

        dbManager.triggerEvent("reportCardUpdated", updatedReportCard);
      });

      safeStorage.setItem(
        STUDENT_MARKS_STORAGE_KEY,
        JSON.stringify(updatedStore),
      );
      emitMarksStoreUpdate(updatedStore);
      safeStorage.setItem("reportCards", JSON.stringify(reportCards));
    } catch (error) {
      logger.error("Failed to persist academic marks", { error });
    }
  }, [
    additionalData.classTeacherRemarks,
    additionalData.attendance,
    additionalData.studentStatus,
    additionalData.termInfo.numberInClass,
    buildStudentPreview,
    buildClassTeacherRemarkSummary,
    getStudentRemarkEntries,
    emitMarksStoreUpdate,
    marksData,
    normalizedTermLabel,
    selectedClass,
    selectedSession,
    selectedSubject,
    teacher.id,
    teacher.name,
  ]);

  const loadStoredReportCardPreview = useCallback(
    (studentId: string): RawReportCardData | null => {
      try {
        const stored = safeStorage.getItem("reportCards");
        if (!stored) {
          return null;
        }

        const parsed = JSON.parse(stored) as unknown;
        if (!Array.isArray(parsed)) {
          return null;
        }

        const normalizedId = String(studentId);
        for (const entry of parsed) {
          if (!entry || typeof entry !== "object") {
            continue;
          }

          const candidate = entry as ReportCardRecord;
          if (
            candidate.studentId === normalizedId &&
            mapTermKeyToLabel(candidate.term) === normalizedTermLabel &&
            candidate.session === selectedSession
          ) {
            return mapReportCardRecordToRaw(candidate);
          }
        }
      } catch (error) {
        logger.warn("Unable to load stored report card preview", error);
      }

      return null;
    },
    [normalizedTermLabel, selectedSession],
  );

  const closePreviewDialog = useCallback(() => {
    setPreviewDialogOpen(false);
    setPreviewStudentId(null);
    setPreviewData(null);
    setIsPreviewDownloading(false);
  }, []);

  const openPreviewForStudent = useCallback(
    (student: MarksRecord) => {
      if (!selectedClass || !selectedSubject) {
        toast({
          variant: "destructive",
          title: "Selection required",
          description:
            "Choose a class and subject to generate a report card preview.",
        });
        return;
      }

      persistAcademicMarksToStorage();

      setPreviewStudentId(student.studentId);

      const storedPreview = loadStoredReportCardPreview(
        String(student.studentId),
      );
      if (storedPreview) {
        setPreviewData(storedPreview);
        setPreviewDialogOpen(true);
        return;
      }

      const storedRecord = getStoredStudentMarksRecord(
        String(student.studentId),
        normalizedTermLabel,
        selectedSession,
      );
      const aggregatedRaw = storedRecord
        ? buildRawReportCardFromStoredRecord(storedRecord)
        : null;
      const previewPayload = buildStudentPreview(student, aggregatedRaw);

      setPreviewData(previewPayload);
      setPreviewDialogOpen(true);
    },
    [
      buildStudentPreview,
      loadStoredReportCardPreview,
      normalizedTermLabel,
      persistAcademicMarksToStorage,
      selectedClass,
      selectedSession,
      selectedSubject,
      toast,
    ],
  );

  const handlePreviewDownload = useCallback(() => {
    if (!previewData) {
      toast({
        title: "Preview unavailable",
        description:
          "Generate a report card preview before attempting to download.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsPreviewDownloading(true);
      const html = buildReportCardHtml(previewData);
      const blob = new Blob([html], { type: "text/html" });
      const studentName = previewData.student.name ?? "student";
      const termLabel = mapTermKeyToLabel(selectedTerm);
      const filename = `${sanitizeFileName(studentName)}-${sanitizeFileName(termLabel)}-${sanitizeFileName(selectedSession)}.html`;

      const link = document.createElement("a");
      const downloadUrl = URL.createObjectURL(blob);
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      logger.error("Failed to download report card preview", { error });
      toast({
        title: "Download failed",
        description:
          "We couldn't generate the report card file. Please try again shortly.",
        variant: "destructive",
      });
    } finally {
      setIsPreviewDownloading(false);
    }
  }, [previewData, selectedSession, selectedTerm, toast]);

  const generateCumulativeSummaries = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (marksData.length === 0) {
        setCumulativeSummaries({});
        if (!options.silent) {
          toast({
            title: "No students loaded",
            description:
              "Add students to the grade sheet before generating cumulative summaries.",
          });
        }
        return {};
      }

      try {
        setIsGeneratingCumulative(true);
        const summaries = await Promise.all(
          marksData.map(async (student) => {
            try {
              const report = await dbManager.getStudentCumulativeReport(
                String(student.studentId),
                selectedSession,
              );
              if (!report) {
                return {
                  studentId: String(student.studentId),
                  summary: undefined,
                };
              }
              const summary: ReportCardCumulativeSummary = {
                average: report.cumulativeAverage,
                grade: report.cumulativeGrade,
                position: report.cumulativePosition,
                totalStudents: report.totalStudents ?? marksData.length,
              };
              return { studentId: String(student.studentId), summary };
            } catch (error) {
              logger.warn("Failed to resolve cumulative summary", {
                error,
                studentId: student.studentId,
              });
              return {
                studentId: String(student.studentId),
                summary: undefined,
              };
            }
          }),
        );

        const nextSummaries: Record<string, ReportCardCumulativeSummary> = {};
        let generatedCount = 0;
        summaries.forEach(({ studentId, summary }) => {
          if (summary) {
            nextSummaries[studentId] = summary;
            generatedCount += 1;
          }
        });

        setCumulativeSummaries(nextSummaries);

        if (!options.silent) {
          toast({
            title:
              generatedCount > 0
                ? "Cumulative summary ready"
                : "Cumulative summary pending",
            description:
              generatedCount > 0
                ? `Updated cumulative snapshots for ${generatedCount} ${generatedCount === 1 ? "student" : "students"}.`
                : "No cumulative data is available yet. Sync exam results to generate summaries.",
          });
        }

        return nextSummaries;
      } catch (error) {
        logger.error("Failed to generate cumulative summaries", { error });
        if (!options.silent) {
          toast({
            variant: "destructive",
            title: "Unable to generate cumulative summary",
            description:
              error instanceof Error ? error.message : "Please try again.",
          });
        }
        return {};
      } finally {
        setIsGeneratingCumulative(false);
      }
    },
    [marksData, selectedSession, toast],
  );

  const handleSyncAcademicMarks = async () => {
    try {
      if (!selectedClass || !selectedSubject) {
        toast({
          variant: "destructive",
          title: "Selection required",
          description: "Choose both a class and subject before syncing grades.",
        });
        return;
      }

      if (marksData.length === 0) {
        toast({
          variant: "destructive",
          title: "No marks recorded",
          description:
            "Add student scores before sending them to the exam office.",
        });
        return;
      }

      const termLabel = mapTermKeyToLabel(selectedTerm);
      const normalizedClass = normalizeClassName(selectedClass);
      const matchingExam = teacherExams.find(
        (exam) =>
          normalizeClassName(exam.className) === normalizedClass &&
          exam.subject.toLowerCase() === selectedSubject.toLowerCase() &&
          exam.term === termLabel &&
          exam.session === selectedSession,
      );

      if (!matchingExam) {
        toast({
          variant: "destructive",
          title: "Exam schedule not found",
          description:
            "Ask the administrator to schedule this assessment in Exam Management first.",
        });
        return;
      }

      setIsSyncingGrades(true);

      const resultsPayload = marksData.map((student) => {
        const { normalized, grandTotal } = calculateScoreTotals({
          ca1: student.firstCA,
          ca2: student.secondCA,
          assignment: student.noteAssignment,
          exam: student.exam,
        });

        return {
          studentId: String(student.studentId),
          studentName: student.studentName,
          ca1: normalized.ca1,
          ca2: normalized.ca2,
          assignment: normalized.assignment,
          exam: normalized.exam,
          grade: deriveGradeForTotals(grandTotal, student.totalMarksObtainable),
          position: student.position,
          remarks: student.teacherRemark.trim()
            ? student.teacherRemark.trim()
            : undefined,
          totalStudents: marksData.length,
          status: "pending" as const,
        };
      });

      await dbManager.saveExamResults(matchingExam.id, resultsPayload, {
        autoPublish: false,
      });
      const summaries = await generateCumulativeSummaries({ silent: true });
      const generatedCount = Object.keys(summaries).length;
      const cumulativeMessage =
        generatedCount > 0
          ? `Cumulative snapshots updated for ${generatedCount} ${generatedCount === 1 ? "student" : "students"}.`
          : "Cumulative summaries will refresh once the exam office confirms the remaining subject scores.";

      toast({
        title: "Grades synced",
        description: `Marks are now available in the admin Exam Management portal for consolidation. ${cumulativeMessage}`,
      });
    } catch (error) {
      logger.error("Failed to sync academic marks", { error });
      toast({
        variant: "destructive",
        title: "Unable to sync grades",
        description:
          "Please try again or contact the administrator if the problem persists.",
      });
    } finally {
      setIsSyncingGrades(false);
    }
  };

  const refreshMarksForSelection = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    void (async () => {
      if (!selectedClass || !selectedSubject) {
        setMarksData([]);
        return;
      }

      try {
        const normalizedClass = normalizeClassName(selectedClass);
        const normalizedSubject = selectedSubject.toLowerCase();
        const liveRecords: MarksRecord[] = [];

        try {
          const matchingExams = await dbManager.getExamSchedules({
            className: selectedClass,
            term: normalizedTermLabel,
            session: selectedSession,
          });
          const targetExam = matchingExams.find(
            (exam) => (exam.subject ?? "").toLowerCase() === normalizedSubject,
          );

          if (targetExam) {
            const examResults = await dbManager.getExamResults(targetExam.id);
            examResults
              .filter(
                (result) =>
                  normalizeClassName(result.className ?? "") ===
                  normalizedClass,
              )
              .forEach((result) => {
                const { normalized, caTotal, grandTotal } =
                  calculateScoreTotals({
                    ca1: result.ca1 ?? 0,
                    ca2: result.ca2 ?? 0,
                    assignment: result.assignment ?? 0,
                    exam: result.exam ?? 0,
                  });

                const totalMarksObtainable =
                  defaultTotalMaximum > 0
                    ? defaultTotalMaximum
                    : fallbackTotalMaximum;
                const totalMarksObtained = grandTotal;
                const resolvedGrade =
                  typeof result.grade === "string" &&
                  result.grade.trim().length > 0
                    ? result.grade.trim().toUpperCase()
                    : deriveGradeForTotals(
                        totalMarksObtained,
                        totalMarksObtainable,
                      );

                liveRecords.push({
                  studentId: result.studentId,
                  studentName:
                    typeof result.studentName === "string" &&
                    result.studentName.trim().length > 0
                      ? result.studentName
                      : `Student ${result.studentId}`,
                  firstCA: normalized.ca1,
                  secondCA: normalized.ca2,
                  noteAssignment: normalized.assignment,
                  caTotal,
                  exam: normalized.exam,
                  grandTotal,
                  totalMarksObtainable,
                  totalMarksObtained,
                  averageScore: 0,
                  position:
                    typeof result.position === "number" &&
                    Number.isFinite(result.position)
                      ? result.position
                      : 0,
                  grade: resolvedGrade,
                  teacherRemark:
                    typeof result.remarks === "string" ? result.remarks : "",
                });
              });
          }
        } catch (examError) {
          logger.warn(
            "Unable to load live exam results for teacher selection",
            {
              error: examError,
            },
          );
        }

        let nextRecords = liveRecords;

        if (nextRecords.length === 0) {
          const store = readStudentMarksStore();
          const storedRecords: MarksRecord[] = [];

          Object.values(store).forEach((record) => {
            if (!record) {
              return;
            }

            if (
              normalizeClassName(record.className ?? "") !== normalizedClass
            ) {
              return;
            }

            if (record.term !== normalizedTermLabel) {
              return;
            }

            if (record.session !== selectedSession) {
              return;
            }

            const subjects = record.subjects ?? {};
            const subjectRecord =
              subjects[selectedSubject] ??
              Object.values(subjects).find(
                (entry) =>
                  typeof entry.subject === "string" &&
                  entry.subject.toLowerCase() === normalizedSubject,
              );

            if (!subjectRecord) {
              return;
            }

            const { normalized, caTotal, grandTotal } = calculateScoreTotals({
              ca1: subjectRecord.ca1 ?? 0,
              ca2: subjectRecord.ca2 ?? 0,
              assignment: subjectRecord.assignment ?? 0,
              exam: subjectRecord.exam ?? 0,
            });

            const totalMarksObtainable =
              typeof subjectRecord.totalObtainable === "number" &&
              Number.isFinite(subjectRecord.totalObtainable)
                ? subjectRecord.totalObtainable
                : defaultTotalMaximum > 0
                  ? defaultTotalMaximum
                  : fallbackTotalMaximum;
            const totalMarksObtained =
              typeof subjectRecord.totalObtained === "number" &&
              Number.isFinite(subjectRecord.totalObtained)
                ? subjectRecord.totalObtained
                : grandTotal;

            const teacherRemark =
              typeof subjectRecord.remark === "string"
                ? subjectRecord.remark
                : "";

            storedRecords.push({
              studentId: record.studentId,
              studentName:
                typeof record.studentName === "string" &&
                record.studentName.trim().length > 0
                  ? record.studentName
                  : `Student ${record.studentId}`,
              firstCA: normalized.ca1,
              secondCA: normalized.ca2,
              noteAssignment: normalized.assignment,
              caTotal,
              exam: normalized.exam,
              grandTotal,
              totalMarksObtainable,
              totalMarksObtained,
              averageScore:
                totalMarksObtainable > 0
                  ? Math.round(
                      (totalMarksObtained / totalMarksObtainable) * 100,
                    )
                  : 0,
              position:
                typeof subjectRecord.position === "number" &&
                Number.isFinite(subjectRecord.position)
                  ? subjectRecord.position
                  : 0,
              grade:
                typeof subjectRecord.grade === "string" &&
                subjectRecord.grade.trim().length > 0
                  ? subjectRecord.grade.trim().toUpperCase()
                  : deriveGradeForTotals(
                      totalMarksObtained,
                      totalMarksObtainable,
                    ),
              teacherRemark,
            });
          });

          nextRecords = storedRecords;
        }

        setMarksData(
          nextRecords.length > 0
            ? calculatePositionsAndAverages(nextRecords)
            : [],
        );
      } catch (error) {
        logger.warn("Failed to refresh marks for selection", { error });
        setMarksData([]);
      }
    })();
  }, [
    calculatePositionsAndAverages,
    normalizedTermLabel,
    normalizeClassName,
    selectedClass,
    selectedSession,
    selectedSubject,
  ]);

  const loadAdditionalData = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    const parseStorageRecord = (key: string) => {
      try {
        const storedValue = safeStorage.getItem(key);
        if (!storedValue) {
          return {};
        }
        const parsed = JSON.parse(storedValue);
        return typeof parsed === "object" && parsed !== null
          ? (parsed as Record<string, unknown>)
          : {};
      } catch (error) {
        logger.error(`Failed to parse ${key} storage`, { error });
        return {};
      }
    };

    const behavioralStore = parseStorageRecord("behavioralAssessments");
    const attendanceStore = parseStorageRecord("attendancePositions");
    const remarksStore = parseStorageRecord("classTeacherRemarks");

    const nextState = {
      affectiveDomain: {} as BehavioralDomainState,
      psychomotorDomain: {} as BehavioralDomainState,
      classTeacherRemarks: {} as ClassTeacherRemarksState,
      attendance: {} as AttendanceState,
      studentStatus: {} as StudentStatusState,
      termInfo: createEmptyTermInfo(),
    };

    let termInfoLoaded = false;

    marksData.forEach((student) => {
      const studentKey = `${student.studentId}-${normalizedTermLabel}-${selectedSession}`;

      const behavioralRecord = behavioralStore[studentKey] as
        | {
            affectiveDomain?: Record<string, unknown>;
            psychomotorDomain?: Record<string, unknown>;
          }
        | undefined;

      const defaultAffectiveSelections =
        createBehavioralRecordSkeleton(AFFECTIVE_TRAITS);
      const defaultPsychomotorSelections =
        createBehavioralRecordSkeleton(PSYCHOMOTOR_SKILLS);

      nextState.affectiveDomain[student.studentId] = {
        ...defaultAffectiveSelections,
      };
      nextState.psychomotorDomain[student.studentId] = {
        ...defaultPsychomotorSelections,
      };

      if (behavioralRecord) {
        const storedAffective = behavioralRecord.affectiveDomain ?? {};
        Object.entries(storedAffective).forEach(([rawKey, rawValue]) => {
          const canonicalKey = normalizeBehavioralDomainKey(
            "affective",
            rawKey,
          );
          if (!canonicalKey) {
            return;
          }
          nextState.affectiveDomain[student.studentId][canonicalKey] =
            interpretBehavioralSelection(rawValue);
        });

        const storedPsychomotor = behavioralRecord.psychomotorDomain ?? {};
        Object.entries(storedPsychomotor).forEach(([rawKey, rawValue]) => {
          const canonicalKey = normalizeBehavioralDomainKey(
            "psychomotor",
            rawKey,
          );
          if (!canonicalKey) {
            return;
          }
          nextState.psychomotorDomain[student.studentId][canonicalKey] =
            interpretBehavioralSelection(rawValue);
        });
      }

      const attendanceRecord = attendanceStore[studentKey] as
        | {
            attendance?: { present?: number; absent?: number; total?: number };
            status?: string;
            termInfo?: Partial<TermInfoState>;
          }
        | undefined;

      if (attendanceRecord) {
        if (
          attendanceRecord.attendance &&
          typeof attendanceRecord.attendance === "object"
        ) {
          const {
            present = 0,
            absent = 0,
            total = 0,
          } = attendanceRecord.attendance;
          nextState.attendance[student.studentId] = {
            present: Number.isFinite(present) ? present : 0,
            absent: Number.isFinite(absent) ? absent : 0,
            total: Number.isFinite(total) ? total : 0,
          };
        }

        if (typeof attendanceRecord.status === "string") {
          nextState.studentStatus[student.studentId] = attendanceRecord.status;
        }

        if (
          attendanceRecord.termInfo &&
          typeof attendanceRecord.termInfo === "object"
        ) {
          termInfoLoaded = true;
          nextState.termInfo = {
            numberInClass:
              typeof attendanceRecord.termInfo.numberInClass === "number"
                ? String(attendanceRecord.termInfo.numberInClass)
                : (attendanceRecord.termInfo.numberInClass ??
                  nextState.termInfo.numberInClass),
            nextTermBegins:
              attendanceRecord.termInfo.nextTermBegins ??
              nextState.termInfo.nextTermBegins,
            vacationEnds:
              attendanceRecord.termInfo.vacationEnds ??
              nextState.termInfo.vacationEnds,
            nextTermFees:
              attendanceRecord.termInfo.nextTermFees ??
              nextState.termInfo.nextTermFees,
            feesBalance:
              attendanceRecord.termInfo.feesBalance ??
              nextState.termInfo.feesBalance,
          };
        }
      }

      const remarksRecord = remarksStore[studentKey] as
        | {
            remark?: unknown;
            remarksBySubject?: Record<string, unknown>;
          }
        | undefined;

      const assignRemarkToStudent = (
        subjectKey: string,
        remark: ClassTeacherRemarkValue,
      ) => {
        if (!subjectKey) {
          return;
        }

        const remarkKey = buildRemarkKey(subjectKey, student.studentId);
        nextState.classTeacherRemarks[remarkKey] = { remark };
      };

      if (remarksRecord && typeof remarksRecord === "object") {
        if (
          remarksRecord.remarkAssignments &&
          typeof remarksRecord.remarkAssignments === "object"
        ) {
          Object.entries(remarksRecord.remarkAssignments).forEach(
            ([compositeKey, rawValue]) => {
              const candidate =
                typeof rawValue === "object" &&
                rawValue !== null &&
                "remark" in rawValue
                  ? (rawValue as { remark?: unknown }).remark
                  : rawValue;
              const interpreted = interpretClassTeacherRemark(candidate);
              if (!interpreted) {
                return;
              }

              const { subjectKey, studentId: entryStudentId } =
                parseRemarkKey(compositeKey);
              if (entryStudentId === student.studentId) {
                assignRemarkToStudent(subjectKey, interpreted);
              }
            },
          );
        }

        if (
          remarksRecord.remarksBySubject &&
          typeof remarksRecord.remarksBySubject === "object"
        ) {
          Object.entries(remarksRecord.remarksBySubject).forEach(
            ([subjectKey, rawValue]) => {
              const candidate =
                typeof rawValue === "object" &&
                rawValue !== null &&
                "remark" in rawValue
                  ? (rawValue as { remark?: unknown }).remark
                  : rawValue;
              const interpreted = interpretClassTeacherRemark(candidate);
              if (interpreted) {
                assignRemarkToStudent(subjectKey, interpreted);
              }
            },
          );
        }

        if (remarksRecord.remark) {
          const interpreted = interpretClassTeacherRemark(remarksRecord.remark);
          if (interpreted) {
            const hasExistingRemarkForStudent = Object.keys(
              nextState.classTeacherRemarks,
            ).some((key) => {
              const parsed = parseRemarkKey(key);
              return parsed.studentId === student.studentId;
            });

            if (!hasExistingRemarkForStudent) {
              const fallbackKey =
                selectedSubjectKey || selectedSubject || "general";
              assignRemarkToStudent(fallbackKey, interpreted);
            }
          }
        }
      }
    });

    if (selectedSubjectKey) {
      const activeSubjectKey = selectedSubjectKey;

      setMarksData((previous) => {
        if (previous.length === 0) {
          return previous;
        }

        let hasChanges = false;
        const nextMarks = previous.map((entry) => {
          const remarkEntry =
            nextState.classTeacherRemarks[
              buildRemarkKey(activeSubjectKey, entry.studentId)
            ];
          if (!remarkEntry?.remark) {
            return entry;
          }

          const mappedRemark = mapClassTeacherRemarkToSubjectRemark(
            remarkEntry.remark,
          );
          if (entry.teacherRemark === mappedRemark) {
            return entry;
          }

          hasChanges = true;
          return { ...entry, teacherRemark: mappedRemark };
        });

        return hasChanges ? nextMarks : previous;
      });
    }

    setAdditionalData((prev) => ({
      ...prev,
      affectiveDomain: nextState.affectiveDomain,
      psychomotorDomain: nextState.psychomotorDomain,
      classTeacherRemarks: nextState.classTeacherRemarks,
      attendance: nextState.attendance,
      studentStatus: nextState.studentStatus,
      termInfo: termInfoLoaded ? nextState.termInfo : createEmptyTermInfo(),
    }));
  }, [
    marksData,
    mapClassTeacherRemarkToSubjectRemark,
    normalizedTermLabel,
    selectedSession,
    selectedSubject,
    selectedSubjectKey,
    setMarksData,
  ]);

  useEffect(() => {
    refreshMarksForSelection();
  }, [refreshMarksForSelection]);

  useEffect(() => {
    const handleExamResultsUpdate = () => {
      refreshMarksForSelection();
    };

    dbManager.on("examResultsUpdated", handleExamResultsUpdate);

    return () => {
      dbManager.off("examResultsUpdated", handleExamResultsUpdate);
    };
  }, [refreshMarksForSelection]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleMarksUpdate = () => {
      if (suppressMarksRefreshRef.current) {
        return;
      }
      refreshMarksForSelection();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STUDENT_MARKS_STORAGE_KEY) {
        if (suppressMarksRefreshRef.current) {
          return;
        }
        refreshMarksForSelection();
      }
    };

    dbManager.on(STUDENT_MARKS_STORAGE_KEY, handleMarksUpdate);
    window.addEventListener("storage", handleStorage);

    return () => {
      dbManager.off(STUDENT_MARKS_STORAGE_KEY, handleMarksUpdate);
      window.removeEventListener("storage", handleStorage);
    };
  }, [refreshMarksForSelection]);

  useEffect(() => {
    loadAdditionalData();
  }, [loadAdditionalData]);

  useEffect(() => {
    const selectionKey = [
      selectedClass || "",
      selectedSubject || "",
      normalizedTermLabel,
      selectedSession,
    ].join("::");

    if (!selectedClass || !selectedSubject || marksData.length === 0) {
      lastPersistedSelectionRef.current = selectionKey;
      return;
    }

    if (lastPersistedSelectionRef.current !== selectionKey) {
      lastPersistedSelectionRef.current = selectionKey;
      return;
    }

    persistAcademicMarksToStorage();
  }, [
    marksData,
    normalizedTermLabel,
    persistAcademicMarksToStorage,
    selectedClass,
    selectedSession,
    selectedSubject,
  ]);

  useEffect(() => {
    setWorkflowRecords(getWorkflowRecords());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleWorkflowUpdate = (event: Event) => {
      const detail = (
        event as CustomEvent<{ records?: ReportCardWorkflowRecord[] }>
      ).detail;
      if (Array.isArray(detail?.records)) {
        setWorkflowRecords(detail.records);
      }
    };

    window.addEventListener(
      REPORT_CARD_WORKFLOW_EVENT,
      handleWorkflowUpdate as EventListener,
    );
    return () => {
      window.removeEventListener(
        REPORT_CARD_WORKFLOW_EVENT,
        handleWorkflowUpdate as EventListener,
      );
    };
  }, []);

  const currentWorkflowRecords = useMemo(
    () =>
      workflowRecords.filter(
        (record) =>
          record.className === selectedClass &&
          record.subject === selectedSubject &&
          record.term === normalizedTermLabel &&
          record.session === selectedSession &&
          record.teacherId === teacher.id,
      ),
    [
      normalizedTermLabel,
      selectedClass,
      selectedSession,
      selectedSubject,
      teacher.id,
      workflowRecords,
    ],
  );

  const currentStatus = useMemo(
    () => getWorkflowSummary(currentWorkflowRecords),
    [currentWorkflowRecords],
  );

  const handleSaveDraft = useCallback(async () => {
    if (!selectedClass || !selectedSubject) {
      toast({
        variant: "destructive",
        title: "Select class & subject",
        description: "Choose a class and subject before saving your progress.",
      });
      return;
    }

    if (!marksData.length) {
      toast({
        variant: "destructive",
        title: "No student results",
        description: "Add student scores before saving progress.",
      });
      return;
    }

    try {
      setIsSavingDraft(true);
      await Promise.resolve(persistAcademicMarksToStorage());
      toast({
        title: "Progress saved",
        description:
          "Your report card entries are stored until you're ready to submit for approval.",
      });
    } catch (error) {
      logger.error("Failed to save report card draft", { error });
      toast({
        variant: "destructive",
        title: "Unable to save progress",
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsSavingDraft(false);
    }
  }, [
    marksData.length,
    persistAcademicMarksToStorage,
    selectedClass,
    selectedSubject,
    toast,
  ]);

  const handleSubmitForApproval = useCallback(async () => {
    if (!selectedClass || !selectedSubject) {
      toast({
        variant: "destructive",
        title: "Select class & subject",
        description:
          "Choose a class and subject before sending report cards for approval.",
      });
      return;
    }

    if (!marksData.length) {
      toast({
        variant: "destructive",
        title: "No student results",
        description: "Add student scores before submitting for approval.",
      });
      return;
    }

    try {
      persistAcademicMarksToStorage();
      setIsSubmittingForApproval(true);
      const cumulativeSnapshot = await generateCumulativeSummaries({
        silent: true,
      });
      const generatedCount = Object.keys(cumulativeSnapshot).length;
      const updated = submitReportCardsForApproval({
        teacherId: teacher.id,
        teacherName: teacher.name,
        className: selectedClass,
        subject: selectedSubject,
        term: normalizedTermLabel,
        session: selectedSession,
        students: marksData.map((student) => ({
          id: student.studentId,
          name: student.studentName,
        })),
        cumulativeSummaries: cumulativeSnapshot,
      });

      setWorkflowRecords(updated);
      toast({
        title: "Sent for approval",
        description:
          generatedCount > 0
            ? `Admin has been notified to review this result batch, including cumulative snapshots for ${generatedCount} ${generatedCount === 1 ? "student" : "students"}.`
            : "Admin has been notified to review this result batch. Cumulative summaries will update after the exam office finalises other subjects.",
      });
    } catch (error) {
      logger.error("Failed to submit report cards for approval", { error });
      toast({
        variant: "destructive",
        title: "Unable to submit",
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsSubmittingForApproval(false);
    }
  }, [
    generateCumulativeSummaries,
    marksData,
    normalizedTermLabel,
    selectedClass,
    selectedSession,
    selectedSubject,
    teacher.id,
    teacher.name,
    toast,
  ]);

  const handleCancelSubmission = useCallback(async () => {
    try {
      setIsCancellingSubmission(true);
      const updated = resetReportCardSubmission({
        teacherId: teacher.id,
        className: selectedClass,
        subject: selectedSubject,
        term: normalizedTermLabel,
        session: selectedSession,
      });
      setWorkflowRecords(updated);
      toast({
        title: "Submission cancelled",
        description:
          "You can continue editing the report card details before resubmitting.",
      });
    } catch (error) {
      logger.error("Failed to cancel report card submission", { error });
      toast({
        variant: "destructive",
        title: "Unable to cancel submission",
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsCancellingSubmission(false);
    }
  }, [
    normalizedTermLabel,
    selectedClass,
    selectedSession,
    selectedSubject,
    teacher.id,
    toast,
  ]);

  const handleDownloadAssignmentAttachment = (
    assignment: TeacherAssignmentSummary,
  ) => {
    if (!assignment.resourceUrl) {
      toast({
        variant: "destructive",
        title: "No attachment",
        description: "This assignment does not have an attachment to download.",
      });
      return;
    }

    const runtime = getBrowserRuntime();
    if (!runtime?.document) {
      toast({
        variant: "destructive",
        title: "Download unavailable",
        description:
          "Attachments can only be downloaded in a browser environment.",
      });
      return;
    }

    const link = runtime.document.createElement("a");
    link.href = assignment.resourceUrl;
    link.download = assignment.resourceName || `${assignment.title}.attachment`;
    runtime.document.body?.appendChild(link);
    link.click();
    runtime.document.body?.removeChild(link);
  };

  const handleDownloadSubmissionFile = (
    submission: AssignmentSubmissionRecord,
    file: NonNullable<AssignmentSubmissionRecord["files"]>[number],
  ) => {
    if (!file.url) {
      toast({
        variant: "destructive",
        title: "Download unavailable",
        description: "This submission file could not be downloaded.",
      });
      return;
    }

    const runtime = getBrowserRuntime();

    if (!runtime?.document) {
      toast({
        variant: "destructive",
        title: "Download unavailable",
        description:
          "Submission files can only be downloaded in a browser environment.",
      });
      return;
    }

    const link = runtime.document.createElement("a");
    link.href = file.url;
    link.download = file.name || `${submission.studentId}-submission`;
    runtime.document.body?.appendChild(link);
    link.click();
    runtime.document.body?.removeChild(link);
  };

  const resetAssignmentForm = useCallback(() => {
    setAssignmentForm({
      title: "",
      description: "",
      dueDate: "",
      subject: teacherClasses[0]?.subjects[0] ?? teacherSubjects[0] ?? "",
      classId: teacherClasses[0]?.id ?? "",
      className: teacherClasses[0]?.name ?? "",
      maximumScore: String(assignmentFormDefaultMaximum),
      file: null,
      resourceName: "",
      resourceType: "",
      resourceUrl: "",
      resourceSize: null,
    });
    setEditingAssignmentId(null);
    setAssignmentDialogMode("create");
  }, [assignmentFormDefaultMaximum, teacherClasses, teacherSubjects]);

  const openCreateAssignmentDialog = () => {
    resetAssignmentForm();
    setShowCreateAssignment(true);
  };

  const handleEditAssignment = (assignment: TeacherAssignmentSummary) => {
    setAssignmentDialogMode("edit");
    setEditingAssignmentId(assignment.id);
    const matchedClass = assignment.classId
      ? teacherClasses.find((cls) => cls.id === assignment.classId)
      : teacherClasses.find(
          (cls) =>
            normalizeClassName(cls.name) ===
            normalizeClassName(assignment.className),
        );
    setAssignmentForm({
      title: assignment.title,
      description: assignment.description ?? "",
      dueDate: assignment.dueDate,
      subject: assignment.subject,
      classId: matchedClass?.id ?? assignment.classId ?? "",
      className: matchedClass?.name ?? assignment.className,
      maximumScore: assignment.maximumScore
        ? String(assignment.maximumScore)
        : String(assignmentFormDefaultMaximum),
      file: null,
      resourceName: assignment.resourceName ?? "",
      resourceType: assignment.resourceType ?? "",
      resourceUrl: assignment.resourceUrl ?? "",
      resourceSize:
        typeof assignment.resourceSize === "number"
          ? assignment.resourceSize
          : null,
    });
    setShowCreateAssignment(true);
  };

  const handlePreviewAssignment = (assignment: TeacherAssignmentSummary) => {
    setPreviewAssignment(assignment);
  };

  const describeDueDate = (value: string) => {
    if (!value) return "No due date";
    const dueDate = new Date(value);
    if (Number.isNaN(dueDate.getTime())) {
      return value;
    }

    const oneDay = 1000 * 60 * 60 * 24;
    const diff = Math.ceil((dueDate.getTime() - Date.now()) / oneDay);

    if (diff > 1) return `Due in ${diff} days`;
    if (diff === 1) return "Due tomorrow";
    if (diff === 0) return "Due today";
    return `Overdue by ${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"}`;
  };

  useEffect(() => {
    if (!assignments.length || !teacher.id) {
      return;
    }

    const reminderTasks = assignments.map(async (assignment) => {
      const assignmentId = assignment.id;
      const dueDate = assignment.dueDate;

      if (!assignmentId || !dueDate) {
        clearAssignmentReminderHistory("teacher", assignmentId);
        return;
      }

      if (assignment.status === "draft") {
        clearAssignmentReminderHistory("teacher", assignmentId);
        return;
      }

      const dueTimestamp = Date.parse(dueDate);
      if (Number.isNaN(dueTimestamp)) {
        return;
      }

      const submittedCount = assignment.submissions.filter((submission) =>
        ["submitted", "graded"].includes(submission.status),
      ).length;
      const gradedCount = assignment.submissions.filter(
        (submission) => submission.status === "graded",
      ).length;
      const pendingGradingCount = assignment.submissions.filter(
        (submission) => submission.status === "submitted",
      ).length;
      const totalAssigned = Array.isArray(assignment.assignedStudentIds)
        ? assignment.assignedStudentIds.length
        : assignment.submissions.length;
      const missingSubmissions = Math.max(totalAssigned - submittedCount, 0);

      if (pendingGradingCount === 0 && missingSubmissions === 0) {
        clearAssignmentReminderHistory("teacher", assignmentId);
        return;
      }

      const audience = [teacher.id, "teacher"] as const;
      const title = assignment.title || "Assignment";
      const className = assignment.className || assignment.classId || undefined;
      const subject = assignment.subject;

      if (pendingGradingCount > 0 && Date.now() > dueTimestamp) {
        if (
          shouldSendAssignmentReminder(
            "teacher",
            assignmentId,
            "gradingPending",
            { dueDate },
          )
        ) {
          try {
            await dbManager.saveNotification({
              title: "Submissions awaiting grading",
              message: `You have ${pendingGradingCount} submission${pendingGradingCount === 1 ? "" : "s"} to grade for "${title}".`,
              type: "warning",
              category: "task",
              audience,
              targetAudience: audience,
              metadata: {
                assignmentId,
                dueDate,
                subject,
                className,
                pendingGrading: pendingGradingCount,
              },
            });
            markAssignmentReminderSent(
              "teacher",
              assignmentId,
              "gradingPending",
              { dueDate },
            );
          } catch (error) {
            logger.error("Failed to save grading reminder", {
              error,
              assignmentId,
            });
          }
        }
      } else if (pendingGradingCount === 0) {
        clearAssignmentReminderHistory("teacher", assignmentId, {
          types: ["gradingPending"],
        });
      }

      if (missingSubmissions > 0 && Date.now() > dueTimestamp) {
        if (
          shouldSendAssignmentReminder(
            "teacher",
            assignmentId,
            "missingSubmissions",
            { dueDate },
          )
        ) {
          try {
            await dbManager.saveNotification({
              title: "Students missing submissions",
              message: `${missingSubmissions} student${missingSubmissions === 1 ? "" : "s"} have not submitted "${title}".`,
              type: "destructive",
              category: "task",
              audience,
              targetAudience: audience,
              metadata: {
                assignmentId,
                dueDate,
                subject,
                className,
                outstandingSubmissions: missingSubmissions,
                gradedCount,
              },
            });
            markAssignmentReminderSent(
              "teacher",
              assignmentId,
              "missingSubmissions",
              { dueDate },
            );
          } catch (error) {
            logger.error("Failed to save missing submission reminder", {
              error,
              assignmentId,
            });
          }
        }
      } else if (missingSubmissions === 0) {
        clearAssignmentReminderHistory("teacher", assignmentId, {
          types: ["missingSubmissions"],
        });
      }
    });

    void Promise.allSettled(reminderTasks);
  }, [assignments, teacher.id]);

  const handleSaveAssignment = async (intent: "draft" | "sent") => {
    if (isSavingAssignment) {
      return;
    }

    if (
      !assignmentForm.title ||
      !assignmentForm.subject ||
      !assignmentForm.className ||
      !assignmentForm.dueDate ||
      (teacherClasses.length > 0 && !assignmentForm.classId)
    ) {
      toast({
        variant: "destructive",
        title: "Incomplete details",
        description:
          "Please provide the title, subject, class, and due date for the assignment.",
      });
      return;
    }

    const parsedMaximum = Number(assignmentForm.maximumScore);
    if (!Number.isFinite(parsedMaximum) || parsedMaximum <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid mark",
        description:
          "Please set a valid maximum score greater than zero for this assignment.",
      });
      return;
    }

    const maximumScoreValue = Math.round(parsedMaximum);

    try {
      setIsSavingAssignment(true);

      const trimmedClassName = assignmentForm.className.trim();
      const trimmedClassId = assignmentForm.classId?.trim() ?? "";
      const resolvedClassId = trimmedClassId.length > 0 ? trimmedClassId : null;

      let resourceUrl = assignmentForm.resourceUrl || "";
      let resourceType = assignmentForm.resourceType || "";
      let resourceSize = assignmentForm.resourceSize ?? null;
      let resourceName = assignmentForm.resourceName || "";

      if (assignmentForm.file) {
        resourceUrl = await readFileAsDataUrl(assignmentForm.file);
        resourceType = assignmentForm.file.type || "application/octet-stream";
        resourceSize = assignmentForm.file.size;
        resourceName = assignmentForm.file.name;
      }

      const payload = {
        title: assignmentForm.title.trim(),
        description: assignmentForm.description.trim(),
        subject: assignmentForm.subject,
        classId: resolvedClassId,
        className: trimmedClassName,
        teacherId: teacher.id,
        teacherName: teacher.name,
        dueDate: assignmentForm.dueDate,
        status: intent,
        maximumScore: maximumScoreValue,
        resourceName: resourceName || null,
        resourceType: resourceType || null,
        resourceUrl: resourceUrl || null,
        resourceSize,
      };

      if (assignmentDialogMode === "edit" && editingAssignmentId) {
        await dbManager.updateAssignment(editingAssignmentId, payload);
        toast({
          title: intent === "sent" ? "Assignment sent" : "Draft updated",
          description:
            intent === "sent"
              ? "Students can now access the refreshed assignment."
              : "Your changes have been saved successfully.",
        });
      } else {
        await dbManager.createAssignment(payload);

        toast({
          title: intent === "sent" ? "Assignment sent" : "Draft saved",
          description:
            intent === "sent"
              ? "Students have been notified about the new assignment."
              : "You can return later to finish and send this assignment.",
        });
      }

      setShowCreateAssignment(false);
      resetAssignmentForm();
      void loadAssignments();
    } catch (error) {
      logger.error("Failed to save assignment", { error });
      toast({
        variant: "destructive",
        title: "Unable to save assignment",
        description:
          error instanceof Error
            ? error.message
            : "Please try again or contact the administrator.",
      });
    } finally {
      setIsSavingAssignment(false);
    }
  };

  const handleAssignmentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSavingAssignment) {
      return;
    }

    const nativeEvent = event.nativeEvent;
    let intent: "draft" | "sent" = "draft";

    if (
      nativeEvent &&
      typeof (nativeEvent as SubmitEvent).submitter !== "undefined"
    ) {
      const submitter = (nativeEvent as SubmitEvent).submitter;

      if (submitter instanceof HTMLElement) {
        const rawValue =
          submitter instanceof HTMLButtonElement ||
          submitter instanceof HTMLInputElement
            ? submitter.value
            : (submitter.getAttribute("value") ?? "");

        const fallbackIntent = submitter.getAttribute("data-intent");
        const normalized = (rawValue || fallbackIntent || "").toLowerCase();

        if (normalized === "sent" || normalized === "send") {
          intent = "sent";
        } else if (normalized === "draft" || normalized === "save") {
          intent = "draft";
        }
      }
    }

    await handleSaveAssignment(intent);
  };

  const handleSendAssignment = async (assignment: TeacherAssignmentSummary) => {
    try {
      setAssignmentActionId(assignment.id);
      await dbManager.updateAssignmentStatus(assignment.id, "sent");
      toast({
        title: "Assignment sent",
        description: "Students can now view and submit this assignment.",
      });
      void loadAssignments();
    } catch (error) {
      logger.error("Failed to send assignment", { error });
      toast({
        variant: "destructive",
        title: "Unable to send assignment",
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setAssignmentActionId(null);
    }
  };

  const handleDeleteAssignment = async (
    assignment: TeacherAssignmentSummary,
  ) => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        `Delete ${assignment.title}? This cannot be undone.`,
      );
      if (!confirmed) {
        return;
      }
    }

    try {
      setDeletingAssignmentId(assignment.id);
      await dbManager.deleteAssignment(assignment.id);
      toast({
        title: "Assignment deleted",
        description: "The assignment has been removed from your dashboard.",
      });
      void loadAssignments();
    } catch (error) {
      logger.error("Failed to delete assignment", { error });
      toast({
        variant: "destructive",
        title: "Unable to delete assignment",
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setDeletingAssignmentId(null);
    }
  };

  const handleViewSubmissions = async (
    assignment: TeacherAssignmentSummary,
  ) => {
    setSelectedAssignment(assignment);
    setGradingDrafts(buildInitialGradingDrafts(assignment.submissions));
    setShowSubmissions(true);
    setIsLoadingSubmissions(true);
    setAssignmentRoster({});

    try {
      const initialRoster = await resolveAssignmentRoster(assignment);
      setAssignmentRoster(initialRoster);

      const records = await dbManager.getAssignments({
        teacherId: teacher.id,
        assignmentId: assignment.id,
      });

      const latest = records.find(
        (record) => String(record.id) === assignment.id,
      );

      if (latest) {
        const normalised = normaliseAssignmentRecord(latest);
        setSelectedAssignment(normalised);
        setGradingDrafts(buildInitialGradingDrafts(normalised.submissions));
        const updatedRoster = await resolveAssignmentRoster(normalised);
        setAssignmentRoster(updatedRoster);
      }
    } catch (error) {
      logger.error("Failed to load assignment submissions", { error });
      toast({
        variant: "destructive",
        title: "Unable to load submissions",
        description: "Please try again shortly.",
      });
    } finally {
      setIsLoadingSubmissions(false);
    }
  };

  const applyAssignmentScoreToMarksRecord = (
    studentId: string,
    score: number | null,
  ): MarksRecord | null => {
    if (score === null) {
      const existing = marksData.find((entry) => entry.studentId === studentId);
      return existing ?? null;
    }

    let updatedRecord: MarksRecord | null = null;

    setMarksData((prev) => {
      const updated = prev.map((student) => {
        if (student.studentId !== studentId) {
          return student;
        }

        const { normalized, caTotal, grandTotal } = calculateScoreTotals({
          ca1: student.firstCA,
          ca2: student.secondCA,
          assignment: score,
          exam: student.exam,
        });

        const recalculated: MarksRecord = {
          ...student,
          firstCA: normalized.ca1,
          secondCA: normalized.ca2,
          noteAssignment: normalized.assignment,
          exam: normalized.exam,
          caTotal,
          grandTotal,
          totalMarksObtained: grandTotal,
          grade: deriveGradeForTotals(grandTotal, student.totalMarksObtainable),
        };

        updatedRecord = recalculated;
        return recalculated;
      });

      return calculatePositionsAndAverages(updated);
    });

    return updatedRecord;
  };

  const syncAssignmentScoreToReportCard = useCallback(
    ({
      studentId,
      studentName,
      className,
      subject,
      score,
      grade,
      maximumScore,
      marksRecord,
    }: {
      studentId: string;
      studentName?: string | null;
      className?: string | null;
      subject: string;
      score: number;
      grade: string | null;
      maximumScore: number;
      marksRecord?: MarksRecord | null;
    }) => {
      try {
        const store = readStudentMarksStore();
        const timestamp = new Date().toISOString();
        const normalizedTerm = normalizedTermLabel;
        const key = `${studentId}-${normalizedTerm}-${selectedSession}`;
        const previousRecord = store[key] ?? null;

        const subjects = { ...(previousRecord?.subjects ?? {}) };
        const baseline = subjects[subject] ?? {
          subject,
          className:
            className ?? previousRecord?.className ?? selectedClass ?? "",
          ca1: previousRecord?.subjects?.[subject]?.ca1 ?? 0,
          ca2: previousRecord?.subjects?.[subject]?.ca2 ?? 0,
          assignment: previousRecord?.subjects?.[subject]?.assignment ?? 0,
          caTotal: previousRecord?.subjects?.[subject]?.caTotal ?? 0,
          exam: previousRecord?.subjects?.[subject]?.exam ?? 0,
          total: previousRecord?.subjects?.[subject]?.total ?? 0,
          grade: previousRecord?.subjects?.[subject]?.grade ?? "",
          remark: previousRecord?.subjects?.[subject]?.remark ?? "",
          position: previousRecord?.subjects?.[subject]?.position ?? null,
          totalObtainable:
            previousRecord?.subjects?.[subject]?.totalObtainable ?? 100,
          totalObtained:
            previousRecord?.subjects?.[subject]?.totalObtained ??
            previousRecord?.subjects?.[subject]?.total ??
            0,
          averageScore: previousRecord?.subjects?.[subject]?.averageScore,
          teacherId: previousRecord?.subjects?.[subject]?.teacherId,
          teacherName: previousRecord?.subjects?.[subject]?.teacherName,
          updatedAt: previousRecord?.subjects?.[subject]?.updatedAt,
        };

        const { normalized, caTotal, grandTotal } = calculateScoreTotals({
          ca1: baseline.ca1,
          ca2: baseline.ca2,
          assignment: score,
          exam: baseline.exam,
        });
        const subjectTotalObtainable =
          typeof baseline.totalObtainable === "number" &&
          baseline.totalObtainable > 0
            ? baseline.totalObtainable
            : defaultTotalMaximum > 0
              ? defaultTotalMaximum
              : fallbackTotalMaximum;
        const resolvedGrade =
          grade ??
          (maximumScore > 0
            ? deriveGradeFromScore((score / maximumScore) * 100)
            : deriveGradeForTotals(grandTotal, subjectTotalObtainable));

        const updatedSubject: StoredSubjectRecord = {
          ...baseline,
          subject,
          className: className ?? baseline.className,
          assignment: normalized.assignment,
          caTotal,
          total: grandTotal,
          grade: resolvedGrade,
          totalObtained: grandTotal,
          teacherId: teacher.id,
          teacherName: teacher.name,
          updatedAt: timestamp,
        };

        subjects[subject] = updatedSubject;

        const aggregatedSubjects = Object.values(subjects);
        const totalMarksObtainable = aggregatedSubjects.reduce(
          (sum, subjectRecord) => sum + (subjectRecord.totalObtainable ?? 100),
          0,
        );
        const totalMarksObtained = aggregatedSubjects.reduce(
          (sum, subjectRecord) => sum + (subjectRecord.total ?? 0),
          0,
        );
        const overallAverage =
          totalMarksObtainable > 0
            ? Number(
                ((totalMarksObtained / totalMarksObtainable) * 100).toFixed(2),
              )
            : undefined;

        const mergedRecord: StoredStudentMarkRecord = {
          studentId,
          studentName:
            studentName ??
            marksRecord?.studentName ??
            previousRecord?.studentName ??
            `Student ${studentId}`,
          className:
            className ?? previousRecord?.className ?? selectedClass ?? "",
          term: normalizedTerm,
          session: selectedSession,
          subjects,
          lastUpdated: timestamp,
          status:
            additionalData.studentStatus[studentId] ?? previousRecord?.status,
          numberInClass:
            additionalData.termInfo.numberInClass ||
            previousRecord?.numberInClass,
          overallAverage: overallAverage ?? previousRecord?.overallAverage,
          overallPosition: previousRecord?.overallPosition ?? null,
        };

        store[key] = mergedRecord;

        let reportCards: ReportCardRecord[] = [];
        try {
          const rawReportCards = safeStorage.getItem("reportCards");
          if (rawReportCards) {
            const parsed = JSON.parse(rawReportCards);
            if (Array.isArray(parsed)) {
              reportCards = parsed as ReportCardRecord[];
            }
          }
        } catch (parseError) {
          logger.warn("Unable to parse stored report cards", parseError);
        }

        const subjectRecords: ReportCardSubjectRecord[] = Object.values(
          subjects,
        ).map((subjectRecord) => ({
          name: subjectRecord.subject,
          ca1: subjectRecord.ca1,
          ca2: subjectRecord.ca2,
          assignment: subjectRecord.assignment,
          exam: subjectRecord.exam,
          total: subjectRecord.total,
          grade: subjectRecord.grade,
          remark: subjectRecord.remark,
          position: subjectRecord.position ?? null,
        }));

        const existingIndex = reportCards.findIndex(
          (record) =>
            record.studentId === studentId &&
            record.term === normalizedTerm &&
            record.session === selectedSession,
        );

        const existingRecord =
          existingIndex >= 0 ? reportCards[existingIndex] : null;
        const reportCardId =
          existingRecord?.id ??
          `report_${studentId}_${normalizedTerm}_${selectedSession}`;
        const headTeacherRemark = existingRecord?.headTeacherRemark ?? null;
        const studentRemarkEntriesForRecord =
          getStudentRemarkEntries(studentId);
        const classTeacherRemark =
          buildClassTeacherRemarkSummary(studentRemarkEntriesForRecord) ||
          marksRecord?.teacherRemark ||
          existingRecord?.classTeacherRemark ||
          "";

        const aggregatedRaw = buildRawReportCardFromStoredRecord(mergedRecord);

        const metadata =
          existingRecord &&
          typeof existingRecord.metadata === "object" &&
          existingRecord.metadata !== null
            ? { ...(existingRecord.metadata as Record<string, unknown>) }
            : {};

        if (aggregatedRaw) {
          metadata.enhancedReportCard = aggregatedRaw;
        }

        const updatedReportCard: ReportCardRecord = {
          id: reportCardId,
          studentId,
          studentName: mergedRecord.studentName,
          className: mergedRecord.className,
          term: normalizedTerm,
          session: selectedSession,
          subjects: subjectRecords,
          classTeacherRemark,
          headTeacherRemark,
          metadata,
          createdAt: existingRecord?.createdAt ?? timestamp,
          updatedAt: timestamp,
        };

        if (existingIndex >= 0) {
          reportCards[existingIndex] = updatedReportCard;
        } else {
          reportCards.push(updatedReportCard);
        }

        safeStorage.setItem(STUDENT_MARKS_STORAGE_KEY, JSON.stringify(store));
        safeStorage.setItem("reportCards", JSON.stringify(reportCards));
        emitMarksStoreUpdate(store);
        dbManager.triggerEvent("reportCardUpdated", updatedReportCard);
      } catch (error) {
        logger.error("Failed to sync assignment grade to report card", {
          error,
        });
      }
    },
    [
      additionalData.classTeacherRemarks,
      buildClassTeacherRemarkSummary,
      additionalData.studentStatus,
      additionalData.termInfo.numberInClass,
      emitMarksStoreUpdate,
      normalizedTermLabel,
      selectedClass,
      selectedSession,
      teacher.id,
      teacher.name,
    ],
  );

  const handleGradeSubmission = async (
    submission: AssignmentSubmissionRecord,
  ) => {
    if (!selectedAssignment) return;

    const assignmentMaxScore =
      selectedAssignment.maximumScore ?? assignmentMaximum;
    const draft = gradingDrafts[submission.id] ?? { score: "", comment: "" };
    const trimmedComment = draft.comment.trim();
    const trimmedScore = draft.score.trim();
    const hasScore = trimmedScore.length > 0;
    const parsedScore = hasScore ? Number(trimmedScore) : null;

    if (
      hasScore &&
      (Number.isNaN(parsedScore) || parsedScore === null || parsedScore < 0)
    ) {
      toast({
        variant: "destructive",
        title: "Invalid score",
        description: "Please enter a valid score or leave it blank.",
      });
      return;
    }

    if (parsedScore !== null && parsedScore > assignmentMaxScore) {
      toast({
        variant: "destructive",
        title: "Score too high",
        description: `The maximum obtainable score is ${assignmentMaxScore}.`,
      });
      return;
    }

    try {
      setGradingSubmissionId(submission.id);
      const normalizedScore =
        parsedScore === null ? null : Math.round(parsedScore * 100) / 100;
      const grade =
        normalizedScore === null
          ? null
          : deriveGradeFromScore(
              (normalizedScore / Math.max(assignmentMaxScore, 1)) * 100,
            );

      const updatedSubmission = await dbManager.gradeAssignmentSubmission(
        selectedAssignment.id,
        submission.studentId,
        {
          score: normalizedScore,
          grade,
          comment: trimmedComment || null,
        },
      );

      setSelectedAssignment((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          submissions: prev.submissions.map((entry) =>
            entry.id === submission.id
              ? { ...entry, ...updatedSubmission }
              : entry,
          ),
        };
      });

      setGradingDrafts((prev) => ({
        ...prev,
        [submission.id]: {
          score: normalizedScore === null ? "" : String(normalizedScore),
          comment: trimmedComment,
        },
      }));

      if (normalizedScore !== null) {
        const updatedMarksRecord = applyAssignmentScoreToMarksRecord(
          submission.studentId,
          normalizedScore,
        );
        const rosterEntry = assignmentRoster[submission.studentId];
        syncAssignmentScoreToReportCard({
          studentId: submission.studentId,
          studentName:
            rosterEntry?.name ??
            updatedMarksRecord?.studentName ??
            submission.studentId,
          className:
            rosterEntry?.className ?? selectedAssignment.className ?? null,
          subject: selectedAssignment.subject,
          score: normalizedScore,
          grade,
          maximumScore: assignmentMaxScore,
          marksRecord: updatedMarksRecord ?? undefined,
        });
      }

      toast({
        title: "Score saved",
        description:
          normalizedScore === null
            ? "Feedback saved without a score."
            : `Marked ${normalizedScore}/${assignmentMaxScore}${grade ? ` (${grade})` : ""}.`,
      });

      void loadAssignments();
    } catch (error) {
      logger.error("Failed to grade assignment submission", { error });
      toast({
        variant: "destructive",
        title: "Unable to save score",
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setGradingSubmissionId(null);
    }
  };

  const handleSaveAcademicRecords = async () => {
    try {
      if (!selectedClass || !selectedSubject) {
        toast({
          variant: "destructive",
          title: "Selection required",
          description:
            "Choose both a class and subject before saving academic entries.",
        });
        return;
      }

      if (!marksData.length) {
        toast({
          variant: "destructive",
          title: "No marks recorded",
          description: "Add student scores before saving academic entries.",
        });
        return;
      }

      setIsSavingAcademicRecords(true);
      await Promise.resolve(persistAcademicMarksToStorage());

      toast({
        title: "Academic entries saved",
        description:
          "Marks and subject remarks have been stored for the selected students.",
      });

      loadAdditionalData();
    } catch (error) {
      logger.error("Error saving academic entries", { error });
      toast({
        variant: "destructive",
        title: "Failed to save academic entries",
        description:
          "Please try again or contact the administrator if the issue persists.",
      });
    } finally {
      setIsSavingAcademicRecords(false);
    }
  };

  const handleSaveBehavioralAssessment = async () => {
    try {
      if (!selectedClass || !selectedSubject) {
        toast({
          variant: "destructive",
          title: "Selection required",
          description:
            "Please choose both a class and a subject before saving assessments.",
        });
        return;
      }

      const timestamp = new Date().toISOString();
      const termLabel = normalizedTermLabel;
      const existingData = JSON.parse(
        safeStorage.getItem("behavioralAssessments") || "{}",
      ) as Record<string, unknown>;

      marksData.forEach((student) => {
        const studentKey = `${student.studentId}-${termLabel}-${selectedSession}`;
        const storedAffective =
          additionalData.affectiveDomain[student.studentId] ??
          createBehavioralRecordSkeleton(AFFECTIVE_TRAITS);
        const storedPsychomotor =
          additionalData.psychomotorDomain[student.studentId] ??
          createBehavioralRecordSkeleton(PSYCHOMOTOR_SKILLS);

        const affectiveEntries: Record<string, boolean> = {};
        AFFECTIVE_TRAITS.forEach(({ key }) => {
          const canonicalKey =
            normalizeBehavioralDomainKey("affective", key) ?? key;
          const value = storedAffective[canonicalKey];
          affectiveEntries[canonicalKey] = Boolean(value);
        });

        const psychomotorEntries: Record<string, boolean> = {};
        PSYCHOMOTOR_SKILLS.forEach(({ key }) => {
          const canonicalKey =
            normalizeBehavioralDomainKey("psychomotor", key) ?? key;
          const value = storedPsychomotor[canonicalKey];
          psychomotorEntries[canonicalKey] = Boolean(value);
        });

        existingData[studentKey] = {
          studentId: student.studentId,
          studentName: student.studentName,
          class: selectedClass,
          subject: selectedSubject,
          term: termLabel,
          session: selectedSession,
          affectiveDomain: affectiveEntries,
          psychomotorDomain: psychomotorEntries,
          teacherId: teacher.id,
          timestamp,
        };
      });

      safeStorage.setItem(
        "behavioralAssessments",
        JSON.stringify(existingData),
      );

      persistAcademicMarksToStorage();

      toast({
        title: "Behavioral assessment saved",
        description:
          "Affective and psychomotor records have been updated for the selected students.",
      });
      loadAdditionalData();
    } catch (error) {
      logger.error("Error saving behavioral assessment", { error });
      toast({
        variant: "destructive",
        title: "Failed to save assessment",
        description:
          "Please try again or contact the administrator if the issue persists.",
      });
    }
  };

  const handleSaveAttendanceRecords = async () => {
    try {
      if (!selectedClass || !selectedSubject) {
        toast({
          variant: "destructive",
          title: "Selection required",
          description:
            "Please choose both a class and a subject before saving attendance records.",
        });
        return;
      }

      const timestamp = new Date().toISOString();
      const termLabel = normalizedTermLabel;
      const existingData = JSON.parse(
        safeStorage.getItem("attendancePositions") || "{}",
      ) as Record<string, unknown>;
      const normalizedTermInfo = {
        numberInClass: additionalData.termInfo.numberInClass.trim(),
        nextTermBegins: additionalData.termInfo.nextTermBegins,
        vacationEnds: additionalData.termInfo.vacationEnds,
        nextTermFees: additionalData.termInfo.nextTermFees,
        feesBalance: additionalData.termInfo.feesBalance,
      };

      marksData.forEach((student) => {
        const studentKey = `${student.studentId}-${termLabel}-${selectedSession}`;
        const attendanceStats = additionalData.attendance[
          student.studentId
        ] ?? {
          present: 0,
          absent: 0,
          total: 0,
        };

        const present = Number.isFinite(attendanceStats.present)
          ? attendanceStats.present
          : 0;
        const absent = Number.isFinite(attendanceStats.absent)
          ? attendanceStats.absent
          : 0;
        const total =
          Number.isFinite(attendanceStats.total) && attendanceStats.total > 0
            ? attendanceStats.total
            : present + absent;

        existingData[studentKey] = {
          studentId: student.studentId,
          studentName: student.studentName,
          class: selectedClass,
          subject: selectedSubject,
          term: termLabel,
          session: selectedSession,
          position: student.position ?? null,
          attendance: { present, absent, total },
          status: additionalData.studentStatus[student.studentId] ?? "promoted",
          termInfo: normalizedTermInfo,
          teacherId: teacher.id,
          timestamp,
        };
      });

      safeStorage.setItem("attendancePositions", JSON.stringify(existingData));

      persistAcademicMarksToStorage();

      toast({
        title: "Attendance saved",
        description:
          "Attendance records have been updated for the selected students.",
      });
      loadAdditionalData();
    } catch (error) {
      logger.error("Error saving attendance/position", { error });
      toast({
        variant: "destructive",
        title: "Failed to save attendance",
        description:
          "Please try again or contact the administrator if the issue persists.",
      });
    }
  };

  const handleSaveClassTeacherRemarks = async () => {
    try {
      if (!selectedClass || !selectedSubject) {
        toast({
          variant: "destructive",
          title: "Selection required",
          description:
            "Please choose both a class and a subject before saving teacher remarks.",
        });
        return;
      }

      const timestamp = new Date().toISOString();
      const termLabel = normalizedTermLabel;
      const existingData = JSON.parse(
        safeStorage.getItem("classTeacherRemarks") || "{}",
      ) as Record<string, unknown>;

      marksData.forEach((student) => {
        const studentKey = `${student.studentId}-${termLabel}-${selectedSession}`;
        const remarkEntries = getStudentRemarkEntries(student.studentId);
        const remarkSummary = buildClassTeacherRemarkSummary(remarkEntries);
        const remarksBySubject = remarkEntries.reduce(
          (
            acc: Record<
              string,
              {
                label: string;
                remark: ClassTeacherRemarkValue;
              }
            >,
            entry,
          ) => {
            const subjectOption = subjectOptionByKey.get(entry.subjectKey);
            const label =
              subjectOption?.subject ??
              (entry.subjectKey === "general" ? "General" : entry.subjectKey);
            acc[entry.subjectKey] = { label, remark: entry.remark };
            return acc;
          },
          {},
        );
        const remarkAssignments = remarkEntries.reduce(
          (acc, entry) => {
            acc[entry.key] = { remark: entry.remark };
            return acc;
          },
          {} as Record<string, ClassTeacherRemarkEntry>,
        );

        existingData[studentKey] = {
          studentId: student.studentId,
          studentName: student.studentName,
          class: selectedClass,
          subject: selectedSubject,
          term: termLabel,
          session: selectedSession,
          remark: remarkSummary,
          remarksBySubject,
          remarkAssignments,
          teacherId: teacher.id,
          timestamp,
        };
      });

      safeStorage.setItem("classTeacherRemarks", JSON.stringify(existingData));

      persistAcademicMarksToStorage();

      toast({
        title: "Remarks saved",
        description:
          "Class teacher remarks have been updated for the selected students.",
      });
      loadAdditionalData();
    } catch (error) {
      logger.error("Error saving class teacher remarks", { error });
      toast({
        variant: "destructive",
        title: "Failed to save remarks",
        description:
          "Please try again or contact the administrator if the issue persists.",
      });
    }
  };

  const [isHardRefreshing, setIsHardRefreshing] = useState(false);
  const isHardRefreshingRef = useRef(false);

  const handleHardRefresh = useCallback(async () => {
    if (isHardRefreshingRef.current) {
      return;
    }

    isHardRefreshingRef.current = true;
    setIsHardRefreshing(true);

    try {
      if (typeof onRefreshAssignments === "function") {
        try {
          await onRefreshAssignments();
        } catch (callbackError) {
          logger.warn("Teacher assignment refresh callback failed", {
            error: callbackError,
          });
        }
      }

      const results = await Promise.allSettled([
        fetchAssignedSubjects(),
        refreshTeacherStudents(),
        loadAssignments(),
        loadExams(),
        loadTimetable(),
      ]);

      const failures = results.filter(
        (result) =>
          result.status === "rejected" ||
          (result.status === "fulfilled" && result.value === false),
      );

      if (failures.length > 0) {
        failures.forEach((failure) => {
          logger.error("Teacher dashboard refresh task failed", {
            error: failure.status === "rejected" ? failure.reason : undefined,
          });
        });
        toast({
          variant: "destructive",
          title: "Refresh incomplete",
          description:
            "Some teacher records could not be updated. Please try again shortly.",
        });
        return;
      }

      toast({
        title: "Dashboard updated",
        description:
          "Your classes, subjects, and student lists are now up to date.",
      });
    } finally {
      isHardRefreshingRef.current = false;
      setIsHardRefreshing(false);
    }
  }, [
    fetchAssignedSubjects,
    loadAssignments,
    loadExams,
    loadTimetable,
    onRefreshAssignments,
    refreshTeacherStudents,
    toast,
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2d682d] to-[#b29032] text-white p-6 rounded-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Welcome, {teacher.name}</h1>
            <div className="text-green-100 text-sm sm:text-base space-y-1">
              <p>Subjects: {subjectSummary}</p>
              <p>Classes: {classSummary}</p>
              <p>Students: {studentSummary}</p>
              <p>Exams: {examSummary}</p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <Button
              type="button"
              onClick={() => {
                void handleHardRefresh();
              }}
              disabled={isHardRefreshing}
              className="bg-white/10 text-white hover:bg-white/20"
            >
              {isHardRefreshing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Hard Refresh
            </Button>
            <TutorialLink
              href="https://www.youtube.com/watch?v=HkyVTxH2fIM"
              variant="inverse"
            />
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      {selectedTab === "overview" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="relative overflow-hidden border border-green-100/60 bg-gradient-to-br from-white via-white to-green-50 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Students</p>
                  <div className="mt-2 flex items-center gap-2 text-3xl font-semibold text-[#2d682d]">
                    {isTeacherStudentsLoading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <span>{teacherStudents.length}</span>
                    )}
                  </div>
                </div>
                <div className="rounded-full bg-[#2d682d]/10 p-3 text-[#2d682d]">
                  <Users className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border border-amber-100/60 bg-gradient-to-br from-white via-white to-amber-50 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Subjects</p>
                  <div className="mt-2 flex items-center gap-2 text-3xl font-semibold text-[#b29032]">
                    {isTeacherSubjectsLoading &&
                    teacherSubjects.length === 0 ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <span>{teacherSubjects.length}</span>
                    )}
                  </div>
                </div>
                <div className="rounded-full bg-[#b29032]/10 p-3 text-[#b29032]">
                  <BookOpen className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border border-green-100/60 bg-gradient-to-br from-white via-white to-green-50 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Classes</p>
                  <div className="mt-2 flex items-center gap-2 text-3xl font-semibold text-[#2d682d]">
                    {isContextLoading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <span>{teacherClasses.length}</span>
                    )}
                  </div>
                </div>
                <div className="rounded-full bg-[#2d682d]/10 p-3 text-[#2d682d]">
                  <GraduationCap className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border border-amber-100/60 bg-gradient-to-br from-white via-white to-amber-50 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Exams</p>
                  <div className="mt-2 flex items-center gap-2 text-3xl font-semibold text-[#b29032]">
                    {isExamLoading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <span>{teacherExams.length}</span>
                    )}
                  </div>
                </div>
                <div className="rounded-full bg-[#b29032]/10 p-3 text-[#b29032]">
                  <FileText className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Main Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <div className="w-full overflow-x-auto">
          <TabsList className="flex w-max flex-nowrap gap-1 bg-green-50 p-1">
            <TabsTrigger
              value="overview"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="profile"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Profile
            </TabsTrigger>
            <TabsTrigger
              value="marks"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Enter Marks
            </TabsTrigger>
            <TabsTrigger
              value="assignments"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Assignments
            </TabsTrigger>
            <TabsTrigger
              value="students"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Students
            </TabsTrigger>
            <TabsTrigger
              value="timetable"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Timetable
            </TabsTrigger>
            <TabsTrigger
              value="materials"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Materials
            </TabsTrigger>
            <TabsTrigger
              value="noticeboard"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Noticeboard
            </TabsTrigger>
            <TabsTrigger
              value="messages"
              className="min-w-[120px] px-3 text-xs data-[state=active]:bg-[#2d682d] data-[state=active]:text-white"
            >
              Messages
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-[#2d682d]">My Classes</CardTitle>
              </CardHeader>
              <CardContent>
                {isContextLoading ? (
                  <p className="text-sm text-gray-600">
                    Loading your class assignments...
                  </p>
                ) : teacherClasses.length === 0 ? (
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>
                      {contextError ??
                        "You are not assigned to any class. Contact your administrator."}
                    </p>
                    {onRefreshAssignments ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-[#2d682d]/30 text-[#2d682d]"
                        onClick={() => onRefreshAssignments()}
                      >
                        Refresh assignments
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {teacherClasses.map((classItem, index) => (
                      <div
                        key={classItem.id ?? index}
                        className="flex justify-between items-center p-2 bg-gray-50 rounded"
                      >
                        <span>{classItem.name}</span>
                        <Badge variant="outline">
                          {classItem.subjects.length > 0
                            ? classItem.subjects.slice(0, 2).join(", ")
                            : "Subjects not set"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <ExamScheduleOverview
              role="teacher"
              title="Upcoming Exams"
              description="Next scheduled assessments across your assigned classes."
              classNames={teacherClassNames}
              classIds={teacherClassIds}
              className="h-full"
              emptyState="No upcoming exams scheduled for your classes."
              limit={4}
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-[#2d682d]">
                  Assigned Students
                </CardTitle>
                <CardDescription>
                  Quick view of students linked to your classes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isTeacherStudentsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading your
                    students...
                  </div>
                ) : teacherStudentsError ? (
                  <p className="text-sm text-red-600">{teacherStudentsError}</p>
                ) : teacherStudents.length === 0 ? (
                  <p className="text-sm text-gray-600">
                    {teacherStudentsMessage ??
                      "No students found for your assigned classes yet."}
                  </p>
                ) : (
                  <>
                    <div>
                      <p className="text-2xl font-semibold text-[#2d682d]">
                        {teacherStudents.length}
                      </p>
                      <p className="text-sm text-gray-600">
                        Students across your assigned classes
                      </p>
                    </div>
                    <div className="space-y-2">
                      {teacherStudents.slice(0, 3).map((student) => (
                        <div
                          key={student.id}
                          className="flex flex-col text-sm text-gray-700"
                        >
                          <span className="font-medium text-gray-900">
                            {student.name}
                          </span>
                          <span className="text-gray-600">
                            {student.className
                              ? student.className
                              : "Class not set"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <Button
                  variant="outline"
                  className="inline-flex items-center gap-2"
                  onClick={() => setSelectedTab("students")}
                >
                  <Users className="h-4 w-4" /> View all students
                </Button>
              </CardContent>
            </Card>
          </div>

          <SchoolCalendarViewer role="teacher" />

          <NotificationCenter userRole="teacher" userId={teacher.id} />
        </TabsContent>

        {/* Profile tab */}
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">My Profile</CardTitle>
              <CardDescription>View your profile information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-[#2d682d] rounded-full flex items-center justify-center">
                    <User className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium">{teacher.name}</h3>
                    <p className="text-gray-600">{teacher.email}</p>
                    <p className="text-sm text-gray-500">
                      Teacher ID: TCH{teacher.id}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Subjects
                    </label>
                    <div className="flex gap-1 mt-1">
                      {teacherSubjects.map((subject, index) => (
                        <Badge key={index} variant="secondary">
                          {subject}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Classes
                    </label>
                    <div className="flex gap-1 mt-1">
                      {teacherClasses.map((classItem, index) => (
                        <Badge key={classItem.id ?? index} variant="outline">
                          {classItem.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">
                Digital Signature
              </CardTitle>
              <CardDescription>
                Upload a clear scan of your handwritten signature to personalise
                report cards.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-32 w-32 items-center justify-center rounded-md border border-dashed border-[#2d682d]/40 bg-muted/40 p-3">
                  {teacherSignature.url ? (
                    <img
                      src={teacherSignature.url}
                      alt="Uploaded teacher signature"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-center text-xs text-gray-500">
                      No signature uploaded yet
                    </span>
                  )}
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>
                    This signature appears in the{" "}
                    <strong>Teacher&apos;s Signature</strong> section of every
                    generated report card preview.
                  </p>
                  {teacherSignature.fileName ? (
                    <div className="rounded-md border border-dashed border-[#2d682d]/30 bg-[#f8faf8] p-3 text-xs text-gray-600">
                      <p>
                        <span className="font-semibold text-gray-700">
                          File:
                        </span>{" "}
                        {teacherSignature.fileName}
                      </p>
                      {teacherSignatureUploadedAtLabel ? (
                        <p>
                          <span className="font-semibold text-gray-700">
                            Uploaded:
                          </span>{" "}
                          {teacherSignatureUploadedAtLabel}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">
                      Accepted formats: PNG, JPG or SVG up to 1.5MB.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={signatureFileInputRef}
                  id={signatureInputId}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                  className="hidden"
                  onChange={handleTeacherSignatureFileChange}
                  disabled={isUploadingSignature}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => signatureFileInputRef.current?.click()}
                  disabled={isUploadingSignature}
                  className="inline-flex items-center gap-2"
                >
                  {isUploadingSignature ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UploadCloud className="h-4 w-4" />
                  )}
                  {isUploadingSignature
                    ? "Uploading..."
                    : teacherSignature.url
                      ? "Replace Signature"
                      : "Upload Signature"}
                </Button>
                {teacherSignature.url ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleRemoveTeacherSignature}
                    disabled={isUploadingSignature}
                    className="inline-flex items-center gap-2 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="marks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">
                Enter Student Marks & Report Card Details
              </CardTitle>
              <CardDescription>
                Enter comprehensive assessment data that will appear on report
                cards
              </CardDescription>
              {teacherSubjectsError ? (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {teacherSubjectsError}
                </div>
              ) : hasCompletedSubjectFetch && !hasAvailableSubjects ? (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <p className="font-semibold">
                    No subjects available for marking.
                  </p>
                  <p>
                    Please contact the admin to assign subjects before entering
                    marks.
                  </p>
                </div>
              ) : null}
              {selectedClass && selectedSubject && (
                <div className="mt-2">
                  <Badge
                    variant={
                      currentStatus.status === "approved"
                        ? "default"
                        : currentStatus.status === "pending"
                          ? "secondary"
                          : currentStatus.status === "revoked"
                            ? "destructive"
                            : "outline"
                    }
                    className="text-sm"
                  >
                    Status:{" "}
                    {currentStatus.status.charAt(0).toUpperCase() +
                      currentStatus.status.slice(1)}
                  </Badge>
                  {currentStatus.status === "revoked" &&
                    currentStatus.message && (
                      <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-700 font-medium">
                          Admin Feedback:
                        </p>
                        <p className="text-sm text-red-600">
                          {currentStatus.message}
                        </p>
                      </div>
                    )}
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                    <Button
                      variant="outline"
                      className="w-full justify-center sm:w-auto sm:justify-start"
                      onClick={() => void handleSaveDraft()}
                      disabled={isSavingDraft || isSubmittingForApproval}
                    >
                      {isSavingDraft ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Save Progress
                    </Button>
                    <Button
                      className="w-full justify-center bg-[#2d682d] text-white hover:bg-[#1f4a1f] sm:w-auto sm:justify-start"
                      onClick={() => void handleSubmitForApproval()}
                      disabled={
                        isSavingDraft ||
                        isSubmittingForApproval ||
                        currentStatus.status === "pending" ||
                        currentStatus.status === "approved"
                      }
                    >
                      {isSubmittingForApproval ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="mr-2 h-4 w-4" />
                      )}
                      {currentStatus.status === "approved"
                        ? "Published"
                        : currentStatus.status === "pending"
                          ? "Awaiting Approval"
                          : "Send for Approval"}
                    </Button>
                    {currentStatus.status === "revoked" && (
                      <Button
                        variant="outline"
                        className="w-full justify-center sm:w-auto sm:justify-start"
                        onClick={() => void handleSubmitForApproval()}
                        disabled={isSavingDraft || isSubmittingForApproval}
                      >
                        Resubmit to Admin
                      </Button>
                    )}
                    {currentStatus.status === "pending" && (
                      <Button
                        variant="ghost"
                        className="w-full justify-center sm:w-auto sm:justify-start"
                        onClick={() => void handleCancelSubmission()}
                        disabled={isCancellingSubmission}
                      >
                        {isCancellingSubmission ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Cancel Submission
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Selection Controls */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <Label>Class</Label>
                    <Select
                      value={selectedClass}
                      onValueChange={handleSelectClass}
                      disabled={noClassesAssigned || isContextLoading}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select Class" />
                      </SelectTrigger>
                      <SelectContent>
                        {noClassesAssigned ? (
                          <SelectItem value="__no_classes__" disabled>
                            {isContextLoading
                              ? "Loading..."
                              : "No classes available"}
                          </SelectItem>
                        ) : (
                          teacherClasses.map((classItem) => (
                            <SelectItem
                              key={`${classItem.id}-${classItem.name}`}
                              value={classItem.name}
                            >
                              {classItem.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {noClassesAssigned && !isContextLoading ? (
                      <p className="mt-2 text-sm text-gray-600">
                        {contextError ??
                          "You are not assigned to any class. Contact your administrator."}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <Label>Select Subject to Enter Marks</Label>
                    <Select
                      value={selectedSubjectKey}
                      onValueChange={handleSelectSubject}
                      disabled={isSubjectSelectDisabled}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={subjectSelectPlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {isTeacherSubjectsLoading ? (
                          <SelectItem value="__loading_subjects__" disabled>
                            Loading subjects...
                          </SelectItem>
                        ) : hasAvailableSubjects ? (
                          availableSubjectOptions.map((option) => (
                            <SelectItem key={option.key} value={option.key}>
                              {option.label}
                            </SelectItem>
                          ))
                        ) : hasCompletedSubjectFetch ? (
                          <SelectItem value="__no_subjects__" disabled>
                            No subjects assigned. Please contact the admin.
                          </SelectItem>
                        ) : (
                          <SelectItem value="__pending_subjects__" disabled>
                            Loading subjects...
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-8 justify-start px-2 text-xs text-[#2d682d] hover:bg-[#2d682d]/10"
                      onClick={() => setIsSubjectSwitcherOpen(true)}
                      disabled={
                        isSubjectSelectDisabled || !hasAvailableSubjects
                      }
                    >
                      <ArrowRightLeft className="mr-2 h-3.5 w-3.5" />
                      Switch subject
                    </Button>
                    {isTeacherSubjectsLoading ? (
                      <p className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                        <Loader2 className="h-3 w-3 animate-spin" /> Updating
                        your subject list…
                      </p>
                    ) : teacherSubjectsError ? (
                      <p className="mt-2 text-xs text-amber-600">
                        {teacherSubjectsError}
                      </p>
                    ) : !hasAvailableSubjects && hasCompletedSubjectFetch ? (
                      <p className="mt-2 text-xs text-amber-600">
                        No subjects assigned. Please contact the admin.
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <Label>Term</Label>
                    <Select
                      value={selectedTerm}
                      onValueChange={setSelectedTerm}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="first">First Term</SelectItem>
                        <SelectItem value="second">Second Term</SelectItem>
                        <SelectItem value="third">Third Term</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Session</Label>
                    <Select
                      value={selectedSession}
                      onValueChange={setSelectedSession}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2024/2025">2024/2025</SelectItem>
                        <SelectItem value="2023/2024">2023/2024</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Tabs defaultValue="academic" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 gap-2 bg-transparent p-0 sm:bg-muted sm:p-[3px] xl:grid-cols-4">
                    <TabsTrigger
                      value="academic"
                      className="h-auto w-full justify-start whitespace-normal rounded-md px-4 py-3 text-left text-sm leading-snug sm:h-[calc(100%-1px)]"
                    >
                      Academic Marks
                    </TabsTrigger>
                    <TabsTrigger
                      value="behavioral"
                      className="h-auto w-full justify-start whitespace-normal rounded-md px-4 py-3 text-left text-sm leading-snug sm:h-[calc(100%-1px)]"
                    >
                      Behavioral Assessment
                    </TabsTrigger>
                    <TabsTrigger
                      value="attendance"
                      className="h-auto w-full justify-start whitespace-normal rounded-md px-4 py-3 text-left text-sm leading-snug sm:h-[calc(100%-1px)]"
                    >
                      Attendance &amp; Position
                    </TabsTrigger>
                    <TabsTrigger
                      value="remarks"
                      className="h-auto w-full justify-start whitespace-normal rounded-md px-4 py-3 text-left text-sm leading-snug sm:h-[calc(100%-1px)]"
                    >
                      Class Teacher Remarks
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="academic" className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs leading-relaxed text-gray-500">
                        {assessmentWeightingSummary
                          ? `Assessment weighting: ${assessmentWeightingSummary}.`
                          : "Assessment columns will appear once your administrator configures them."}
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                        <Button
                          variant="outline"
                          className="w-full justify-center border-dashed border-[#2d682d] text-[#2d682d] hover:bg-[#2d682d]/10 sm:w-auto sm:justify-start"
                          onClick={handleOpenAddStudentDialog}
                          disabled={!selectedClass || !hasAvailableSubjects}
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          Add Student Entry
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full justify-center border-[#2d682d] text-[#2d682d] hover:bg-[#2d682d]/10 sm:w-auto sm:justify-start"
                          onClick={handleSaveAcademicRecords}
                          disabled={
                            isSavingAcademicRecords ||
                            currentStatus.status === "pending" ||
                            currentStatus.status === "approved"
                          }
                        >
                          {isSavingAcademicRecords ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="mr-2 h-4 w-4" />
                          )}
                          Save Academic Entries
                        </Button>
                        <Button
                          className="w-full justify-center bg-[#2d682d] text-white hover:bg-[#245224] sm:w-auto sm:justify-start"
                          onClick={handleSyncAcademicMarks}
                          disabled={isSyncingGrades}
                        >
                          {isSyncingGrades ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="mr-2 h-4 w-4" />
                          )}
                          Sync to Exam Management
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                      <Table className="min-w-[1100px] text-xs">
                        <TableHeader className="bg-muted/60">
                          <TableRow className="divide-x divide-gray-200">
                            <TableHead className="w-56 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                              Student Name
                            </TableHead>
                            {hasFirstTestColumn && (
                              <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                                {firstTestMaximum > 0
                                  ? `${firstTestLabel} (${firstTestMaximum})`
                                  : firstTestLabel}
                              </TableHead>
                            )}
                            {hasSecondTestColumn && (
                              <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                                {secondTestMaximum > 0
                                  ? `${secondTestLabel} (${secondTestMaximum})`
                                  : secondTestLabel}
                              </TableHead>
                            )}
                            {hasAssignmentColumn && (
                              <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                                {assignmentMaximum > 0
                                  ? `${assignmentLabel} (${assignmentMaximum})`
                                  : assignmentLabel}
                              </TableHead>
                            )}
                            {hasContinuousColumns && (
                              <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                                {continuousAssessmentMaximum > 0
                                  ? `C.A. Total (${continuousAssessmentMaximum})`
                                  : "C.A. Total"}
                              </TableHead>
                            )}
                            {hasExamColumn && (
                              <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                                {examMaximum > 0
                                  ? `${examLabel} (${examMaximum})`
                                  : examLabel}
                              </TableHead>
                            )}
                            <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                              {defaultTotalMaximum > 0
                                ? `Grand Total (${defaultTotalMaximum})`
                                : "Grand Total"}
                            </TableHead>
                            <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                              Total Obtainable
                            </TableHead>
                            <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                              Total Obtained
                            </TableHead>
                            <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                              Average %
                            </TableHead>
                            <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                              Position
                            </TableHead>
                            <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                              Grade
                            </TableHead>
                            <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                              Preview
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {marksData.map((student) => (
                            <TableRow
                              key={student.studentId}
                              className="divide-x divide-gray-100"
                            >
                              <TableCell className="font-medium text-gray-800">
                                {student.studentName}
                              </TableCell>
                              {hasFirstTestColumn && (
                                <TableCell>
                                  <Input
                                    type="number"
                                    max={firstTestMaximum || undefined}
                                    value={student.firstCA}
                                    onChange={(e) =>
                                      handleMarksUpdate(
                                        student.studentId,
                                        "firstCA",
                                        Number.parseInt(e.target.value) || 0,
                                      )
                                    }
                                    className="h-9 w-full text-xs"
                                    disabled={
                                      currentStatus.status === "pending" ||
                                      currentStatus.status === "approved"
                                    }
                                  />
                                </TableCell>
                              )}
                              {hasSecondTestColumn && (
                                <TableCell>
                                  <Input
                                    type="number"
                                    max={secondTestMaximum || undefined}
                                    value={student.secondCA}
                                    onChange={(e) =>
                                      handleMarksUpdate(
                                        student.studentId,
                                        "secondCA",
                                        Number.parseInt(e.target.value) || 0,
                                      )
                                    }
                                    className="h-9 w-full text-xs"
                                    disabled={
                                      currentStatus.status === "pending" ||
                                      currentStatus.status === "approved"
                                    }
                                  />
                                </TableCell>
                              )}
                              {hasAssignmentColumn && (
                                <TableCell>
                                  <Input
                                    type="number"
                                    max={assignmentMaximum || undefined}
                                    value={student.noteAssignment}
                                    onChange={(e) =>
                                      handleMarksUpdate(
                                        student.studentId,
                                        "noteAssignment",
                                        Number.parseInt(e.target.value) || 0,
                                      )
                                    }
                                    className="h-9 w-full text-xs"
                                    disabled={
                                      currentStatus.status === "pending" ||
                                      currentStatus.status === "approved"
                                    }
                                  />
                                </TableCell>
                              )}
                              {hasContinuousColumns && (
                                <TableCell className="text-center font-semibold text-[#2d682d]">
                                  {student.caTotal}
                                </TableCell>
                              )}
                              {hasExamColumn && (
                                <TableCell>
                                  <Input
                                    type="number"
                                    max={examMaximum || undefined}
                                    value={student.exam}
                                    onChange={(e) =>
                                      handleMarksUpdate(
                                        student.studentId,
                                        "exam",
                                        Number.parseInt(e.target.value) || 0,
                                      )
                                    }
                                    className="h-9 w-full text-xs"
                                    disabled={
                                      currentStatus.status === "pending" ||
                                      currentStatus.status === "approved"
                                    }
                                  />
                                </TableCell>
                              )}
                              <TableCell className="text-center font-semibold text-[#b29032]">
                                {student.grandTotal}
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={student.totalMarksObtainable}
                                  onChange={(e) =>
                                    handleMarksUpdate(
                                      student.studentId,
                                      "totalMarksObtainable",
                                      Number.parseInt(e.target.value) || 100,
                                    )
                                  }
                                  className="h-9 w-full text-xs"
                                  disabled={
                                    currentStatus.status === "pending" ||
                                    currentStatus.status === "approved"
                                  }
                                />
                              </TableCell>
                              <TableCell className="text-center font-semibold text-blue-600">
                                {student.totalMarksObtained}
                              </TableCell>
                              <TableCell className="text-center font-semibold text-purple-600">
                                {student.averageScore}%
                              </TableCell>
                              <TableCell className="text-center font-semibold text-orange-600">
                                #{student.position}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge
                                  variant={
                                    student.grade === "A"
                                      ? "default"
                                      : student.grade === "F"
                                        ? "destructive"
                                        : "secondary"
                                  }
                                  className="text-xs"
                                >
                                  {student.grade}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs"
                                  onClick={() => openPreviewForStudent(student)}
                                >
                                  Preview
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="mt-4 grid max-[359px]:grid-cols-2 grid-cols-3 gap-4 xl:grid-cols-4">
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-sm font-medium text-gray-600">
                            Class Average
                          </div>
                          <div className="text-2xl font-bold text-[#2d682d]">
                            {marksData.length > 0
                              ? Math.round(
                                  marksData.reduce(
                                    (sum, student) =>
                                      sum + student.averageScore,
                                    0,
                                  ) / marksData.length,
                                )
                              : 0}
                            %
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-sm font-medium text-gray-600">
                            Highest Score
                          </div>
                          <div className="text-2xl font-bold text-[#b29032]">
                            {marksData.length > 0
                              ? Math.max(...marksData.map((s) => s.grandTotal))
                              : 0}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-sm font-medium text-gray-600">
                            Lowest Score
                          </div>
                          <div className="text-2xl font-bold text-red-600">
                            {marksData.length > 0
                              ? Math.min(...marksData.map((s) => s.grandTotal))
                              : 0}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <div className="text-sm font-medium text-gray-600">
                            Pass Rate
                          </div>
                          <div className="text-2xl font-bold text-green-600">
                            {marksData.length > 0
                              ? Math.round(
                                  (marksData.filter((s) => s.grade !== "F")
                                    .length /
                                    marksData.length) *
                                    100,
                                )
                              : 0}
                            %
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                    {marksData.length > 0 && (
                      <Card className="mt-4">
                        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <CardTitle className="text-sm text-[#2d682d]">
                              Cumulative Snapshots
                            </CardTitle>
                            <CardDescription className="text-xs text-gray-500">
                              These summaries are bundled with your submission
                              to help admins and parents review progress.
                            </CardDescription>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="self-start md:self-auto"
                            onClick={() => void generateCumulativeSummaries()}
                            disabled={isGeneratingCumulative}
                          >
                            {isGeneratingCumulative ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="mr-2 h-4 w-4" />
                            )}
                            {isGeneratingCumulative ? "Generating" : "Refresh"}
                          </Button>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {marksData.map((student) => {
                            const summary =
                              cumulativeSummaries[String(student.studentId)];
                            return (
                              <div
                                key={student.studentId}
                                className="flex flex-col gap-3 rounded-lg border border-dashed border-[#2d682d]/20 p-3 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div>
                                  <p className="text-sm font-semibold text-[#2d682d]">
                                    {student.studentName}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    ID: {student.studentId}
                                  </p>
                                </div>
                                {summary ? (
                                  <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
                                    <span className="font-medium text-[#2d682d]">
                                      {summary.average}% Avg
                                    </span>
                                    <Badge
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      {summary.grade}
                                    </Badge>
                                    <span className="text-gray-600">
                                      Position {summary.position}/
                                      {summary.totalStudents}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 text-xs text-gray-500">
                                    {isGeneratingCumulative ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Clock className="h-4 w-4" />
                                    )}
                                    <span>Pending update</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="behavioral" className="space-y-4">
                    <div className="space-y-4">
                      {marksData.map((student) => (
                        <Card key={student.studentId}>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm text-[#2d682d]">
                              {student.studentName}
                            </CardTitle>
                            <CardDescription className="text-xs text-gray-500">
                              Provide affective and psychomotor ratings for this
                              term.
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-5">
                            <div>
                              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                                Affective Domain
                              </p>
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {AFFECTIVE_TRAITS.map(({ key, label }) => {
                                  const fieldId = `affective-${student.studentId}-${key}`;
                                  const checked = Boolean(
                                    additionalData.affectiveDomain[
                                      student.studentId
                                    ]?.[key],
                                  );
                                  return (
                                    <div
                                      key={key}
                                      className="flex items-start gap-3 rounded-md border border-dashed border-emerald-200/70 bg-emerald-50/30 p-3"
                                    >
                                      <Checkbox
                                        id={fieldId}
                                        checked={checked}
                                        onCheckedChange={(nextValue) =>
                                          setAdditionalData((prev) => {
                                            const previous =
                                              prev.affectiveDomain[
                                                student.studentId
                                              ] ??
                                              createEmptyBehavioralRecord(
                                                AFFECTIVE_TRAITS,
                                              );

                                            return {
                                              ...prev,
                                              affectiveDomain: {
                                                ...prev.affectiveDomain,
                                                [student.studentId]: {
                                                  ...previous,
                                                  [key]: nextValue === true,
                                                },
                                              },
                                            };
                                          })
                                        }
                                      />
                                      <Label
                                        htmlFor={fieldId}
                                        className="text-xs font-medium text-gray-700"
                                      >
                                        {label}
                                      </Label>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                                Psychomotor Domain
                              </p>
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {PSYCHOMOTOR_SKILLS.map(({ key, label }) => {
                                  const fieldId = `psychomotor-${student.studentId}-${key}`;
                                  const checked = Boolean(
                                    additionalData.psychomotorDomain[
                                      student.studentId
                                    ]?.[key],
                                  );
                                  return (
                                    <div
                                      key={key}
                                      className="flex items-start gap-3 rounded-md border border-dashed border-blue-200/70 bg-blue-50/40 p-3"
                                    >
                                      <Checkbox
                                        id={fieldId}
                                        checked={checked}
                                        onCheckedChange={(nextValue) =>
                                          setAdditionalData((prev) => {
                                            const previous =
                                              prev.psychomotorDomain[
                                                student.studentId
                                              ] ??
                                              createEmptyBehavioralRecord(
                                                PSYCHOMOTOR_SKILLS,
                                              );

                                            return {
                                              ...prev,
                                              psychomotorDomain: {
                                                ...prev.psychomotorDomain,
                                                [student.studentId]: {
                                                  ...previous,
                                                  [key]: nextValue === true,
                                                },
                                              },
                                            };
                                          })
                                        }
                                      />
                                      <Label
                                        htmlFor={fieldId}
                                        className="text-xs font-medium text-gray-700"
                                      >
                                        {label}
                                      </Label>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    <div className="flex justify-end mt-2">
                      <Button
                        onClick={handleSaveBehavioralAssessment}
                        className="bg-[#2d682d] hover:bg-[#1f4a1f] text-white"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save Behavioral Assessment
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="attendance" className="space-y-4">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">
                            Attendance Record
                          </CardTitle>
                          <CardDescription className="text-xs">
                            These values are used to calculate attendance
                            percentage.
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {marksData.map((student) => {
                            const stats = additionalData.attendance[
                              student.studentId
                            ] ?? {
                              present: 0,
                              absent: 0,
                              total: 0,
                            };
                            const totalDays =
                              stats.total && stats.total > 0
                                ? stats.total
                                : stats.present + stats.absent;
                            const percentage =
                              totalDays > 0
                                ? Math.round((stats.present / totalDays) * 100)
                                : 0;

                            return (
                              <div
                                key={student.studentId}
                                className="mb-4 rounded-lg border p-3"
                              >
                                <p className="font-medium text-sm mb-2">
                                  {student.studentName}
                                </p>
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <Label className="text-xs">Present</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      value={stats.present}
                                      onChange={(e) =>
                                        setAdditionalData((prev) => {
                                          const previous = prev.attendance[
                                            student.studentId
                                          ] ?? {
                                            present: 0,
                                            absent: 0,
                                            total: 0,
                                          };
                                          return {
                                            ...prev,
                                            attendance: {
                                              ...prev.attendance,
                                              [student.studentId]: {
                                                ...previous,
                                                present:
                                                  Number.parseInt(
                                                    e.target.value,
                                                    10,
                                                  ) || 0,
                                              },
                                            },
                                          };
                                        })
                                      }
                                      className="h-8 text-xs"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Absent</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      value={stats.absent}
                                      onChange={(e) =>
                                        setAdditionalData((prev) => {
                                          const previous = prev.attendance[
                                            student.studentId
                                          ] ?? {
                                            present: 0,
                                            absent: 0,
                                            total: 0,
                                          };
                                          return {
                                            ...prev,
                                            attendance: {
                                              ...prev.attendance,
                                              [student.studentId]: {
                                                ...previous,
                                                absent:
                                                  Number.parseInt(
                                                    e.target.value,
                                                    10,
                                                  ) || 0,
                                              },
                                            },
                                          };
                                        })
                                      }
                                      className="h-8 text-xs"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">
                                      Total Days
                                    </Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      value={stats.total}
                                      onChange={(e) =>
                                        setAdditionalData((prev) => {
                                          const previous = prev.attendance[
                                            student.studentId
                                          ] ?? {
                                            present: 0,
                                            absent: 0,
                                            total: 0,
                                          };
                                          return {
                                            ...prev,
                                            attendance: {
                                              ...prev.attendance,
                                              [student.studentId]: {
                                                ...previous,
                                                total:
                                                  Number.parseInt(
                                                    e.target.value,
                                                    10,
                                                  ) || 0,
                                              },
                                            },
                                          };
                                        })
                                      }
                                      className="h-8 text-xs"
                                    />
                                  </div>
                                </div>
                                <p className="text-[11px] text-gray-500 mt-2">
                                  Attendance: {percentage}% ({stats.present} /{" "}
                                  {totalDays || 0})
                                </p>
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        onClick={handleSaveAttendanceRecords}
                        className="bg-[#2d682d] hover:bg-[#1f4a1f] text-white"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save Attendance Records
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="remarks" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">
                          Subject Remarks
                        </CardTitle>
                        <CardDescription>
                          Assign quick subject remarks for{" "}
                          <span className="font-semibold text-emerald-700">
                            {selectedSubjectOption?.label ??
                              (selectedSubject || "the selected subject")}
                          </span>
                          . These remarks mirror what appears in the academic
                          marks table.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {marksData.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-muted-foreground/40 bg-muted/40 p-4 text-sm text-muted-foreground">
                            {selectedSubject
                              ? "No student records loaded for this subject yet. Save academic entries to begin."
                              : "Select a subject above to start adding remarks."}
                          </div>
                        ) : (
                          <>
                            <div className="space-y-3">
                              {marksData.map((student) => (
                                <div
                                  key={student.studentId}
                                  className="rounded-lg border border-emerald-100 bg-white p-3 shadow-sm"
                                >
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="space-y-1">
                                      <p className="text-sm font-semibold text-slate-900">
                                        {student.studentName}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Select the remark that best fits{" "}
                                        <span className="font-semibold text-slate-700">
                                          {student.studentName}
                                        </span>{" "}
                                        in{" "}
                                        <span className="font-semibold text-slate-700">
                                          {selectedSubjectOption?.label ??
                                            (selectedSubject || "this subject")}
                                        </span>
                                        .
                                      </p>
                                    </div>
                                    <RemarkChoiceGroup
                                      idPrefix={`${student.studentId}-subject-remark`}
                                      options={SUBJECT_REMARK_CHOICES}
                                      value={student.teacherRemark}
                                      onChange={(value) =>
                                        handleMarksUpdate(
                                          student.studentId,
                                          "teacherRemark",
                                          value,
                                        )
                                      }
                                      disabled={
                                        currentStatus.status === "pending" ||
                                        currentStatus.status === "approved"
                                      }
                                      className="flex flex-wrap gap-2 sm:justify-end"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                            <p className="mt-3 text-[11px] text-muted-foreground">
                              Subject remarks are saved alongside the academic
                              entries for{" "}
                              {selectedSubjectOption?.label ??
                                (selectedSubject || "this subject")}
                              . Remember to save your academic records after
                              updating remarks.
                            </p>
                          </>
                        )}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardDescription>
                          Share a brief written comment for each student. The
                          text you enter will appear on their report card.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-5">
                          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                                Subject
                              </Label>
                              <Select
                                value={selectedSubjectKey || undefined}
                                onValueChange={handleSelectSubject}
                                disabled={
                                  isSubjectSelectDisabled || !hasRemarkSubjects
                                }
                              >
                                <SelectTrigger className="h-10">
                                  <SelectValue
                                    placeholder={subjectSelectPlaceholder}
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableSubjectOptions.map((option) => (
                                    <SelectItem
                                      key={option.key}
                                      value={option.key}
                                    >
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p
                                className={`text-[11px] ${
                                  hasRemarkSubjects
                                    ? "text-muted-foreground"
                                    : "text-amber-600"
                                }`}
                              >
                                {hasRemarkSubjects
                                  ? "Choose the subject to attach a class teacher remark."
                                  : "No subjects assigned for remark entry."}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                                Student
                              </Label>
                              <Select
                                value={selectedRemarkStudentId || undefined}
                                onValueChange={setSelectedRemarkStudentId}
                                disabled={isStudentSelectDisabledForRemarks}
                              >
                                <SelectTrigger className="h-10">
                                  <SelectValue
                                    placeholder={studentSelectPlaceholder}
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {remarkStudentOptions.length > 0 ? (
                                    remarkStudentOptions.map((student) => (
                                      <SelectItem
                                        key={student.studentId}
                                        value={student.studentId}
                                      >
                                        {student.studentName}
                                      </SelectItem>
                                    ))
                                  ) : (
                                    <SelectItem
                                      value="__no_students__"
                                      disabled
                                    >
                                      No students available
                                    </SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                              <p
                                className={`text-[11px] ${
                                  studentDropdownStatusMessage
                                    ? "text-amber-600"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {studentDropdownStatusMessage ??
                                  "Remarks are saved per student and subject."}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                                Current status
                              </Label>
                              <div className="flex h-10 items-center justify-center rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 px-3 text-xs font-semibold text-slate-600">
                                {selectedRemarkStudent &&
                                selectedSubjectKey &&
                                selectedRemarkValue ? (
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 ${
                                      currentRemarkOption?.badgeClass ??
                                      "border-muted bg-muted text-slate-600"
                                    }`}
                                  >
                                    {currentRemarkOption?.label ??
                                      selectedRemarkValue}
                                  </span>
                                ) : (
                                  <span className="text-xs font-normal text-muted-foreground">
                                    Awaiting selection
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                This status appears on the enhanced report card.
                              </p>
                            </div>
                          </div>

                          <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 p-4">
                            {selectedSubjectKey && selectedRemarkStudent ? (
                              <>
                                <p className="text-sm font-medium text-emerald-900">
                                  Select the remark that best fits{" "}
                                  <span className="font-semibold">
                                    {selectedRemarkStudent.studentName}
                                  </span>{" "}
                                  in{" "}
                                  <span className="font-semibold">
                                    {selectedSubjectOption?.label ??
                                      (selectedSubject ||
                                        "the selected subject")}
                                  </span>
                                  .
                                </p>
                                <RemarkChoiceGroup<ClassTeacherRemarkValue>
                                  idPrefix={`${selectedRemarkStudent.studentId}-${selectedSubjectKey}-class-remark`}
                                  options={CLASS_TEACHER_REMARK_CHOICES}
                                  value={selectedRemarkValue}
                                  onChange={(value) =>
                                    handleClassTeacherRemarkSelection(
                                      selectedRemarkStudent.studentId,
                                      selectedSubjectKey,
                                      value,
                                    )
                                  }
                                  className="mt-4 flex flex-wrap gap-3"
                                />
                              </>
                            ) : (
                              <div className="flex items-center justify-between gap-3 text-sm text-emerald-800">
                                <div>
                                  <p>
                                    {selectedSubjectKey
                                      ? "Select a student to assign a remark."
                                      : "Select a subject and student to assign a remark."}
                                  </p>
                                  <p className="text-xs text-emerald-700/80">
                                    Remarks are color-coded for quick progress
                                    tracking.
                                  </p>
                                </div>
                                <Sparkles className="h-5 w-5 text-emerald-500" />
                              </div>
                            )}
                          </div>

                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-slate-700">
                              Saved remark overview
                            </h4>
                            {marksData.length === 0 ? (
                              <div className="rounded-lg border border-dashed border-muted-foreground/40 bg-muted/40 p-4 text-sm text-muted-foreground">
                                Add students to begin capturing remarks.
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {marksData.map((student) => {
                                  const remarkEntries = getStudentRemarkEntries(
                                    student.studentId,
                                  );
                                  const summary =
                                    buildClassTeacherRemarkSummary(
                                      remarkEntries,
                                    );
                                  const activeRemarkEntry = selectedSubjectKey
                                    ? remarkEntries.find(
                                        (entry) =>
                                          entry.subjectKey ===
                                          selectedSubjectKey,
                                      )
                                    : undefined;
                                  const activeOption = activeRemarkEntry
                                    ? (CLASS_TEACHER_REMARK_OPTION_MAP[
                                        activeRemarkEntry.remark
                                      ] ?? null)
                                    : null;
                                  return (
                                    <div
                                      key={student.studentId}
                                      className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                                    >
                                      <div>
                                        <p className="text-sm font-semibold text-slate-900">
                                          {student.studentName}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                          {summary
                                            ? summary
                                            : "No remarks saved yet."}
                                        </p>
                                      </div>
                                      {activeRemarkEntry ? (
                                        <span
                                          className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold ${
                                            activeOption?.badgeClass ??
                                            "border-muted bg-muted text-slate-600"
                                          }`}
                                        >
                                          {`${
                                            selectedSubjectOption?.label ??
                                            (selectedSubject || "Subject")
                                          }: ${
                                            activeOption?.label ??
                                            mapClassTeacherRemarkToSubjectRemark(
                                              activeRemarkEntry.remark,
                                            )
                                          }`}
                                        </span>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <div className="flex justify-end mt-6">
                      <Button
                        onClick={handleSaveClassTeacherRemarks}
                        className="bg-[#2d682d] hover:bg-[#1f4a1f] text-white"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save Class Teacher Remarks
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-[#2d682d]">Assignments</CardTitle>
                  <CardDescription>
                    Manage assignments and view submissions
                  </CardDescription>
                </div>
                <Button
                  onClick={openCreateAssignmentDialog}
                  className="bg-[#2d682d] hover:bg-[#2d682d]/90"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Assignment
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isAssignmentsLoading ? (
                <div className="flex items-center justify-center py-8 text-gray-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading
                  assignments...
                </div>
              ) : assignments.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                  No assignments created yet. Click "Create Assignment" to share
                  work with your students.
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
                      <div className="flex items-center justify-between text-sm font-medium text-emerald-700">
                        <span>Active assignments</span>
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <p className="mt-2 text-2xl font-semibold text-emerald-900">
                        {assignmentInsights.activeAssignments}
                      </p>
                      <p className="mt-2 text-xs text-emerald-700/80">
                        {assignmentInsights.draftCount} draft
                        {assignmentInsights.draftCount === 1 ? "" : "s"} ready
                        for later.
                      </p>
                    </div>
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                      <div className="flex items-center justify-between text-sm font-medium text-blue-700">
                        <span>Submission rate</span>
                        <CheckCircle className="h-4 w-4" />
                      </div>
                      <p className="mt-2 text-2xl font-semibold text-blue-900">
                        {assignmentInsights.submissionRate}%
                      </p>
                      <Progress
                        value={assignmentInsights.submissionRate}
                        className="mt-3 h-2 bg-blue-100"
                      />
                      <p className="mt-2 text-xs text-blue-700/80">
                        {assignmentInsights.totalCapacity > 0
                          ? `${assignmentInsights.submissionCount} submissions from ${assignmentInsights.totalCapacity} expected.`
                          : assignmentInsights.submissionCount > 0
                            ? `${assignmentInsights.submissionCount} submissions received so far.`
                            : "Tracking submissions as they arrive."}
                      </p>
                    </div>
                    <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                      <div className="flex items-center justify-between text-sm font-medium text-amber-700">
                        <span>Pending grading</span>
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <p className="mt-2 text-2xl font-semibold text-amber-900">
                        {assignmentInsights.pendingGrading}
                      </p>
                      <p className="mt-2 text-xs text-amber-700/80">
                        Awaiting marks or feedback across all submissions.
                      </p>
                    </div>
                    <div className="rounded-xl border border-purple-100 bg-purple-50 p-4">
                      <div className="flex items-center justify-between text-sm font-medium text-purple-700">
                        <span>Average score</span>
                        <Trophy className="h-4 w-4" />
                      </div>
                      <p className="mt-2 text-2xl font-semibold text-purple-900">
                        {assignmentInsights.averageScore !== null
                          ? assignmentInsights.averageScore
                          : "--"}
                      </p>
                      <p className="mt-2 text-xs text-purple-700/80">
                        Calculated from graded submissions so far.
                      </p>
                    </div>
                  </div>

                  {assignments.map((assignment) => {
                    const submittedCount = assignment.submissions.filter(
                      (submission) =>
                        ["submitted", "graded"].includes(submission.status),
                    ).length;
                    const gradedCount = assignment.submissions.filter(
                      (submission) => submission.status === "graded",
                    ).length;
                    const totalAssigned =
                      assignment.assignedStudentIds.length ||
                      assignment.submissions.length;
                    const progress =
                      totalAssigned > 0
                        ? Math.round((submittedCount / totalAssigned) * 100)
                        : 0;
                    const statusMeta =
                      ASSIGNMENT_STATUS_META[assignment.status] ??
                      ASSIGNMENT_STATUS_META.draft;

                    return (
                      <div
                        key={assignment.id}
                        className={`group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${statusMeta.glow}`}
                      >
                        <div
                          className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${statusMeta.accent} via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                        />
                        <div className="relative z-10 flex flex-col gap-6">
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <Badge
                                  className={`${statusMeta.badgeClass} px-2 py-1 font-medium uppercase tracking-wide`}
                                >
                                  {statusMeta.label}
                                </Badge>
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                                  <BookOpen className="h-3.5 w-3.5" />{" "}
                                  {assignment.subject}
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">
                                  <Users className="h-3.5 w-3.5" />{" "}
                                  {assignment.className}
                                </span>
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-lg font-semibold text-slate-900 md:text-xl">
                                  <Sparkles className="h-5 w-5 text-emerald-500" />
                                  <span>{assignment.title}</span>
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2 md:max-w-2xl">
                                  {assignment.description ||
                                    "No description provided."}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                                  <CalendarClock className="h-4 w-4 text-amber-500" />
                                  Due {formatExamDate(assignment.dueDate)}
                                </span>
                                <span className="text-slate-500">
                                  {describeDueDate(assignment.dueDate)}
                                </span>
                                <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                                  <Trophy className="h-3.5 w-3.5 text-purple-500" />
                                  {assignment.maximumScore ?? assignmentMaximum}{" "}
                                  marks
                                </span>
                                {assignment.updatedAt ? (
                                  <span className="inline-flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                                    Updated{" "}
                                    {formatExamDate(assignment.updatedAt)}
                                  </span>
                                ) : null}
                              </div>
                              {assignment.resourceName ? (
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 transition hover:text-emerald-900"
                                  onClick={() =>
                                    handleDownloadAssignmentAttachment(
                                      assignment,
                                    )
                                  }
                                >
                                  <Download className="h-3.5 w-3.5" />{" "}
                                  {assignment.resourceName}
                                </button>
                              ) : null}
                            </div>
                            <div className="flex flex-col items-start gap-3 rounded-xl bg-slate-50/70 p-4 text-sm md:items-end">
                              <div className="flex flex-wrap items-center gap-2 text-slate-600">
                                <Badge
                                  variant="outline"
                                  className="border-emerald-200 bg-emerald-50 text-emerald-700"
                                >
                                  {submittedCount}/{totalAssigned || "--"}{" "}
                                  submitted
                                </Badge>
                                {gradedCount > 0 ? (
                                  <Badge
                                    variant="outline"
                                    className="border-purple-200 bg-purple-50 text-purple-700"
                                  >
                                    {gradedCount} graded
                                  </Badge>
                                ) : null}
                              </div>
                              <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-200">
                                <div
                                  className="h-full rounded-full bg-emerald-500 transition-all"
                                  style={{
                                    width: `${Math.min(100, progress)}%`,
                                  }}
                                />
                              </div>
                              <p className="text-xs text-slate-500">
                                Progress: {progress}%
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-emerald-200 text-emerald-700 transition hover:bg-emerald-50"
                              onClick={() => {
                                void handleViewSubmissions(assignment);
                              }}
                            >
                              <Users className="mr-1 h-4 w-4" /> View
                              submissions
                            </Button>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-slate-200 text-slate-700 transition hover:bg-slate-100"
                                  onClick={() =>
                                    handlePreviewAssignment(assignment)
                                  }
                                >
                                  <Eye className="mr-1 h-4 w-4" /> Preview
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Preview what students will see
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-slate-200 text-slate-700 transition hover:bg-slate-100"
                                  onClick={() =>
                                    handleEditAssignment(assignment)
                                  }
                                >
                                  <Pencil className="mr-1 h-4 w-4" /> Edit
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Edit details or attachment
                              </TooltipContent>
                            </Tooltip>
                            {assignment.status === "draft" ? (
                              <Button
                                size="sm"
                                className="bg-emerald-600 text-white transition hover:bg-emerald-700"
                                onClick={() => handleSendAssignment(assignment)}
                                disabled={assignmentActionId === assignment.id}
                              >
                                {assignmentActionId === assignment.id ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Send className="mr-1 h-4 w-4" />
                                )}
                                {assignmentActionId === assignment.id
                                  ? "Sending..."
                                  : "Send to students"}
                              </Button>
                            ) : null}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 transition hover:bg-red-50"
                                  onClick={() =>
                                    handleDeleteAssignment(assignment)
                                  }
                                  disabled={
                                    deletingAssignmentId === assignment.id
                                  }
                                >
                                  {deletingAssignmentId === assignment.id ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="mr-1 h-4 w-4" />
                                  )}
                                  {deletingAssignmentId === assignment.id
                                    ? "Removing"
                                    : "Delete"}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Remove this assignment
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="students" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">My Students</CardTitle>
              <CardDescription>Students in your classes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Students are automatically scoped to your assigned classes.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="inline-flex items-center gap-2"
                    onClick={() => {
                      void refreshTeacherStudents();
                    }}
                    disabled={isTeacherStudentsLoading}
                  >
                    {isTeacherStudentsLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Refresh
                  </Button>
                </div>

                {teacherStudentsError ? (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {teacherStudentsError}
                  </div>
                ) : null}

                {teacherStudentsMessage && !teacherStudentsError ? (
                  <div className="rounded-md border border-dashed border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                    {teacherStudentsMessage}
                  </div>
                ) : null}

                {isTeacherStudentsLoading ? (
                  <div className="flex items-center gap-2 rounded-md border border-dashed border-emerald-200 p-3 text-sm text-emerald-700">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading
                    students…
                  </div>
                ) : null}

                {!isTeacherStudentsLoading &&
                !teacherStudentsError &&
                teacherStudents.length > 0 ? (
                  <div className="space-y-3">
                    {teacherStudents.map((student) => (
                      <div
                        key={student.id}
                        className="flex flex-col justify-between gap-3 rounded-lg border border-slate-200 p-4 md:flex-row md:items-center"
                      >
                        <div>
                          <h3 className="font-medium text-slate-900">
                            {student.name}
                          </h3>
                          <p className="text-sm text-slate-600">
                            {student.className
                              ? student.className
                              : "Class not set"}
                          </p>
                          {student.subjects.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {student.subjects.map((subject) => (
                                <Badge
                                  key={`${student.id}-${subject}`}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {subject}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                          <CheckCircle className="h-4 w-4" />
                          {student.status.toLowerCase() === "inactive"
                            ? "Inactive"
                            : "Active"}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timetable" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">My Timetable</CardTitle>
              <CardDescription>Your teaching schedule</CardDescription>
            </CardHeader>
            <CardContent>
              {isTeacherTimetableLoading ? (
                <div className="flex items-center justify-center py-6 text-gray-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading
                  timetable...
                </div>
              ) : (
                <TimetableWeeklyView
                  slots={teacherTimetable}
                  emptyMessage={`No timetable entries available for ${selectedClass}.`}
                  renderDetails={(slot) => {
                    const details: string[] = [];
                    const facilitator = slot.teacher?.trim();
                    if (
                      facilitator &&
                      facilitator.length > 0 &&
                      facilitator !== teacher.name
                    ) {
                      details.push(`Facilitator: ${facilitator}`);
                    }
                    if (slot.location && slot.location.trim().length > 0) {
                      details.push(`Location: ${slot.location}`);
                    }
                    if (details.length === 0) {
                      details.push("Get ready for this session.");
                    }
                    return (
                      <p className="text-sm text-emerald-700/80">
                        {details.join(" • ")}
                      </p>
                    );
                  }}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="materials" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">Study Materials</CardTitle>
              <CardDescription>
                Upload and manage study materials for your students
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StudyMaterials
                userRole="teacher"
                teacherName={teacher.name}
                teacherId={teacher.id}
                availableSubjects={teacherSubjects}
                availableClasses={teacherClassNames}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="noticeboard" className="space-y-4">
          <Noticeboard userRole="teacher" userName={teacher.name} />
        </TabsContent>

        <TabsContent value="messages" className="space-y-4">
          <InternalMessaging
            currentUser={{
              id: teacher.id,
              name: teacher.name,
              role: "teacher",
            }}
          />
        </TabsContent>
      </Tabs>

      <CommandDialog
        open={isSubjectSwitcherOpen}
        onOpenChange={setIsSubjectSwitcherOpen}
        title="Switch subject"
        description="Quickly change the subject you're entering marks for"
      >
        <CommandInput placeholder="Search subjects..." />
        <CommandList>
          <CommandEmpty>No matching subjects found.</CommandEmpty>
          <CommandGroup heading="Available subjects">
            {availableSubjectOptions.length === 0 ? (
              <CommandItem value="no-subjects" disabled>
                No subjects assigned. Please contact the admin.
              </CommandItem>
            ) : (
              availableSubjectOptions.map((option) => {
                const isActive = option.key === selectedSubjectKey;

                return (
                  <CommandItem
                    key={option.key}
                    value={option.label.toLowerCase()}
                    onSelect={() => handleSubjectSwitch(option.key)}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span>{option.label}</span>
                      {isActive ? (
                        <Check className="h-4 w-4 text-[#2d682d]" />
                      ) : null}
                    </div>
                  </CommandItem>
                );
              })
            )}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <Dialog
        open={isAddStudentDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsAddStudentDialogOpen(true);
          } else {
            handleCloseAddStudentDialog();
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add students to the grade sheet</DialogTitle>
            <DialogDescription>
              Select a learner from the class roster so their results appear on
              the report card and can be updated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-900">
              <p className="text-sm font-semibold text-emerald-800">
                Current selection
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div>
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                    Class
                  </span>
                  <span className="text-sm font-medium text-emerald-900">
                    {selectedClass || "Not selected"}
                  </span>
                  <p className="mt-1 text-[11px] text-emerald-700">
                    This class is automatically assigned from your teacher
                    profile.
                  </p>
                </div>
                <div>
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                    Subject
                  </span>
                  <span className="text-sm font-medium text-emerald-900">
                    {addStudentDialogOption?.label ||
                      selectedSubjectOption?.label ||
                      selectedSubject ||
                      "Not selected"}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                    Term
                  </span>
                  <span className="text-sm font-medium text-emerald-900">
                    {mapTermKeyToLabel(selectedTerm) || "Not selected"}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                    Session
                  </span>
                  <span className="text-sm font-medium text-emerald-900">
                    {selectedSession || "Not selected"}
                  </span>
                </div>
              </div>
            </div>
            {rosterNotice && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{rosterNotice}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Class roster
              </Label>
              {isRosterLoading ? (
                <div className="flex items-center gap-2 rounded-md border border-dashed border-gray-200 p-3 text-sm text-gray-600">
                  <Loader2 className="h-4 w-4 animate-spin text-[#2d682d]" />{" "}
                  Loading class roster…
                </div>
              ) : rosterCandidates.length === 0 ? (
                <div className="rounded-md border border-dashed border-gray-200 p-3 text-sm text-gray-600">
                  No students available for this class.
                </div>
              ) : (
                <ScrollArea className="h-56 rounded-md border border-gray-200">
                  <RadioGroup
                    value={selectedRosterId ?? ""}
                    onValueChange={(value) => setSelectedRosterId(value)}
                    className="divide-y divide-gray-100"
                  >
                    {rosterCandidates.map((candidate) => {
                      const displayName =
                        candidate.name ?? `Student ${candidate.id}`;
                      const inputId = `roster-${candidate.id}`;
                      return (
                        <label
                          key={candidate.id}
                          className="flex cursor-pointer items-start gap-3 p-3 hover:bg-emerald-50/50"
                          htmlFor={inputId}
                        >
                          <RadioGroupItem value={candidate.id} id={inputId} />
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-gray-900">
                              {displayName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {candidate.id}
                              {candidate.className
                                ? ` • ${candidate.className}`
                                : ""}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </RadioGroup>
                </ScrollArea>
              )}
              <p className="text-[11px] text-gray-500">
                Selected: {selectedRosterId ? 1 : 0}
              </p>
            </div>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={handleCloseAddStudentDialog}>
              Cancel
            </Button>
            <Button
              className="bg-[#2d682d] text-white hover:bg-[#1f4a1f]"
              onClick={handleConfirmAddStudents}
            >
              <Save className="mr-2 h-4 w-4" />
              Add to Grade Sheet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReportCardPreviewOverlay
        isOpen={previewDialogOpen}
        onClose={closePreviewDialog}
        title="Report Card Preview"
        description={
          previewStudentId
            ? `${marksData.find((s) => s.studentId === previewStudentId)?.studentName ?? "Student"} • ${selectedClass} • ${mapTermKeyToLabel(selectedTerm)} (${selectedSession})`
            : "Select a student to preview their report card."
        }
        actions={
          previewData ? (
            <Button
              size="sm"
              variant="outline"
              className="flex items-center gap-2"
              onClick={handlePreviewDownload}
              disabled={isPreviewDownloading}
            >
              {isPreviewDownloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {isPreviewDownloading ? "Preparing…" : "Download"}
            </Button>
          ) : null
        }
      >
        {previewData ? (
          <EnhancedReportCard data={previewData} />
        ) : (
          <p className="text-sm text-muted-foreground">
            No preview data available yet.
          </p>
        )}
      </ReportCardPreviewOverlay>

      {/* Create Assignment Dialog */}
      <Dialog
        open={showCreateAssignment}
        onOpenChange={(open) => {
          setShowCreateAssignment(open);
          if (!open) {
            resetAssignmentForm();
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleAssignmentSubmit} className="space-y-5">
            <DialogHeader className="space-y-1">
              <DialogTitle>{assignmentDialogTitle}</DialogTitle>
              <DialogDescription>
                {assignmentDialogDescription}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5">
              <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-800">
                <p className="flex items-center gap-2 font-medium">
                  <Sparkles className="h-4 w-4 text-emerald-500" /> Tailor
                  engaging assignments
                </p>
                <p className="mt-1 text-emerald-700/80">
                  Add clear instructions, set a due date, and attach helpful
                  resources to guide your learners.
                </p>
              </div>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="title">Assignment Title</Label>
                  <Input
                    id="title"
                    value={assignmentForm.title}
                    onChange={(e) =>
                      setAssignmentForm((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    placeholder="Enter assignment title"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={assignmentForm.description}
                    onChange={(e) =>
                      setAssignmentForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Share instructions, expectations, and submission tips"
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={assignmentSubjectFieldId}>Subject</Label>
                    <Select
                      value={assignmentForm.subject}
                      onValueChange={(value) =>
                        setAssignmentForm((prev) => ({
                          ...prev,
                          subject: value,
                        }))
                      }
                    >
                      <SelectTrigger
                        id={assignmentSubjectFieldId}
                        aria-label="Assignment subject"
                      >
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {teacherSubjects.map((subject) => (
                          <SelectItem key={subject} value={subject}>
                            {subject}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor={assignmentClassFieldId}>Class</Label>
                    <Select
                      value={assignmentForm.classId || ""}
                      onValueChange={(value) =>
                        setAssignmentForm((prev) => {
                          const match = teacherClasses.find(
                            (cls) => cls.id === value,
                          );
                          return {
                            ...prev,
                            classId: value,
                            className: match?.name ?? prev.className,
                          };
                        })
                      }
                    >
                      <SelectTrigger
                        id={assignmentClassFieldId}
                        aria-label="Assignment class"
                      >
                        <SelectValue
                          placeholder={
                            assignmentForm.className || "Select class"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {teacherClasses.map((classItem) => (
                          <SelectItem
                            key={`${classItem.id}-${classItem.name}`}
                            value={classItem.id}
                          >
                            {classItem.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={assignmentForm.dueDate}
                      onChange={(e) =>
                        setAssignmentForm((prev) => ({
                          ...prev,
                          dueDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="maximumScore">Maximum Score</Label>
                    <div className="relative mt-1">
                      <Input
                        id="maximumScore"
                        type="number"
                        min={1}
                        max={100}
                        value={assignmentForm.maximumScore}
                        onChange={(e) =>
                          setAssignmentForm((prev) => ({
                            ...prev,
                            maximumScore: e.target.value,
                          }))
                        }
                        placeholder={`e.g. ${assignmentMaximum}`}
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                        marks
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Set how many marks this assignment contributes for your
                      students.
                    </p>
                  </div>
                </div>
                <div>
                  <Label htmlFor="file">Attachment (Optional)</Label>
                  <Input
                    id="file"
                    type="file"
                    onChange={(e) =>
                      setAssignmentForm((prev) => ({
                        ...prev,
                        file: e.target.files?.[0] || null,
                      }))
                    }
                  />
                  {isEditingAssignment &&
                  assignmentForm.resourceName &&
                  !assignmentForm.file ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Current attachment:{" "}
                      <span className="font-medium text-slate-700">
                        {assignmentForm.resourceName}
                      </span>
                    </p>
                  ) : null}
                </div>
              </div>
              <Separator />
              <p className="text-xs text-muted-foreground">
                Tip: Assignment scores contribute up to{" "}
                {resolvedAssignmentMaximum} marks to continuous assessment this
                term.
              </p>
            </div>
            <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowCreateAssignment(false);
                  resetAssignmentForm();
                }}
              >
                Cancel
              </Button>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <Button
                  type="submit"
                  name="action"
                  value="draft"
                  data-intent="draft"
                  variant="outline"
                  disabled={isSavingAssignment}
                  className="border-slate-300"
                >
                  {isSavingAssignment ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {isSavingAssignment
                    ? "Saving..."
                    : isEditingAssignment
                      ? "Save Draft"
                      : "Save as Draft"}
                </Button>
                <Button
                  type="submit"
                  name="action"
                  value="sent"
                  data-intent="sent"
                  disabled={isSavingAssignment}
                  className="bg-[#2d682d] hover:bg-[#2d682d]/90"
                >
                  {isSavingAssignment ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  {isSavingAssignment
                    ? "Sending..."
                    : isEditingAssignment
                      ? "Update & Send"
                      : "Send Assignment"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assignment Preview Dialog */}
      <Dialog
        open={Boolean(previewAssignment)}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewAssignment(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {previewAssignment?.title ?? "Assignment Preview"}
            </DialogTitle>
            <DialogDescription>
              {previewAssignment
                ? `${previewAssignment.subject} • ${previewAssignment.className} • Worth ${
                    previewAssignment.maximumScore ?? assignmentMaximum
                  } marks • Due ${formatExamDate(previewAssignment.dueDate)}`
                : "Select an assignment to preview the student experience."}
            </DialogDescription>
          </DialogHeader>
          {previewAssignment ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className={`${ASSIGNMENT_STATUS_META[previewAssignment.status].badgeClass} uppercase`}
                >
                  {ASSIGNMENT_STATUS_META[previewAssignment.status].label}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-emerald-200 bg-emerald-50 text-emerald-700"
                >
                  {
                    previewAssignment.submissions.filter((submission) =>
                      ["submitted", "graded"].includes(submission.status),
                    ).length
                  }{" "}
                  submissions
                </Badge>
              </div>
              <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-700">
                <h4 className="font-semibold text-slate-800">Instructions</h4>
                <p className="mt-2 whitespace-pre-line">
                  {previewAssignment.description ||
                    "No description provided yet."}
                </p>
              </div>
              {previewAssignment.resourceName ? (
                <div className="rounded-xl border border-dashed border-emerald-200 bg-white p-4 text-sm text-emerald-700">
                  <p className="font-medium">Attached Resource</p>
                  <button
                    type="button"
                    onClick={() =>
                      handleDownloadAssignmentAttachment(previewAssignment)
                    }
                    className="mt-2 inline-flex items-center gap-2 text-emerald-700 transition hover:text-emerald-900"
                  >
                    <Download className="h-4 w-4" />
                    {previewAssignment.resourceName}
                  </button>
                </div>
              ) : null}
              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <div>
                  Created:{" "}
                  {previewAssignment.createdAt
                    ? formatExamDate(previewAssignment.createdAt)
                    : "—"}
                </div>
                <div>
                  Last updated:{" "}
                  {previewAssignment.updatedAt
                    ? formatExamDate(previewAssignment.updatedAt)
                    : "—"}
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" onClick={() => setPreviewAssignment(null)}>
              Close
            </Button>
            {previewAssignment ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    handleEditAssignment(previewAssignment);
                    setPreviewAssignment(null);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (previewAssignment) {
                      void handleViewSubmissions(previewAssignment);
                    }
                  }}
                >
                  <Users className="mr-2 h-4 w-4" /> View submissions
                </Button>
                {previewAssignment.status === "draft" ? (
                  <Button
                    className="bg-[#2d682d] text-white hover:bg-[#1f4a1f]"
                    onClick={() => {
                      handleSendAssignment(previewAssignment);
                      setPreviewAssignment(null);
                    }}
                  >
                    <Send className="mr-2 h-4 w-4" /> Send to students
                  </Button>
                ) : null}
              </div>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Submissions Dialog */}
      <Dialog
        open={showSubmissions}
        onOpenChange={(open) => {
          setShowSubmissions(open);
          if (!open) {
            setSelectedAssignment(null);
            setGradingDrafts({});
            setIsLoadingSubmissions(false);
            setAssignmentRoster({});
          }
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Assignment Submissions - {selectedAssignment?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedAssignment
                ? `${selectedAssignment.subject} • ${selectedAssignment.className} • Due ${formatExamDate(selectedAssignment.dueDate)}`
                : "Review the submissions you have received."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedAssignment ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700">
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="h-3.5 w-3.5 text-amber-500" /> Due{" "}
                    {formatExamDate(selectedAssignment.dueDate)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-emerald-500" /> Assigned
                    to {selectedAssignment.className ?? "assigned students"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Trophy className="h-3.5 w-3.5 text-purple-500" />
                    {selectedAssignment.maximumScore ?? assignmentMaximum} marks
                  </span>
                </div>
                <p className="mt-3 text-sm">
                  {selectedAssignment.description?.length
                    ? selectedAssignment.description
                    : "No additional description was provided for this assignment."}
                </p>
                {selectedAssignment.resourceName ? (
                  <button
                    type="button"
                    onClick={() =>
                      handleDownloadAssignmentAttachment(selectedAssignment)
                    }
                    className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-emerald-700 transition hover:text-emerald-900"
                  >
                    <Download className="h-3.5 w-3.5" /> Download assignment
                    attachment ({selectedAssignment.resourceName})
                  </button>
                ) : (
                  <p className="mt-3 text-xs text-slate-500">
                    No assignment attachment to download.
                  </p>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <Badge
                    variant="outline"
                    className="border-emerald-200 bg-emerald-50 text-emerald-700"
                  >
                    {receivedSubmissionRecords.length} submitted
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-amber-200 bg-amber-50 text-amber-700"
                  >
                    {pendingSubmissionRecords.length} not submitted
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-purple-200 bg-purple-50 text-purple-700"
                  >
                    {gradedSubmissionCount} graded
                  </Badge>
                </div>
              </div>
            ) : null}
            {isLoadingSubmissions ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading
                submissions...
              </div>
            ) : receivedSubmissionRecords.length > 0 ? (
              receivedSubmissionRecords.map(({ student, submission }) => {
                const assignmentMaxScore =
                  selectedAssignment?.maximumScore ?? assignmentMaximum;
                const draft = gradingDrafts[submission.id] ?? {
                  score: "",
                  comment: "",
                };
                const submissionStatusMeta =
                  submission.status === "graded"
                    ? ASSIGNMENT_STATUS_META.graded
                    : ASSIGNMENT_STATUS_META.submitted;

                return (
                  <div
                    key={submission.id}
                    className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:bg-slate-50/70"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <div>
                          <h3 className="font-medium text-slate-800">
                            {student.name ?? `Student ${submission.studentId}`}
                          </h3>
                          <p className="text-xs text-slate-500">
                            {submission.studentId}
                            {student.className ? ` • ${student.className}` : ""}
                          </p>
                          <p className="text-xs text-slate-500">
                            Submitted{" "}
                            {submission.submittedAt
                              ? formatExamDate(submission.submittedAt)
                              : "—"}
                          </p>
                        </div>
                        {submission.files && submission.files.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-700">
                            <span className="font-medium text-emerald-800">
                              Attachments:
                            </span>
                            {submission.files.map((file) => (
                              <button
                                key={file.id}
                                type="button"
                                onClick={() =>
                                  handleDownloadSubmissionFile(submission, file)
                                }
                                className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700 transition hover:bg-emerald-100"
                              >
                                <Download className="h-3.5 w-3.5" /> {file.name}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">
                            No attachments were included in this submission.
                          </p>
                        )}
                      </div>
                      <Badge
                        className={`${submissionStatusMeta.badgeClass} uppercase`}
                      >
                        {submission.status}
                      </Badge>
                    </div>
                    <div className="grid gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-slate-500">
                          Score
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            max={assignmentMaxScore}
                            value={draft.score}
                            onChange={(e) =>
                              setGradingDrafts((prev) => ({
                                ...prev,
                                [submission.id]: {
                                  score: e.target.value,
                                  comment: prev[submission.id]?.comment ?? "",
                                },
                              }))
                            }
                          />
                          <span className="text-xs text-muted-foreground">
                            / {assignmentMaxScore}
                          </span>
                        </div>
                        {submission.grade || submission.score !== null ? (
                          <p className="text-xs text-slate-500">
                            Last score: {submission.score ?? "--"}/
                            {assignmentMaxScore}
                            {submission.grade ? ` (${submission.grade})` : ""}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-slate-500">
                          Feedback
                        </Label>
                        <Textarea
                          value={draft.comment}
                          onChange={(e) =>
                            setGradingDrafts((prev) => ({
                              ...prev,
                              [submission.id]: {
                                score: prev[submission.id]?.score ?? "",
                                comment: e.target.value,
                              },
                            }))
                          }
                          rows={3}
                          placeholder="Share personalised feedback"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-muted-foreground">
                        {submission.comment
                          ? `Student note: ${submission.comment}`
                          : "No student comment provided."}
                      </p>
                      <Button
                        size="sm"
                        className="bg-[#2d682d] text-white hover:bg-[#1f4a1f]"
                        onClick={() => handleGradeSubmission(submission)}
                        disabled={gradingSubmissionId === submission.id}
                      >
                        {gradingSubmissionId === submission.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="mr-2 h-4 w-4" />
                        )}
                        {gradingSubmissionId === submission.id
                          ? "Saving..."
                          : submission.status === "graded"
                            ? "Update Score"
                            : "Save Score"}
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                No submissions have been received for this assignment yet.
              </div>
            )}
            {pendingSubmissionRecords.length > 0 ? (
              <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/40 p-4">
                <h4 className="text-sm font-semibold text-amber-700">
                  Awaiting submissions ({pendingSubmissionRecords.length})
                </h4>
                <ul className="mt-3 space-y-2">
                  {pendingSubmissionRecords.map(({ student }) => (
                    <li
                      key={student.id}
                      className="flex items-center justify-between rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm text-amber-800"
                    >
                      <div>
                        <p className="font-medium text-amber-900">
                          {student.name ?? `Student ${student.id}`}
                        </p>
                        <p className="text-xs text-amber-700/80">
                          {student.id}
                          {student.className ? ` • ${student.className}` : ""}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-amber-300 bg-amber-100 text-amber-700"
                      >
                        Not submitted
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSubmissions(false);
                setSelectedAssignment(null);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
