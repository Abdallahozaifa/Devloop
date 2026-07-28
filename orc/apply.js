/**
 * ORC internal bulk-apply — v3 (generic / hostable)
 *
 * No identifiers baked in. On first load it prompts for the three
 * environment-specific values and caches them on globalThis, so
 * re-pasting or re-loading in the same tab won't ask again.
 *
 * The hosted file is safe to keep in a repo: it names no person,
 * no token, no company. Everything identifying is entered at runtime.
 *
 * PHASES
 *   A  preflight        read-only. which reqs are eligible
 *   B  draft            drafts + questionnaire answers. reversible
 *   C  createFromDraft  creates SUBMISSIONS. visible, not confirmed
 *   D  confirm          esign + CONFIRM. IRREVERSIBLE
 *
 * Run A, B, C, inspect, then D. Nothing chains past C automatically.
 */

globalThis.ENV = globalThis.ENV || (function () {
  const rv = prompt("rv: deployment token — copy from any request URL, the part like rv:f06e81c8-...");
  return {
    RV:         rv.startsWith("rv:") ? rv : "rv:" + rv,
    HOST:       location.origin,
    PERSON_ID:  prompt("Your PersonId (from the e-sign request payload)"),
    ESIGN_NAME: prompt("Your legal name, exactly as it appears on file"),
  };
})();

globalThis.RV   = ENV.RV;
globalThis.HOST = ENV.HOST;
globalThis.BASE = `${HOST}/hcmRestApi/rest/${RV}/en/11.13.18.05:9`;

globalThis.ME = { PERSON_ID: ENV.PERSON_ID, ESIGN_NAME: ENV.ESIGN_NAME };

globalThis.REQS = globalThis.REQS || [
  // paste your requisition numbers here, or set globalThis.REQS before loading
];
/**
 * Your answers, keyed by QuestionCode. Fill this in from phase B output.
 * These are regulatory attestations — set them yourself, once, having read
 * the question text that phase B prints.
 */
globalThis.ANSWER_MAP = {
  // "QUESTION_CODE_HERE": 300000000000000,   // fill from phase B output
};

// ---------------------------------------------------------------------------

globalThis.api = async function (path, opts = {}) {
  const r = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "Rest-Framework-Version": "9",
      ...(opts.headers || {}),
    },
    ...opts,
  });
  const t = await r.text();
  let b; try { b = JSON.parse(t); } catch { b = t; }
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status} ${path}`), { status: r.status, body: b });
  return b;
};

globalThis.batch = (parts) => api("/", {
  method: "POST",
  headers: { "Content-Type": "application/vnd.oracle.adf.batch+json" },
  body: JSON.stringify({ parts }),
});

globalThis.pause = () => new Promise(r => setTimeout(r, 2500 + Math.random() * 2500));

// --- phase A ---------------------------------------------------------------

globalThis.phaseA = async function () {
  const fields = "CandidateReapplyFlag,HasAppliedFlag,InternallyPostedFlag,"
               + "ProfileId,RequisitionId,RequisitionNumber,RequisitionValidFlag";
  const rows = [];
  for (const n of REQS) {
    try {
      const d = await api(`/recruitingOppMktJobDetails`
        + `?finder=findByNumber;RequisitionNumber=${n}&onlyData=true&fields=${fields}`);
      const item = d.items?.[0] ?? d;
      rows.push({
        reqNum: n,
        RequisitionId: item.RequisitionId,
        eligible: item.HasAppliedFlag !== true
               && String(item.CandidateReapplyFlag) !== "false"
               && item.RequisitionValidFlag === true,
      });
    } catch (e) { rows.push({ reqNum: n, error: e.message }); }
    await pause();
  }
  console.table(rows);
  globalThis.ELIGIBLE = rows.filter(r => r.eligible).map(r => r.reqNum);
  console.log("ELIGIBLE:", ELIGIBLE);
  return rows;
};

// --- phase B: draft + questionnaire ----------------------------------------

globalThis.questionnaireFor = (reqNum) =>
  api(`/questionnaireInstructions?finder=findByQuestionnaire;RequisitionNumber=${reqNum}&onlyData=true`);

globalThis.phaseB = async function (reqs) {
  const out = [];
  for (const n of (reqs || ELIGIBLE || REQS)) {
    try {
      const draft = await batch([{
        id: "draft-0",
        path: "/recruitingICEJobApplicationDrafts",
        operation: "create",
        payload: {
          Action: "SAVE_DRAFT",
          RequisitionNumber: n,
          Content: JSON.stringify({ alternateEmail: "" }),
        },
      }]);
      const draftId = draft?.parts?.[0]?.payload?.IceDraftId;
      if (!draftId) { console.error(n, "no IceDraftId:", draft); out.push({ reqNum: n, error: "no draftId" }); await pause(); continue; }

      const qnr = await api(`/recruitingICEJobApplicationDrafts/${draftId}`
        + `/child/questionnaireResponses?expand=all&onlyData=true&limit=50`);

      const qs = [];
      for (const resp of qnr.items || [])
        for (const q of resp.questionResponses?.items || resp.questionResponses || [])
          qs.push({
            QuestionnaireQuestionId: q.QuestionnaireQuestionId,
            QuestionCode: q.QuestionCode,
            QuestionText: q.QuestionText,
            currentAnswerId: q.QuestionAnswerId,
          });

      out.push({ reqNum: n, draftId, questionnaireVersion: qnr.items?.[0]?.QuestionnaireVersionNumber, questions: qs });
      console.log(`${n}: draft ${draftId}, ${qs.length} questions`);
    } catch (e) {
      console.error(n, e.message, e.body ?? "");
      out.push({ reqNum: n, error: e.message });
    }
    await pause();
  }

  const codes = new Set();
  out.forEach(o => (o.questions || []).forEach(q => codes.add(q.QuestionCode)));
  console.log("distinct QuestionCodes across all reqs:", [...codes]);
  console.table(out.map(o => ({ reqNum: o.reqNum, draftId: o.draftId, qCount: o.questions?.length, error: o.error ?? "" })));

  globalThis.DRAFTS = out;
  return out;
};

// --- phase C: draft -> submission -------------------------------------------

globalThis.phaseC = async function (drafts) {
  const out = [];
  for (const d of (drafts || DRAFTS || []).filter(x => x.draftId)) {
    try {
      const res = await api("/recruitingICEJobApplications", {
        method: "POST",
        body: JSON.stringify({
          Action: "CREATE_FROM_DRAFT",
          RequisitionNumber: d.reqNum,
          EsignDescriptionVersionId: null,
          Name: ME.ESIGN_NAME,
        }),
      });
      const sid = res.SubmissionId ?? res.submissionId;
      out.push({ reqNum: d.reqNum, SubmissionId: sid, raw: res });
      console.log(`${d.reqNum} -> submission ${sid}`);
    } catch (e) {
      console.error(d.reqNum, e.message, e.body ?? "");
      out.push({ reqNum: d.reqNum, error: e.message });
    }
    await pause();
  }
  console.table(out.map(({ reqNum, SubmissionId, error }) => ({ reqNum, SubmissionId, error: error ?? "" })));
  globalThis.SUBMISSIONS = out;
  return out;
};

// --- phase D: IRREVERSIBLE ---------------------------------------------------

globalThis.phaseD = async function (subs, iAmSure) {
  if (iAmSure !== "YES I REVIEWED THEM") {
    console.warn('Refusing. Call: phaseD(SUBMISSIONS, "YES I REVIEWED THEM")');
    return;
  }
  const out = [];
  for (const s of (subs || SUBMISSIONS || []).filter(x => x.SubmissionId)) {
    try {
      await api("/recruitingUIEsignatures", {
        method: "POST",
        body: JSON.stringify({
          Action: "validate",
          EsignName: ME.ESIGN_NAME,
          ObjectId: Number(s.SubmissionId),
          ObjectType: "ORA_SUBMISSION",
          PersonId: ME.PERSON_ID,
        }),
      });
      await api("/recruitingICEJobApplications", {
        method: "POST",
        body: JSON.stringify({ Action: "CONFIRM", SubmissionId: String(s.SubmissionId) }),
      });
      out.push({ reqNum: s.reqNum, status: "CONFIRMED" });
      console.log(`CONFIRMED ${s.reqNum}`);
    } catch (e) {
      console.error(s.reqNum, e.message, e.body ?? "");
      out.push({ reqNum: s.reqNum, error: e.message });
    }
    await pause();
  }
  console.table(out);
  return out;
};

console.log("loaded. run: await phaseA()");
