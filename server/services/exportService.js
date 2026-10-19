/**
 * Export Service
 * Formats examination papers into print-ready layouts and editable DOCX templates.
 */

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const generateStudentPaperHTML = (test) => {
  const sectionsHTML = (test.sections || [])
    .map(
      (sec) => `
    <div style="margin-top: 24px; margin-bottom: 16px; border-bottom: 2px solid #334155; padding-bottom: 4px;">
      <div style="display: flex; justify-content: space-between; align-items: baseline;">
        <h3 style="font-size: 15px; font-weight: 700; text-transform: uppercase; margin: 0; color: #0f172a;">${escapeHtml(sec.sectionTitle)}</h3>
        <span style="font-size: 13px; font-weight: 600; color: #475569;">[Marks: ${escapeHtml(sec.marks)}]</span>
      </div>
      <p style="font-size: 12px; font-style: italic; margin: 4px 0 0 0; color: #475569;">${escapeHtml(sec.instructions || '')}</p>
    </div>
    <div style="display: flex; flex-direction: column; gap: 14px;">
      ${sec.questions
        .map((q) => {
          let extra = '';
          if (q.questionType === 'mcq' && q.options) {
            extra = `
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-top: 6px; padding-left: 20px;">
                ${q.options
                  .map(
                    (opt, i) =>
                      `<div style="font-size: 13px; color: #334155;"><strong>(${String.fromCharCode(65 + i)})</strong> ${escapeHtml(opt)}</div>`
                  )
                  .join('')}
              </div>`;
          } else if (q.questionType === 'true_false') {
            extra = `
              <div style="display: flex; gap: 20px; margin-top: 4px; padding-left: 20px; font-size: 13px;">
                <span>[ &nbsp; ] <strong>True</strong></span>
                <span>[ &nbsp; ] <strong>False</strong></span>
              </div>`;
          } else if (q.questionType === 'fill_blanks') {
            extra = `<div style="font-size: 12px; color: #64748b; margin-top: 4px; padding-left: 20px;">Answer: _____________________________________________</div>`;
          } else if (q.questionType === 'short_answer') {
            extra = `<div style="height: 48px; border-bottom: 1px dashed #cbd5e1; margin-top: 6px;"></div>`;
          }

          return `
            <div style="page-break-inside: avoid; margin-bottom: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="font-size: 13.5px; line-height: 1.5; color: #0f172a;">
                  <strong>Q${escapeHtml(q.number)}.</strong> ${escapeHtml(q.questionText)}
                </div>
                <div style="font-size: 12px; font-weight: 600; color: #64748b; white-space: nowrap; margin-left: 12px;">
                  (${escapeHtml(q.marks)} Mark${q.marks > 1 ? 's' : ''})
                </div>
              </div>
              ${extra}
            </div>
          `;
        })
        .join('')}
    </div>
  `
    )
    .join('');

  const instructionsHTML = (test.instructions || [])
    .map((inst) => `<li style="margin-bottom: 3px;">${escapeHtml(inst)}</li>`)
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(test.title || 'Examination Paper')}</title>
  <style>
    @page { size: A4; margin: 15mm 20mm; }
    body { font-family: 'Times New Roman', Times, serif; color: #000; background: #fff; margin: 0; padding: 20px; line-height: 1.35; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; }
    .school-name { font-size: 22px; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px; }
    .exam-title { font-size: 16px; font-weight: bold; text-decoration: underline; margin-bottom: 8px; }
    .meta-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 14px; }
    .meta-table td { padding: 4px 6px; }
    .instructions-box { border: 1px solid #475569; border-radius: 4px; padding: 8px 12px; font-size: 12px; margin-bottom: 16px; background-color: #f8fafc; }
  </style>
</head>
<body>
  <div class="header">
    <div class="school-name">${escapeHtml(test.schoolName || 'ACADEMIC ASSESSMENT EXAMINATION')}</div>
    <div class="exam-title">${escapeHtml(test.examinationHeading || test.title)}</div>
    <div style="font-size: 13px; font-style: italic;">Curriculum: ${escapeHtml(test.boardName || 'National Curriculum Board')}</div>
  </div>

  <table class="meta-table">
    <tr>
      <td style="width: 25%;"><strong>Student Name:</strong> ______________________</td>
      <td style="width: 25%;"><strong>Roll Number:</strong> _____________</td>
      <td style="width: 25%;"><strong>Class / Grade:</strong> ${escapeHtml(test.className || 'Class 9')}</td>
      <td style="width: 25%;"><strong>Date:</strong> _________________</td>
    </tr>
    <tr>
      <td><strong>Subject:</strong> ${escapeHtml(test.subject)}</td>
      <td><strong>Max Marks:</strong> ${escapeHtml(test.totalMarks)}</td>
      <td><strong>Time Allowed:</strong> ${escapeHtml(test.durationMinutes || 90)} Minutes</td>
      <td><strong>Passing Marks:</strong> ${escapeHtml(test.passingMarks || Math.round(test.totalMarks * 0.4))}</td>
    </tr>
  </table>

  ${
    instructionsHTML
      ? `
    <div class="instructions-box">
      <strong>General Instructions for Candidates:</strong>
      <ol style="margin: 4px 0 0 16px; padding: 0;">
        ${instructionsHTML}
      </ol>
    </div>`
      : ''
  }

  ${sectionsHTML}

  <div style="text-align: center; font-size: 12px; font-weight: bold; margin-top: 36px; border-top: 1px solid #94a3b8; padding-top: 8px;">
    --- END OF QUESTION PAPER ---
  </div>
</body>
</html>
  `;
};

const generateAnswerKeyHTML = (test) => {
  const sectionsHTML = (test.sections || [])
    .map(
      (sec) => `
    <div style="margin-top: 20px; margin-bottom: 12px; border-bottom: 1.5px solid #0f172a; padding-bottom: 4px;">
      <h3 style="font-size: 14px; font-weight: bold; text-transform: uppercase; margin: 0; color: #1e3a8a;">${escapeHtml(sec.sectionTitle)}</h3>
    </div>
    <div style="display: flex; flex-direction: column; gap: 12px;">
      ${sec.questions
        .map((q) => {
          let answerDisplay = '';
          if (q.questionType === 'mcq' && q.options) {
            const correctOpt = q.options[q.correctAnswer] || q.correctAnswer;
            answerDisplay = `
              <div style="font-size: 13px; color: #065f46; font-weight: 600;">
                Correct Option: (${String.fromCharCode(65 + Number(q.correctAnswer || 0))}) ${escapeHtml(correctOpt)}
              </div>`;
          } else {
            answerDisplay = `
              <div style="font-size: 13px; color: #0f172a; background: #f1f5f9; padding: 8px; border-radius: 4px; margin-top: 4px;">
                <strong>Model Answer / Solution:</strong><br />
                ${escapeHtml(q.correctAnswer || 'Reference textbook curriculum text.')}
              </div>`;
          }

          return `
            <div style="page-break-inside: avoid; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; background: #ffffff;">
              <div style="display: flex; justify-content: space-between;">
                <div style="font-size: 13px; font-weight: bold; color: #1e293b;">Q${escapeHtml(q.number)}. ${escapeHtml(q.questionText)}</div>
                <div style="font-size: 12px; font-weight: bold; color: #2563eb;">[${escapeHtml(q.marks)} Mark${q.marks > 1 ? 's' : ''}]</div>
              </div>
              ${answerDisplay}
              ${
                q.explanation
                  ? `<div style="font-size: 12px; color: #475569; margin-top: 4px;"><em>Marking Rubric / Criteria:</em> ${escapeHtml(q.explanation)}</div>`
                  : ''
              }
              ${
                q.sourceReference
                  ? `<div style="font-size: 11px; color: #64748b; margin-top: 4px;"><strong>Source Ref:</strong> ${escapeHtml(q.sourceReference)}</div>`
                  : ''
              }
            </div>
          `;
        })
        .join('')}
    </div>
  `
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Teacher Answer Key - ${escapeHtml(test.title)}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; background: #fff; margin: 0; padding: 24px; line-height: 1.4; }
    .header { text-align: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 18px; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="font-size: 20px; color: #1e3a8a; margin: 0 0 4px 0;">TEACHER MARKING SCHEME & ANSWER KEY</h1>
    <h2 style="font-size: 15px; color: #334155; margin: 0 0 4px 0;">${escapeHtml(test.title)}</h2>
    <div style="font-size: 12px; color: #64748b;">Subject: ${escapeHtml(test.subject)} | Class: ${escapeHtml(test.className)} | Total Marks: ${escapeHtml(test.totalMarks)}</div>
  </div>
  ${sectionsHTML}
</body>
</html>
  `;
};

module.exports = {
  generateStudentPaperHTML,
  generateAnswerKeyHTML,
};
