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
 *
 * DEBUG LAYER
 *   inspect(reqNum)      full read chain for one requisition
 *   readAnswers(qResp)   flatten questionnaire into readable table
 */

// ---------------------------------------------------------------------------
// Debug helpers
// ---------------------------------------------------------------------------

globalThis.DEBUG = true;

globalThis.dlog = function (...args) {
  if (globalThis.DEBUG) {
    console.log("[orc]", ...args);
  }
};

// ---------------------------------------------------------------------------
// Environment setup
// ---------------------------------------------------------------------------

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
globalThis.RESOURCE_ROOT = `/hcmRestApi/rest/${RV}/en/11.13.18.05:9`;
globalThis.BASE = `${HOST}${RESOURCE_ROOT}`;

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
  body: JSON.stringify({
    parts: parts.map(p => ({
      ...p,
      path: p.path.startsWith("/hcmRestApi") ? p.path : RESOURCE_ROOT + p.path,
    })),
  }),
});

globalThis.pause = () => new Promise(r => setTimeout(r, 2500 + Math.random() * 2500));

// ---------------------------------------------------------------------------
// Debug / Inspection layer (read-only except draft creation)
// ---------------------------------------------------------------------------

/**
 * Flatten questionnaire response into a readable table.
 * Shows which questions have pre-filled answers vs blank.
 */
globalThis.readAnswers = function (questionnaireResponse) {
  if (!questionnaireResponse || !Array.isArray(questionnaireResponse.items)) {
    console.warn("[orc] readAnswers: no items array found");
    return [];
  }

  const rows = questionnaireResponse.items.map(q => ({
    QuestionCode: q.QuestionCode || "",
    QuestionText: (q.QuestionText || "").substring(0, 60) + ((q.QuestionText || "").length > 60 ? "..." : ""),
    QuestionId: q.QuestionId || null,
    QuestionAnswerId: q.QuestionAnswerId || null,
    AnswerList: q.AnswerList || null,
    answered: (q.QuestionAnswerId != null) || (q.AnswerList != null),
  }));

  console.table(rows);
  return rows;
};

/**
 * Run the full read chain for one requisition.
 * Steps: jobDetails -> createDraft -> findDraft (3 routes) -> questionnaire
 */
globalThis.inspect = async function (reqNum) {
  const result = {
    reqNum,
    steps: {},
    RequisitionId: null,
    DraftId: null,
    questionnaire: null,
    answersTable: null,
  };

  // Step A: GET job details
  dlog(`[step A] fetching job details for ${reqNum}...`);
  try {
    const fields = "RequisitionId,RequisitionNumber,HasAppliedFlag,CandidateReapplyFlag,RequisitionValidFlag";
    const data = await api(
      `/recruitingOppMktJobDetails?finder=findByNumber;RequisitionNumber=${reqNum}&fields=${fields}&onlyData=true`
    );
    const item = data.items?.[0] ?? data;
    result.RequisitionId = item.RequisitionId;
    result.steps.jobDetails = { status: "OK", data: item };
    dlog(`[step A] OK - RequisitionId=${result.RequisitionId}`);
  } catch (e) {
    result.steps.jobDetails = { status: "FAIL", error: e.message, body: e.body };
    dlog(`[step A] FAIL -`, e.message);
    return result;
  }

  // Step B: POST draft (creates draft; response is empty, that's expected)
  dlog(`[step B] creating draft for ${reqNum}...`);
  try {
    await api("/recruitingICEJobApplicationDrafts", {
      method: "POST",
      body: JSON.stringify({
        Action: "SAVE_DRAFT",
        RequisitionNumber: reqNum,
        Content: JSON.stringify({ alternateEmail: "" }),
      }),
    });
    result.steps.createDraft = { status: "OK", note: "empty response expected" };
    dlog(`[step B] OK - draft created (empty response expected)`);
  } catch (e) {
    result.steps.createDraft = { status: "FAIL", error: e.message, body: e.body };
    dlog(`[step B] FAIL -`, e.message);
    // Continue anyway - draft might already exist
  }

  // Step C: Find DraftId via three routes
  dlog(`[step C] finding DraftId via 3 routes...`);
  result.steps.findDraft = { routes: {} };

  // Route 1: by RequisitionNumber
  try {
    const data = await api(
      `/recruitingICEJobApplicationDrafts?q=RequisitionNumber=${reqNum}&fields=IceDraftId&onlyData=true`
    );
    const draftId = data.items?.[0]?.IceDraftId;
    result.steps.findDraft.routes.byReqNum = { status: draftId ? "OK" : "OK (no ID)", data, DraftId: draftId };
    if (draftId && !result.DraftId) result.DraftId = draftId;
    dlog(`[step C.1] byReqNum: ${draftId ? "OK - DraftId=" + draftId : "OK (no ID found)"}`);
  } catch (e) {
    result.steps.findDraft.routes.byReqNum = { status: "FAIL", error: e.message, body: e.body };
    dlog(`[step C.1] byReqNum: FAIL -`, e.message);
  }

  // Route 2: by RequisitionId
  if (result.RequisitionId) {
    try {
      const data = await api(
        `/recruitingICEJobApplicationDrafts?q=RequisitionId=${result.RequisitionId}&fields=IceDraftId&onlyData=true`
      );
      const draftId = data.items?.[0]?.IceDraftId;
      result.steps.findDraft.routes.byReqId = { status: draftId ? "OK" : "OK (no ID)", data, DraftId: draftId };
      if (draftId && !result.DraftId) result.DraftId = draftId;
      dlog(`[step C.2] byReqId: ${draftId ? "OK - DraftId=" + draftId : "OK (no ID found)"}`);
    } catch (e) {
      result.steps.findDraft.routes.byReqId = { status: "FAIL", error: e.message, body: e.body };
      dlog(`[step C.2] byReqId: FAIL -`, e.message);
    }

    // Route 3: via candidateAssessments
    try {
      const data = await api(
        `/recruitingUICandidateAssessments?finder=findByRequisitionId;RequisitionId=${result.RequisitionId}&onlyData=true`
      );
      const draftId = data.items?.[0]?.DraftId;
      result.steps.findDraft.routes.byAssessments = { status: draftId ? "OK" : "OK (no ID)", data, DraftId: draftId };
      if (draftId && !result.DraftId) result.DraftId = draftId;
      dlog(`[step C.3] byAssessments: ${draftId ? "OK - DraftId=" + draftId : "OK (no ID found)"}`);
    } catch (e) {
      result.steps.findDraft.routes.byAssessments = { status: "FAIL", error: e.message, body: e.body };
      dlog(`[step C.3] byAssessments: FAIL -`, e.message);
    }
  }

  // Step D: GET questionnaire responses (if DraftId found)
  if (result.DraftId) {
    dlog(`[step D] fetching questionnaire for DraftId=${result.DraftId}...`);
    try {
      const data = await api(
        `/recruitingICEJobApplicationDrafts/${result.DraftId}/child/questionnaireResponses?onlyData=true&expand=all&limit=50`
      );
      result.questionnaire = data;
      result.steps.questionnaire = { status: "OK", count: data.items?.length ?? 0 };
      dlog(`[step D] OK - ${data.items?.length ?? 0} questions found`);

      // Auto-call readAnswers
      dlog(`[step D] calling readAnswers()...`);
      result.answersTable = readAnswers(data);
    } catch (e) {
      result.steps.questionnaire = { status: "FAIL", error: e.message, body: e.body };
      dlog(`[step D] FAIL -`, e.message);
    }
  } else {
    dlog(`[step D] skipped - no DraftId found`);
    result.steps.questionnaire = { status: "SKIPPED", reason: "no DraftId found" };
  }

  dlog(`inspect() complete for ${reqNum}`);
  return result;
};

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

// --- phase B: create drafts ------------------------------------------------
// Draft ID is not readable (empty response, collection 500s), but phaseC
// finds the draft by RequisitionNumber so no ID is needed downstream.

globalThis.phaseB = async function (reqs) {
  const out = [];
  for (const n of (reqs || ELIGIBLE || REQS)) {
    try {
      await api("/recruitingICEJobApplicationDrafts", {
        method: "POST",
        body: JSON.stringify({
          Action: "SAVE_DRAFT",
          RequisitionNumber: n,
          Content: JSON.stringify({ alternateEmail: "" }),
        }),
      });
      out.push({ reqNum: n, status: "draft created" });
      console.log(`${n}: draft created`);
    } catch (e) {
      console.error(n, e.message, e.body ?? "");
      out.push({ reqNum: n, error: e.message });
    }
    await pause();
  }

  console.table(out);
  globalThis.DRAFTS = out;
  return out;
};

// --- phase C: draft -> submission -------------------------------------------

globalThis.phaseC = async function (drafts) {
  const out = [];
  for (const d of (drafts || DRAFTS || []).filter(x => !x.error)) {
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

console.log("loaded. run: await phaseA()  |  await inspect('REQ123')  |  DEBUG=" + DEBUG);
