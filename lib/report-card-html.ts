import type { RawReportCardData } from "@/lib/report-card-types"
import {
  AFFECTIVE_TRAITS,
  PSYCHOMOTOR_SKILLS,
  createBehavioralRecordSkeleton,
  getAffectiveTraitLabel,
  getPsychomotorSkillLabel,
  normalizeBehavioralSelections,
} from "./report-card-constants"

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

const formatScoreValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString()
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value
  }

  return "—"
}

const formatMetadata = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString()
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value
  }

  return "—"
}

export const buildReportCardHtml = (data: RawReportCardData) => {
  const subjects = Array.isArray(data.subjects) ? (data.subjects as Array<Record<string, unknown>>) : []
  const subjectRows = subjects
    .map((subjectEntry, index) => {
      const subject = subjectEntry as Record<string, unknown>
      const subjectName =
        typeof subject.subject === "string"
          ? subject.subject
          : typeof subject.name === "string"
            ? subject.name
            : `Subject ${index + 1}`
      const ca1 = formatScoreValue(subject["ca1"])
      const ca2 = formatScoreValue(subject["ca2"])
      const assignment = formatScoreValue(subject["assignment"])
      const caTotal = formatScoreValue(subject["caTotal"] ?? subject["ca_total"])
      const exam = formatScoreValue(subject["exam"])
      const total = formatScoreValue(subject["total"])
      const grade = formatScoreValue(subject["grade"])
      const remark =
        typeof subject["remark"] === "string" && subject["remark"].trim().length > 0
          ? (subject["remark"] as string)
          : typeof subject["comment"] === "string"
            ? (subject["comment"] as string)
            : "—"

      return `
        <tr>
          <td>${escapeHtml(subjectName)}</td>
          <td>${escapeHtml(ca1)}</td>
          <td>${escapeHtml(ca2)}</td>
          <td>${escapeHtml(assignment)}</td>
          <td>${escapeHtml(caTotal)}</td>
          <td>${escapeHtml(exam)}</td>
          <td>${escapeHtml(total)}</td>
          <td>${escapeHtml(grade)}</td>
          <td>${escapeHtml(remark)}</td>
        </tr>
      `
    })
    .join("")

  const resolveBehavioralSelections = (
    domain: "affective" | "psychomotor",
    defaults: readonly { key: string; label: string }[],
    selections: Record<string, boolean | undefined> | undefined,
  ) => {
    const skeleton = createBehavioralRecordSkeleton(defaults)
    const normalized = normalizeBehavioralSelections(domain, selections as Record<string, unknown> | undefined)
    const merged: Record<string, boolean> = { ...skeleton }

    Object.entries(normalized).forEach(([key, value]) => {
      merged[key] = value
    })

    Object.entries(selections ?? {}).forEach(([key, value]) => {
      if (!(key in merged)) {
        merged[key] = Boolean(value)
      }
    })

    return merged
  }

  const buildDomainRows = (
    traits: readonly { key: string; label: string }[],
    selections: Record<string, boolean>,
    labelResolver: (key: string) => string,
  ) => {
    const seen = new Set<string>()
    const orderedKeys: string[] = []

    traits.forEach(({ key }) => {
      if (!seen.has(key)) {
        orderedKeys.push(key)
        seen.add(key)
      }
    })

    Object.keys(selections).forEach((key) => {
      if (!seen.has(key)) {
        orderedKeys.push(key)
        seen.add(key)
      }
    })

    return orderedKeys
      .map((key) => {
        const checked = selections[key]
        return `
        <tr>
          <td>${escapeHtml(labelResolver(key))}</td>
          <td>${checked ? '<span class="checkmark">✓</span>' : ""}</td>
        </tr>
      `
      })
      .join("")
  }

  const affectiveSelections = resolveBehavioralSelections("affective", AFFECTIVE_TRAITS, data.affectiveDomain)
  const psychomotorSelections = resolveBehavioralSelections("psychomotor", PSYCHOMOTOR_SKILLS, data.psychomotorDomain)

  const affectiveRows = buildDomainRows(AFFECTIVE_TRAITS, affectiveSelections, getAffectiveTraitLabel)
  const psychomotorRows = buildDomainRows(
    PSYCHOMOTOR_SKILLS,
    psychomotorSelections,
    getPsychomotorSkillLabel,
  )

  if (!data.branding?.logo) {
    console.warn("Report card branding: school logo not set")
  }

  if (!data.branding?.signature) {
    console.warn("Report card branding: headmaster signature pending")
  }

  const summary = data.summary ?? {}

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <title>Report Card - ${escapeHtml(data.student.name)}</title>
      <style>
        body {
          font-family: Arial, Helvetica, sans-serif;
          margin: 40px;
          background: #f5f5f5;
          color: #1f2937;
        }
        h1, h2, h3 {
          margin: 0;
          color: #1b4332;
        }
        h1 {
          font-size: 28px;
          font-weight: 700;
        }
        h2 {
          font-size: 20px;
          font-weight: 600;
        }
        h3 {
          font-size: 16px;
          font-weight: 600;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
          background: white;
        }
        th, td {
          padding: 12px;
          border: 1px solid #d1d5db;
          text-align: left;
        }
        th {
          background: #e9f5ef;
          color: #1b4332;
          font-weight: 600;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #2d682d;
        }
        .logo-container {
          width: 100px;
          height: 100px;
          border: 2px solid #2d682d;
          border-radius: 16px;
          background: #f0fdf4;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex-shrink: 0;
        }
        .logo-container img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .logo-placeholder {
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          text-align: center;
          padding: 0 8px;
        }
        .header-info {
          flex: 1;
        }
        .school-name {
          font-size: 24px;
          font-weight: 700;
          color: #1b4332;
        }
        .muted {
          color: #6b7280;
          font-size: 14px;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }
        .section {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 10px 25px -15px rgba(15, 23, 42, 0.25);
        }
        .section h3 {
          margin-bottom: 12px;
        }
        .info-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px dashed #e5e7eb;
          font-size: 14px;
        }
        .info-item:last-child {
          border-bottom: none;
        }
        .highlight {
          color: #1b4332;
          font-weight: 600;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px 12px;
          border-radius: 9999px;
          font-size: 12px;
          font-weight: 600;
          background: #e9f5ef;
          color: #1b4332;
          border: 1px solid #2d682d;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          font-size: 14px;
          color: #6b7280;
        }
        .remarks {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 20px;
        }
        .signature {
          margin-top: 40px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 40px;
          flex-wrap: wrap;
        }
        .signature > div {
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-width: 200px;
        }
        .signature-line {
          border-bottom: 1px solid #d1d5db;
          width: 200px;
          height: 1px;
        }
        .signature-image {
          width: 200px;
          height: 80px;
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
          width: 200px;
          height: 80px;
          border: 1px dashed #d1d5db;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6b7280;
          font-size: 12px;
          font-style: italic;
        }
        .signature-name {
          font-size: 14px;
          font-weight: 600;
          color: #1b4332;
        }
        .holistic-grid {
          gap: 12px;
        }
        .holistic-grid > div {
          min-width: 0;
        }
        .holistic-grid table {
          width: 100%;
          max-width: 100%;
          table-layout: fixed;
          margin: 12px 0 0;
          box-sizing: border-box;
        }
        .holistic-grid th,
        .holistic-grid td {
          padding: 8px;
          word-break: break-word;
          overflow-wrap: anywhere;
          text-align: center;
        }
        .holistic-grid th:first-child,
        .holistic-grid td:first-child {
          text-align: left;
        }

        .holistic-grid .checkmark {
          color: #047857;
          font-weight: 700;
          font-size: 16px;
        }
      </style>
    </head>
    <body>
      <header class="header">
        <div class="logo-container">
          ${
            data.branding?.logo
              ? `<img src="${escapeHtml(data.branding.logo)}" alt="School logo" />`
              : '<div class="logo-placeholder">School Logo Not Set</div>'
          }
        </div>
        <div class="header-info">
          <div class="school-name">${escapeHtml(data.branding?.schoolName ?? "Victory Educational Academy")}</div>
          ${
            data.branding?.address
              ? `<div class="muted">${escapeHtml(data.branding.address)}</div>`
              : ""
          }
          ${
            data.branding?.contactPhone
              ? `<div class="muted">Phone: ${escapeHtml(data.branding.contactPhone)}</div>`
              : ""
          }
          ${
            data.branding?.contactEmail
              ? `<div class="muted">Email: ${escapeHtml(data.branding.contactEmail)}</div>`
              : ""
          }
        </div>
      </header>

      <section class="section">
        <h2>Student Information</h2>
        <div class="grid">
          <div class="info-item">
            <span>Student Name</span>
            <span class="highlight">${escapeHtml(data.student.name)}</span>
          </div>
          <div class="info-item">
            <span>Admission Number</span>
            <span>${escapeHtml(data.student.admissionNumber ?? "—")}</span>
          </div>
          <div class="info-item">
            <span>Class</span>
            <span>${escapeHtml(data.student.class ?? "—")}</span>
          </div>
          <div class="info-item">
            <span>Term</span>
            <span>${escapeHtml(data.student.term)}</span>
          </div>
          <div class="info-item">
            <span>Session</span>
            <span>${escapeHtml(data.student.session)}</span>
          </div>
          <div class="info-item">
            <span>Position</span>
            <span class="badge">${escapeHtml(formatMetadata(data.summary?.position ?? data.position))}</span>
          </div>
        </div>
      </section>

      <section class="section">
        <h2>Academic Performance</h2>
        <table>
          <thead>
            <tr>
              <th>Subject</th>
              <th>1st CA</th>
              <th>2nd CA</th>
              <th>Assignment</th>
              <th>CA Total</th>
              <th>Exam</th>
              <th>Total</th>
              <th>Grade</th>
              <th>Remark</th>
            </tr>
          </thead>
          <tbody>
            ${subjectRows || "<tr><td colspan=\"9\">No subjects recorded.</td></tr>"}
          </tbody>
        </table>
      </section>

      <section class="section">
        <h2>Performance Summary</h2>
        <div class="grid">
          <div class="info-item">
            <span>Total Obtainable</span>
            <span class="highlight">${escapeHtml(formatMetadata(summary.totalMarksObtainable ?? data.totalObtainable ?? "—"))}</span>
          </div>
          <div class="info-item">
            <span>Total Obtained</span>
            <span class="highlight">${escapeHtml(formatMetadata(summary.totalMarksObtained ?? data.totalObtained ?? "—"))}</span>
          </div>
          <div class="info-item">
            <span>Average Score</span>
            <span class="highlight">${escapeHtml(formatMetadata(summary.averageScore ?? data.average ?? "—"))}</span>
          </div>
          <div class="info-item">
            <span>Overall Grade</span>
            <span class="badge">${escapeHtml(summary.grade ?? "—")}</span>
          </div>
          <div class="info-item">
            <span>Class Average</span>
            <span>${escapeHtml(formatMetadata(summary.classAverage ?? "—"))}</span>
          </div>
          <div class="info-item">
            <span>Highest Score</span>
            <span>${escapeHtml(formatMetadata(summary.highestScore ?? "—"))}</span>
          </div>
          <div class="info-item">
            <span>Lowest Score</span>
            <span>${escapeHtml(formatMetadata(summary.lowestScore ?? "—"))}</span>
          </div>
        </div>
      </section>

      <section class="section">
        <h2>Holistic Development</h2>
        <div class="grid holistic-grid">
          <div>
            <h3>Affective Domain</h3>
            <table>
              <thead>
                <tr>
                  <th>Trait</th>
                  <th>Rating</th>
                </tr>
              </thead>
              <tbody>
                ${affectiveRows || "<tr><td colspan=\"2\">No affective selections recorded.</td></tr>"}
              </tbody>
            </table>
          </div>
          <div>
            <h3>Psychomotor Domain</h3>
            <table>
              <thead>
                <tr>
                  <th>Skill</th>
                  <th>Rating</th>
                </tr>
              </thead>
              <tbody>
                ${psychomotorRows || "<tr><td colspan=\"2\">No psychomotor selections recorded.</td></tr>"}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="section">
        <h2>Attendance</h2>
        <div class="grid">
          <div class="info-item">
            <span>Days Present</span>
            <span>${escapeHtml(formatMetadata(data.attendance?.present ?? "—"))}</span>
          </div>
          <div class="info-item">
            <span>Days Absent</span>
            <span>${escapeHtml(formatMetadata(data.attendance?.absent ?? "—"))}</span>
          </div>
          <div class="info-item">
            <span>Total Days</span>
            <span>${escapeHtml(formatMetadata(data.attendance?.total ?? "—"))}</span>
          </div>
        </div>
      </section>

      <section class="section">
        <h2>Remarks</h2>
        <div class="remarks">
          <div>
            <h3>Class Teacher</h3>
            <p>${escapeHtml(data.remarks?.classTeacher ?? data.classTeacherRemarks ?? "—")}</p>
          </div>
          <div>
            <h3>Head Teacher</h3>
            <p>${escapeHtml(data.remarks?.headTeacher ?? "—")}</p>
          </div>
        </div>
      </section>

      <section class="section">
        <h2>Next Term Information</h2>
        <div class="grid">
          <div class="info-item">
            <span>Vacation Ends</span>
            <span>${escapeHtml(formatMetadata(data.termInfo?.vacationEnds ?? "—"))}</span>
          </div>
          <div class="info-item">
            <span>Next Term Begins</span>
            <span>${escapeHtml(formatMetadata(data.termInfo?.nextTermBegins ?? "—"))}</span>
          </div>
          <div class="info-item">
            <span>Fees Balance</span>
            <span>${escapeHtml(formatMetadata(data.fees?.outstanding ?? "—"))}</span>
          </div>
          <div class="info-item">
            <span>Next Term Fees</span>
            <span>${escapeHtml(formatMetadata(data.fees?.nextTerm ?? "—"))}</span>
          </div>
        </div>
      </section>

      <div class="signature">
        <div>
          <div class="muted">Class Teacher Signature</div>
          <div class="signature-line"></div>
        </div>
        <div>
          <div class="muted">Head Teacher Signature</div>
          ${
            data.branding?.signature
              ? `<div class="signature-image"><img src="${escapeHtml(data.branding.signature)}" alt="Head Teacher signature" /></div>`
              : '<div class="signature-placeholder">Signature Pending</div>'
          }
          ${
            data.branding?.headmasterName
              ? `<div class="signature-name">${escapeHtml(data.branding.headmasterName)}</div>`
              : ""
          }
        </div>
      </div>

      <footer class="footer">
        <span>Generated on ${new Date().toLocaleDateString()}</span>
        <span>Powered by VEA School Portal</span>
      </footer>
    </body>
  </html>`
}
