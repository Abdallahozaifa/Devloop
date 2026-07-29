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
 *   inspect(reqNum)            full read chain for one requisition
 *   inspectDraft(draftId)      read a known draft's children directly
 *   createAndReadDraft(req)    create draft + immediately read questionnaire
 *   describeDrafts()           check finders/actions - is discovery possible?
 *   describeQuestionnaire(p)   POST to indexSearch endpoint for full Q content
 *   readQuestionnaireContent() parse described questionnaire into table
 *   findChoices(qId,ver,sampleQ) discover where answer choices live
 *   readAnswers(qResp)         flatten questionnaire into readable table
 *   resolveAnswer(id)          lookup answer text from LOV
 *
 * ANSWER WRITE LAYER
 *   setAnswer(...)          write a single answer to a live draft
 *   applyAnswers(draftId,q) apply all ANSWER_MAP entries to a draft
 *   submitDraftWithAnswers  create draft + answers in one batch (real pattern)
 *
 * TEST RUNNER
 *   testFlow(reqNum, opts)  end-to-end test: eligibility -> questionnaire ->
 *                           draft+answers -> verify. STOPS before esign/confirm.
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

/**
 * Debug: Test recruitingICEApplyFlows endpoint directly.
 * This is the SPA's "start application" resource - should contain questionnaireId.
 * @param {string} requisitionId - The RequisitionId (numeric ID, not the req number)
 */
globalThis.debugApplyFlows = async function (requisitionId) {
  console.log("\n=== DEBUG: recruitingICEApplyFlows ===");
  console.log(`RequisitionId: ${requisitionId}`);

  const attempts = [];

  // Attempt 1: findByRequisitionId
  console.log("\n[1] Trying finder=findByRequisitionId...");
  try {
    const data = await api(
      `/recruitingICEApplyFlows?finder=findByRequisitionId;RequisitionId=${requisitionId}&onlyData=true`
    );
    console.log("SUCCESS - Response:", data);
    const item = data.items?.[0] ?? data;
    console.log("First item fields:", Object.keys(item));
    console.log("Full item:", item);
    attempts.push({ finder: "findByRequisitionId", status: "OK", data: item });
  } catch (e) {
    console.log(`FAIL - ${e.message}`);
    if (e.body) {
      console.log("Error body (check for valid finders):", e.body);
    }
    attempts.push({ finder: "findByRequisitionId", status: "FAIL", error: e.message, body: e.body });
  }

  // Attempt 2: findByRequisition (alternate name)
  console.log("\n[2] Trying finder=findByRequisition...");
  try {
    const data = await api(
      `/recruitingICEApplyFlows?finder=findByRequisition;RequisitionId=${requisitionId}&onlyData=true`
    );
    console.log("SUCCESS - Response:", data);
    attempts.push({ finder: "findByRequisition", status: "OK", data });
  } catch (e) {
    console.log(`FAIL - ${e.message}`);
    attempts.push({ finder: "findByRequisition", status: "FAIL", error: e.message });
  }

  // Attempt 3: No finder, just query param
  console.log("\n[3] Trying q=RequisitionId=...");
  try {
    const data = await api(
      `/recruitingICEApplyFlows?q=RequisitionId=${requisitionId}&onlyData=true`
    );
    console.log("SUCCESS - Response:", data);
    attempts.push({ finder: "q=RequisitionId", status: "OK", data });
  } catch (e) {
    console.log(`FAIL - ${e.message}`);
    attempts.push({ finder: "q=RequisitionId", status: "FAIL", error: e.message });
  }

  // Attempt 4: Describe the resource to see available finders
  console.log("\n[4] Describing resource to find valid finders...");
  try {
    const desc = await api("/recruitingICEApplyFlows/describe");
    const res = desc.Resources?.recruitingICEApplyFlows || desc;
    const finders = res.collection?.finders?.map(f => f.name) || [];
    console.log("Available finders:", finders);
    attempts.push({ finder: "describe", status: "OK", finders });
  } catch (e) {
    console.log(`FAIL - ${e.message}`);
    attempts.push({ finder: "describe", status: "FAIL", error: e.message });
  }

  console.log("\n=== SUMMARY ===");
  console.table(attempts.map(a => ({ finder: a.finder, status: a.status, finders: a.finders?.join(", ") || "" })));

  return attempts;
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
 * Your answers, keyed by QuestionCode -> QuestionAnswerId.
 * Fill this in AFTER reading the rendered questions via createAndReadDraft().
 * These are regulatory attestations — set them yourself, once, having read
 * the full question text. applyAnswers() uses this map to write answers.
 *
 * Example:
 *   ANSWER_MAP["IRC_WORK_AUTH_US"] = 300000123456789;
 */
globalThis.ANSWER_MAP = globalThis.ANSWER_MAP || {};

/**
 * Pre-captured answer pairs from a working submission.
 * Array of {QuestionnaireQuestionId, QuestionAnswerId}.
 * Used as default for testFlow if opts.answers not provided.
 */
globalThis.TEST_ANSWERS = globalThis.TEST_ANSWERS || [
  { QuestionnaireQuestionId: "300087165284932", QuestionAnswerId: "300055639616240" },
  { QuestionnaireQuestionId: "300087165284926", QuestionAnswerId: "300055639616236" },
  { QuestionnaireQuestionId: "300087165284929", QuestionAnswerId: "300055639616096" },
];

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

/**
 * Describe the drafts resource to see finders and actions as flat name arrays.
 * If DRAFT FINDERS is just ["PrimaryKey"], discovery is impossible by design.
 */
globalThis.describeDrafts = async function () {
  dlog(`[describeDrafts] fetching /recruitingICEJobApplicationDrafts/describe...`);

  try {
    const d = await api("/recruitingICEJobApplicationDrafts/describe");
    const r = d.Resources.recruitingICEJobApplicationDrafts;

    console.log("DRAFT FINDERS:", r.collection?.finders?.map(f => f.name) || "(none)");
    console.log("DRAFT COLLECTION ACTIONS:", r.collection?.actions?.map(a => a.name) || "(none)");
    console.log("DRAFT ITEM ACTIONS:", r.item?.actions?.map(a => a.name) || "(none)");
    console.log("QR CHILD FINDERS:", r.children?.questionnaireResponses?.collection?.finders?.map(f => f.name) || "(none)");
    console.log("QR CHILD ITEM ACTIONS:", r.children?.questionnaireResponses?.item?.actions?.map(a => a.name) || "(none)");

    dlog(`[describeDrafts] complete`);
    return r;
  } catch (e) {
    dlog(`[describeDrafts] FAIL -`, e.message, e.body);
    return { status: "FAIL", error: e.message, body: e.body };
  }
};

/**
 * Parse a described questionnaire structure and console.table the questions.
 * Walks components.schemas.Questionnaire["x-hints"].sections[].questions[]
 */
globalThis.readQuestionnaireContent = function (described) {
  const sections = described?.components?.schemas?.Questionnaire?.["x-hints"]?.sections;

  if (!sections || !Array.isArray(sections)) {
    console.warn("[orc] readQuestionnaireContent: no sections found. Raw structure:");
    console.log(described);
    return [];
  }

  console.log("[orc] Raw sections:", sections);

  const rows = [];
  for (const section of sections) {
    const questions = section.questions || [];
    for (const q of questions) {
      // Extract answer choices/options if present
      let choices = null;
      if (q.choices) choices = q.choices;
      else if (q.options) choices = q.options;
      else if (q.answerChoices) choices = q.answerChoices;
      else if (q.answers) choices = q.answers;

      rows.push({
        questionId: q.questionId || q.QuestionId || null,
        questionnaireQuestionId: q.questionnaireQuestionId || q.QuestionnaireQuestionId || null,
        title: q.title || q.questionText || q.QuestionText || "",  // NOT truncated
        renderType: q.renderType || q.type || null,
        choices: choices ? JSON.stringify(choices) : null,
      });
    }
  }

  if (rows.length === 0) {
    console.warn("[orc] readQuestionnaireContent: no questions found in sections");
  } else {
    console.table(rows);
  }

  return rows;
};

/**
 * POST to the indexSearch questionnaire/describe endpoint.
 * This returns full questionnaire content (questions + answer choices) WITHOUT needing a draft.
 * Payload shape varies - pass whatever the captured request used (e.g. {questionnaireId, version}).
 */
globalThis.describeQuestionnaire = async function (payload) {
  const url = `${location.origin}/hcmRestApi/indexSearch/questionnaire/describe`;
  dlog(`[describeQuestionnaire] POST ${url}`);
  dlog(`[describeQuestionnaire] payload:`, payload);

  try {
    const r = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "Rest-Framework-Version": "9",
      },
      body: JSON.stringify(payload),
    });

    const text = await r.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }

    if (!r.ok) {
      dlog(`[describeQuestionnaire] FAIL - HTTP ${r.status}`, body);
      return { status: "FAIL", httpStatus: r.status, body };
    }

    dlog(`[describeQuestionnaire] OK`);
    console.log("[orc] describeQuestionnaire response:", body);

    // Auto-call readQuestionnaireContent
    const questions = readQuestionnaireContent(body);

    return { status: "OK", raw: body, questions };
  } catch (e) {
    dlog(`[describeQuestionnaire] FAIL -`, e.message);
    return { status: "FAIL", error: e.message };
  }
};

/**
 * Discover where answer choices (QuestionAnswerId values) live.
 * Tries multiple approaches and logs OK/FAIL for each.
 * Read-only discovery only.
 */
globalThis.findChoices = async function (questionnaireId, version, sampleQuestionId) {
  const results = {
    expandedDescribe: [],
    questionAnswersLOV: null,
    resourceEnumeration: null,
  };

  const indexUrl = `${location.origin}/hcmRestApi/indexSearch/questionnaire/describe`;

  // Approach 1a: Try with includeChoices flag
  dlog(`[findChoices 1a] trying includeChoices:true...`);
  try {
    const r = await fetch(indexUrl, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "Rest-Framework-Version": "9" },
      body: JSON.stringify({ questionnaireId, version, includeChoices: true }),
    });
    const text = await r.text();
    let body; try { body = JSON.parse(text); } catch { body = text; }
    const hasChoices = checkForChoices(body);
    results.expandedDescribe.push({ variant: "includeChoices:true", status: r.ok ? "OK" : "FAIL", httpStatus: r.status, hasChoices, body });
    dlog(`[findChoices 1a] ${r.ok ? "OK" : "FAIL"} - hasChoices: ${hasChoices}`);
  } catch (e) {
    results.expandedDescribe.push({ variant: "includeChoices:true", status: "FAIL", error: e.message });
    dlog(`[findChoices 1a] FAIL -`, e.message);
  }

  // Approach 1b: Try with expand:"all"
  dlog(`[findChoices 1b] trying expand:"all"...`);
  try {
    const r = await fetch(indexUrl, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "Rest-Framework-Version": "9" },
      body: JSON.stringify({ questionnaireId, version, expand: "all" }),
    });
    const text = await r.text();
    let body; try { body = JSON.parse(text); } catch { body = text; }
    const hasChoices = checkForChoices(body);
    results.expandedDescribe.push({ variant: "expand:all", status: r.ok ? "OK" : "FAIL", httpStatus: r.status, hasChoices, body });
    dlog(`[findChoices 1b] ${r.ok ? "OK" : "FAIL"} - hasChoices: ${hasChoices}`);
  } catch (e) {
    results.expandedDescribe.push({ variant: "expand:all", status: "FAIL", error: e.message });
    dlog(`[findChoices 1b] FAIL -`, e.message);
  }

  // Approach 1c: Try with both flags
  dlog(`[findChoices 1c] trying both flags...`);
  try {
    const r = await fetch(indexUrl, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "Rest-Framework-Version": "9" },
      body: JSON.stringify({ questionnaireId, version, includeChoices: true, expand: "all" }),
    });
    const text = await r.text();
    let body; try { body = JSON.parse(text); } catch { body = text; }
    const hasChoices = checkForChoices(body);
    results.expandedDescribe.push({ variant: "both flags", status: r.ok ? "OK" : "FAIL", httpStatus: r.status, hasChoices, body });
    dlog(`[findChoices 1c] ${r.ok ? "OK" : "FAIL"} - hasChoices: ${hasChoices}`);
  } catch (e) {
    results.expandedDescribe.push({ variant: "both flags", status: "FAIL", error: e.message });
    dlog(`[findChoices 1c] FAIL -`, e.message);
  }

  // Approach 2: questionAnswersLOV filtered by QuestionId
  if (sampleQuestionId) {
    dlog(`[findChoices 2] trying questionAnswersLOV?q=QuestionId=${sampleQuestionId}...`);
    try {
      const data = await api(`/questionAnswersLOV?q=QuestionId=${sampleQuestionId}&onlyData=true`);
      results.questionAnswersLOV = { status: "OK", count: data.items?.length ?? 0, data };
      dlog(`[findChoices 2] OK - ${data.items?.length ?? 0} answers found`);
      if (data.items?.length) {
        console.log("[orc] questionAnswersLOV items:", data.items);
      }
    } catch (e) {
      results.questionAnswersLOV = { status: "FAIL", error: e.message, body: e.body };
      dlog(`[findChoices 2] FAIL -`, e.message, e.body);
    }
  } else {
    dlog(`[findChoices 2] skipped - no sampleQuestionId provided`);
    results.questionAnswersLOV = { status: "SKIPPED", reason: "no sampleQuestionId" };
  }

  // Approach 3: Enumerate resources containing "nswer" or "hoice"
  dlog(`[findChoices 3] enumerating answer/choice resources via /describe...`);
  try {
    const desc = await api("/describe");
    const resources = desc.Resources || desc.resources || {};
    const names = Object.keys(resources);
    const answerResources = names.filter(n =>
      n.toLowerCase().includes("nswer") || n.toLowerCase().includes("hoice")
    );
    results.resourceEnumeration = { status: "OK", answerResources };
    console.log("[orc] Resources containing 'nswer' or 'hoice':", answerResources);
  } catch (e) {
    results.resourceEnumeration = { status: "FAIL", error: e.message, body: e.body };
    dlog(`[findChoices 3] FAIL -`, e.message, e.body);
  }

  // Summary
  console.log("\n=== FIND CHOICES SUMMARY ===");
  console.table(results.expandedDescribe.map(r => ({ variant: r.variant, status: r.status, hasChoices: r.hasChoices })));
  console.log("questionAnswersLOV:", results.questionAnswersLOV?.status, results.questionAnswersLOV?.count ?? "");
  console.log("answerResources:", results.resourceEnumeration?.answerResources || "(failed)");

  dlog(`[findChoices] complete`);
  return results;
};

// Helper to check if a describe response contains choices
function checkForChoices(body) {
  const sections = body?.components?.schemas?.Questionnaire?.["x-hints"]?.sections;
  if (!sections) return false;
  for (const section of sections) {
    for (const q of (section.questions || [])) {
      if (q.choices || q.options || q.answerChoices || q.answers) return true;
    }
  }
  return false;
}

/**
 * Submit draft with answers using the EXACT captured batch pattern.
 *
 * The real SPA batch has TWO parts:
 *   part 1: creates questionnaireResponses on a draft (references draftId in path)
 *   part 2: creates the draft itself via SAVE_DRAFT
 *
 * The interesting thing: part 1 references a draftId that part 2 creates.
 * Either batch ordering handles this, or the id is generated client-side,
 * or part references work across the batch. We replicate exactly and see.
 *
 * @param {string} requisitionNumber - The req number
 * @param {Array} answers - Array of {QuestionnaireQuestionId, QuestionAnswerId}
 * @param {string} draftId - Optional: if you have a draftId already, use it. Otherwise we try without.
 * @param {number} questionnaireVersionNumber - Version number (default 1)
 */
globalThis.submitDraftWithAnswers = async function (requisitionNumber, answers, draftId, questionnaireVersionNumber = 1) {
  dlog(`[submitDraftWithAnswers] reqNum=${requisitionNumber}, ${answers.length} answers, draftId=${draftId || "(auto)"}`);

  // Build the questionResponses array from answers
  const questionResponses = answers.map(a => ({
    QuestionnaireQuestionId: a.QuestionnaireQuestionId,
    QuestionAnswerId: a.QuestionAnswerId,
    AnswerList: null,
    AnswerLargeObject: null,
  }));

  // The path for part 1 - if no draftId provided, try referencing part 2's result
  // Oracle batch may support ${draft-0.IceDraftId} or similar syntax
  const qrPath = draftId
    ? `${RESOURCE_ROOT}/recruitingICEJobApplicationDrafts/${draftId}/child/questionnaireResponses/`
    : `${RESOURCE_ROOT}/recruitingICEJobApplicationDrafts/\${draft-0.IceDraftId}/child/questionnaireResponses/`;

  const batchPayload = {
    parts: [
      // Part 1: Create questionnaireResponses (references draft)
      {
        id: "questionnaireResponse_internalCandidateQuestionnaireId",
        path: qrPath,
        operation: "create",
        payload: {
          Status: "I",
          QuestionnaireVersionNumber: questionnaireVersionNumber,
          questionResponses: questionResponses,
        },
      },
      // Part 2: Create the draft
      {
        id: "draft-0",
        path: `${RESOURCE_ROOT}/recruitingICEJobApplicationDrafts`,
        operation: "create",
        payload: {
          Action: "SAVE_DRAFT",
          RequisitionNumber: requisitionNumber,
          Content: JSON.stringify({ alternateEmail: "" }),
        },
      },
    ],
  };

  dlog(`[submitDraftWithAnswers] batch payload:`, JSON.stringify(batchPayload, null, 2));

  try {
    const r = await fetch(`${BASE}/`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/vnd.oracle.adf.batch+json",
        "Rest-Framework-Version": "9",
      },
      body: JSON.stringify(batchPayload),
    });

    const text = await r.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }

    console.log("[orc] submitDraftWithAnswers response:", body);

    if (!r.ok) {
      dlog(`[submitDraftWithAnswers] FAIL - HTTP ${r.status}`);
      return { status: "FAIL", httpStatus: r.status, body };
    }

    // Extract draftId from response if available
    const draftPart = body.parts?.find(p => p.id === "draft-0");
    const createdDraftId = draftPart?.payload?.IceDraftId;

    const qrPart = body.parts?.find(p => p.id === "questionnaireResponse_internalCandidateQuestionnaireId");

    dlog(`[submitDraftWithAnswers] OK - createdDraftId=${createdDraftId}`);

    return {
      status: "OK",
      draftId: createdDraftId,
      draftPart,
      qrPart,
      raw: body,
    };
  } catch (e) {
    dlog(`[submitDraftWithAnswers] FAIL -`, e.message);
    return { status: "FAIL", error: e.message };
  }
};

/**
 * Alternative: Try with reversed part order (draft first, then questionnaire).
 * Some batch systems execute in order and allow forward references.
 */
globalThis.submitDraftWithAnswersReversed = async function (requisitionNumber, answers, questionnaireVersionNumber = 1) {
  dlog(`[submitDraftWithAnswersReversed] trying reversed order (draft first)...`);

  const questionResponses = answers.map(a => ({
    QuestionnaireQuestionId: a.QuestionnaireQuestionId,
    QuestionAnswerId: a.QuestionAnswerId,
    AnswerList: null,
    AnswerLargeObject: null,
  }));

  const batchPayload = {
    parts: [
      // Part 1: Create the draft FIRST
      {
        id: "draft-0",
        path: `${RESOURCE_ROOT}/recruitingICEJobApplicationDrafts`,
        operation: "create",
        payload: {
          Action: "SAVE_DRAFT",
          RequisitionNumber: requisitionNumber,
          Content: JSON.stringify({ alternateEmail: "" }),
        },
      },
      // Part 2: Create questionnaireResponses (reference draft-0's result)
      {
        id: "questionnaireResponse_internalCandidateQuestionnaireId",
        path: `${RESOURCE_ROOT}/recruitingICEJobApplicationDrafts/\${draft-0.IceDraftId}/child/questionnaireResponses/`,
        operation: "create",
        payload: {
          Status: "I",
          QuestionnaireVersionNumber: questionnaireVersionNumber,
          questionResponses: questionResponses,
        },
      },
    ],
  };

  dlog(`[submitDraftWithAnswersReversed] batch payload:`, JSON.stringify(batchPayload, null, 2));

  try {
    const r = await fetch(`${BASE}/`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/vnd.oracle.adf.batch+json",
        "Rest-Framework-Version": "9",
      },
      body: JSON.stringify(batchPayload),
    });

    const text = await r.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }

    console.log("[orc] submitDraftWithAnswersReversed response:", body);

    if (!r.ok) {
      dlog(`[submitDraftWithAnswersReversed] FAIL - HTTP ${r.status}`);
      return { status: "FAIL", httpStatus: r.status, body };
    }

    const draftPart = body.parts?.find(p => p.id === "draft-0");
    const createdDraftId = draftPart?.payload?.IceDraftId;
    const qrPart = body.parts?.find(p => p.id === "questionnaireResponse_internalCandidateQuestionnaireId");

    dlog(`[submitDraftWithAnswersReversed] OK - createdDraftId=${createdDraftId}`);

    return {
      status: "OK",
      draftId: createdDraftId,
      draftPart,
      qrPart,
      raw: body,
    };
  } catch (e) {
    dlog(`[submitDraftWithAnswersReversed] FAIL -`, e.message);
    return { status: "FAIL", error: e.message };
  }
};

/**
 * End-to-end test runner. Read-only or reversible - does NOT esign or confirm.
 * Stops after verifying answers landed on draft.
 *
 * @param {string} reqNum - Requisition number to test
 * @param {object} opts - { answers: [...], questionnaireId, version }
 */
globalThis.testFlow = async function (reqNum, opts = {}) {
  const answers = opts.answers || TEST_ANSWERS;
  const results = {
    reqNum,
    RequisitionId: null,
    questionnaireId: opts.questionnaireId || null,
    questionnaireVersion: opts.version || null,
    draftId: null,
    answersStored: [],
    stages: {},
    allStagesPassed: false,
  };

  console.log("\n========== TEST FLOW START ==========");
  console.log(`RequisitionNumber: ${reqNum}`);
  console.log(`Answers to submit: ${answers.length}`);

  // STAGE 1: ELIGIBILITY
  console.log("\n--- STAGE 1: ELIGIBILITY ---");
  try {
    const fields = "RequisitionId,RequisitionNumber,HasAppliedFlag,CandidateReapplyFlag,RequisitionValidFlag";
    const data = await api(
      `/recruitingOppMktJobDetails?finder=findByNumber;RequisitionNumber=${reqNum}&fields=${fields}&onlyData=true`
    );
    const item = data.items?.[0] ?? data;
    results.RequisitionId = item.RequisitionId;

    if (item.HasAppliedFlag === true) {
      console.log("STAGE 1: FAIL - Already applied (HasAppliedFlag=true)");
      results.stages.eligibility = { status: "FAIL", reason: "already applied" };
      return results;
    }

    console.log(`STAGE 1: PASS - RequisitionId=${results.RequisitionId}, HasAppliedFlag=false`);
    results.stages.eligibility = { status: "PASS", data: item };
  } catch (e) {
    console.log(`STAGE 1: FAIL - ${e.message}`);
    results.stages.eligibility = { status: "FAIL", error: e.message };
    return results;
  }

  // STAGE 1.5: RESOLVE QUESTIONNAIRE ID
  // recruitingICEApplyFlows uses finder=findByRequisitionNumber with the HUMAN reqNum, not RequisitionId
  console.log("\n--- STAGE 1.5: RESOLVE QUESTIONNAIRE ID ---");
  if (!results.questionnaireId) {
    console.log(`Calling recruitingICEApplyFlows?finder=findByRequisitionNumber;RequisitionNumber=${reqNum}`);
    try {
      const afData = await api(
        `/recruitingICEApplyFlows?finder=findByRequisitionNumber;RequisitionNumber=${reqNum}&onlyData=true`
      );

      // Log full response to see exact field names
      console.log("recruitingICEApplyFlows FULL RESPONSE:", afData);

      const afItem = afData.items?.[0] ?? afData;
      console.log("First item:", afItem);
      console.log("All field names:", Object.keys(afItem));

      // Try various casings for QuestionnaireId
      const qId = afItem.QuestionnaireId
        || afItem.questionnaireId
        || afItem.InternalQuestionnaireId
        || afItem.internalQuestionnaireId
        || afItem.QuestId
        || afItem.questId;

      // Try various casings for version
      const qVer = afItem.QuestionnaireVersionNumber
        || afItem.questionnaireVersionNumber
        || afItem.VersionNumber
        || afItem.versionNumber
        || afItem.Version
        || afItem.version
        || 1;

      if (qId) {
        results.questionnaireId = qId;
        results.questionnaireVersion = qVer;
        console.log(`STAGE 1.5: PASS - QuestionnaireId=${qId}, Version=${qVer}`);
        results.stages.resolveQuestionnaire = { status: "PASS", source: "applyFlows", questionnaireId: qId, version: qVer, data: afItem };
      } else {
        // QuestionnaireId not directly on item - check for nested/child structures
        console.log("\nQuestionnaireId NOT found directly on item.");
        console.log("Checking for nested structures...");

        // Check common nested patterns
        const nestedChecks = [
          ["questionnaire", afItem.questionnaire],
          ["Questionnaire", afItem.Questionnaire],
          ["questionnaireInfo", afItem.questionnaireInfo],
          ["QuestionnaireInfo", afItem.QuestionnaireInfo],
          ["links", afItem.links],
          ["Links", afItem.Links],
          ["children", afItem.children],
        ];

        for (const [name, val] of nestedChecks) {
          if (val) {
            console.log(`Found nested "${name}":`, val);
          }
        }

        // Log all fields with their values for debugging
        console.log("\n=== ALL FIELDS ON APPLY FLOW ITEM ===");
        for (const [key, val] of Object.entries(afItem)) {
          const valStr = typeof val === "object" ? JSON.stringify(val) : String(val);
          console.log(`  ${key}: ${valStr.substring(0, 200)}${valStr.length > 200 ? "..." : ""}`);
        }

        console.log("\nSTAGE 1.5: FAIL - QuestionnaireId not found in response");
        console.log("Check the fields above for a questionnaire reference.");
        results.stages.resolveQuestionnaire = { status: "FAIL", reason: "QuestionnaireId not in response", fields: Object.keys(afItem), data: afItem };
      }
    } catch (e) {
      console.log(`recruitingICEApplyFlows FAILED - ${e.message}`);
      if (e.body) console.log("Error body:", e.body);
      results.stages.resolveQuestionnaire = { status: "FAIL", error: e.message, body: e.body };
    }
  } else {
    console.log(`STAGE 1.5: SKIP - questionnaireId already provided: ${results.questionnaireId}`);
    results.stages.resolveQuestionnaire = { status: "SKIP", reason: "already provided" };
  }

  // If we still don't have a questionnaireId, stop
  if (!results.questionnaireId) {
    console.log("\nSTAGE 1.5: FAIL - Could not resolve questionnaireId. Stopping.");
    return results;
  }

  // STAGE 2: QUESTIONNAIRE READ
  console.log("\n--- STAGE 2: QUESTIONNAIRE READ ---");
  if (results.questionnaireId) {
    try {
      const version = results.questionnaireVersion || opts.version || 1;
      const qRes = await describeQuestionnaire({
        questionnaireId: results.questionnaireId,
        version: version,
      });
      if (qRes.status === "OK" && qRes.questions?.length) {
        console.log(`STAGE 2: PASS - ${qRes.questions.length} questions found`);
        console.log("\nQuestions:");
        qRes.questions.forEach((q, i) => {
          console.log(`  ${i + 1}. [${q.questionnaireQuestionId}] ${q.title}`);
        });
        results.stages.questionnaireRead = { status: "PASS", count: qRes.questions.length, questions: qRes.questions };
      } else {
        console.log(`STAGE 2: PARTIAL - describeQuestionnaire returned but no questions parsed`);
        results.stages.questionnaireRead = { status: "PARTIAL", raw: qRes };
      }
    } catch (e) {
      console.log(`STAGE 2: FAIL - ${e.message}`);
      results.stages.questionnaireRead = { status: "FAIL", error: e.message };
      // Continue anyway - we can still try to submit answers
    }
  } else {
    console.log("STAGE 2: SKIP - No questionnaireId available");
    results.stages.questionnaireRead = { status: "SKIP", reason: "no questionnaireId" };
  }

  // STAGE 3: DRAFT + ANSWERS
  console.log("\n--- STAGE 3: DRAFT + ANSWERS ---");
  const qVersion = results.questionnaireVersion || opts.version || 1;
  try {
    // Try reversed order first (draft first, then QR) as it's more logical
    const submitRes = await submitDraftWithAnswersReversed(reqNum, answers, qVersion);

    if (submitRes.status === "OK" && submitRes.draftId) {
      console.log(`STAGE 3: PASS - Draft created, draftId=${submitRes.draftId}`);
      results.draftId = submitRes.draftId;
      results.stages.draftAnswers = { status: "PASS", draftId: submitRes.draftId };
    } else if (submitRes.status === "OK") {
      console.log("STAGE 3: PARTIAL - Batch returned 200 but no draftId in response");
      results.stages.draftAnswers = { status: "PARTIAL", raw: submitRes };
    } else {
      console.log(`STAGE 3: FAIL - ${submitRes.error || submitRes.httpStatus}`);
      results.stages.draftAnswers = { status: "FAIL", raw: submitRes };
      // Try the original order as fallback
      console.log("Trying original batch order...");
      const submitRes2 = await submitDraftWithAnswers(reqNum, answers, null, qVersion);
      if (submitRes2.status === "OK" && submitRes2.draftId) {
        console.log(`STAGE 3: PASS (fallback) - Draft created, draftId=${submitRes2.draftId}`);
        results.draftId = submitRes2.draftId;
        results.stages.draftAnswers = { status: "PASS", draftId: submitRes2.draftId, usedFallback: true };
      }
    }
  } catch (e) {
    console.log(`STAGE 3: FAIL - ${e.message}`);
    results.stages.draftAnswers = { status: "FAIL", error: e.message };
  }

  // STAGE 4: VERIFY
  console.log("\n--- STAGE 4: VERIFY ANSWERS ---");
  if (results.draftId) {
    try {
      const qrData = await api(
        `/recruitingICEJobApplicationDrafts/${results.draftId}/child/questionnaireResponses?onlyData=true&expand=all&limit=50`
      );

      // Extract stored answers
      const stored = [];
      if (qrData.items?.length) {
        for (const item of qrData.items) {
          const questions = item.questionResponses?.items || item.questionResponses || [];
          for (const q of questions) {
            if (q.QuestionnaireQuestionId && q.QuestionAnswerId) {
              stored.push({
                QuestionnaireQuestionId: q.QuestionnaireQuestionId,
                QuestionAnswerId: q.QuestionAnswerId,
              });
            }
          }
        }
      }

      results.answersStored = stored;

      if (stored.length > 0) {
        console.log(`STAGE 4: PASS - ${stored.length} answers verified on draft`);
        console.table(stored);
        results.stages.verify = { status: "PASS", count: stored.length };
      } else {
        console.log("STAGE 4: PARTIAL - Draft readable but no answers found");
        console.log("Raw questionnaireResponses:", qrData);
        results.stages.verify = { status: "PARTIAL", raw: qrData };
      }
    } catch (e) {
      console.log(`STAGE 4: FAIL - ${e.message}`);
      results.stages.verify = { status: "FAIL", error: e.message };
    }
  } else {
    console.log("STAGE 4: SKIP - No draftId to verify");
    results.stages.verify = { status: "SKIP", reason: "no draftId" };
  }

  // STAGE 5: STOP
  console.log("\n--- STAGE 5: STOP ---");
  console.log("STOPPED before submit - review above. No esign, no confirm.");

  // Summary
  results.allStagesPassed =
    results.stages.eligibility?.status === "PASS" &&
    results.stages.draftAnswers?.status === "PASS" &&
    results.stages.verify?.status === "PASS";

  console.log("\n========== TEST FLOW SUMMARY ==========");
  console.log({
    reqNum: results.reqNum,
    RequisitionId: results.RequisitionId,
    questionnaireId: results.questionnaireId,
    draftId: results.draftId,
    answersStored: results.answersStored.length,
    allStagesPassed: results.allStagesPassed,
  });

  return results;
};

// ---------------------------------------------------------------------------
// Debug / Inspection layer (read-only except draft creation)
// ---------------------------------------------------------------------------

/**
 * Flatten questionnaire response into a readable table.
 * Shows which questions have pre-filled answers vs blank.
 * Handles nested structures: questionResponses.items[] or questionResponses[] directly.
 */
globalThis.readAnswers = function (questionnaireResponse) {
  let questions = [];

  // Try to extract questions from various nested structures
  if (questionnaireResponse?.items?.length) {
    for (const item of questionnaireResponse.items) {
      // Direct question properties on item
      if (item.QuestionCode || item.QuestionId) {
        questions.push(item);
      }
      // Nested questionResponses.items[]
      if (item.questionResponses?.items?.length) {
        questions.push(...item.questionResponses.items);
      }
      // Nested questionResponses[] (array directly)
      if (Array.isArray(item.questionResponses) && item.questionResponses.length) {
        questions.push(...item.questionResponses);
      }
    }
  }

  if (questions.length === 0) {
    console.warn("[orc] readAnswers: no questions found. Raw structure:");
    console.log(questionnaireResponse);
    return [];
  }

  const rows = questions.map(q => ({
    QuestionCode: q.QuestionCode || "",
    QuestionText: (q.QuestionText || "").substring(0, 100) + ((q.QuestionText || "").length > 100 ? "..." : ""),
    QuestionId: q.QuestionId || null,
    QuestionAnswerId: q.QuestionAnswerId || null,
    AnswerList: q.AnswerList || null,
    answered: (q.QuestionAnswerId != null) || (q.AnswerList != null),
  }));

  console.table(rows);
  return rows;
};

/**
 * Lookup answer text from questionAnswersLOV.
 * May return 403 - if so, logs and moves on.
 */
globalThis.resolveAnswer = async function (questionAnswerId) {
  dlog(`[resolveAnswer] looking up QuestionAnswerId=${questionAnswerId}...`);
  try {
    const data = await api(`/questionAnswersLOV?q=QuestionAnswerId=${questionAnswerId}&onlyData=true`);
    const item = data.items?.[0];
    if (item) {
      dlog(`[resolveAnswer] OK - LongText:`, item.LongText || item.AnswerText || item);
      console.log("[orc] Answer text:", item.LongText || item.AnswerText || JSON.stringify(item));
    } else {
      dlog(`[resolveAnswer] OK but no items returned`);
    }
    return { status: "OK", data };
  } catch (e) {
    dlog(`[resolveAnswer] FAIL -`, e.message, e.body);
    console.warn("[orc] resolveAnswer failed (may be 403):", e.message);
    return { status: "FAIL", error: e.message, body: e.body };
  }
};

/**
 * Inspect a known draft directly by ID, bypassing discovery.
 * Read-only - does NOT create drafts.
 */
globalThis.inspectDraft = async function (draftId) {
  const result = {
    draftId,
    steps: {},
    questionnaireResponses: null,
    attachments: null,
    answersTable: null,
  };

  // Step A: GET questionnaireResponses
  dlog(`[inspectDraft A] fetching questionnaireResponses for draftId=${draftId}...`);
  try {
    const data = await api(
      `/recruitingICEJobApplicationDrafts/${draftId}/child/questionnaireResponses?onlyData=true&expand=all&limit=50`
    );
    result.questionnaireResponses = data;
    result.steps.questionnaireResponses = { status: "OK", count: data.items?.length ?? 0 };
    dlog(`[inspectDraft A] OK - ${data.items?.length ?? 0} items`);
    console.log("[orc] Raw questionnaireResponses:", data);

    // Run readAnswers
    dlog(`[inspectDraft A] calling readAnswers()...`);
    result.answersTable = readAnswers(data);
  } catch (e) {
    result.steps.questionnaireResponses = { status: "FAIL", error: e.message, body: e.body };
    dlog(`[inspectDraft A] FAIL -`, e.message, e.body);
  }

  // Step B: GET attachments (sanity check draft is live)
  dlog(`[inspectDraft B] fetching attachments for draftId=${draftId}...`);
  try {
    const data = await api(
      `/recruitingICEJobApplicationDrafts/${draftId}/child/attachments?onlyData=true`
    );
    result.attachments = data;
    result.steps.attachments = { status: "OK", count: data.items?.length ?? 0 };
    dlog(`[inspectDraft B] OK - ${data.items?.length ?? 0} attachments (draft is live)`);
  } catch (e) {
    result.steps.attachments = { status: "FAIL", error: e.message, body: e.body };
    dlog(`[inspectDraft B] FAIL -`, e.message, e.body);
  }

  dlog(`inspectDraft() complete for ${draftId}`);
  return result;
};

/**
 * Create a draft and IMMEDIATELY read its questionnaire while it's live.
 * DraftId can only be captured at creation time via batch response.
 * After CREATE_FROM_DRAFT the draft empties out and questionnaire is gone.
 */
globalThis.createAndReadDraft = async function (reqNum) {
  const result = {
    reqNum,
    steps: {},
    draftId: null,
    rawQuestionnaire: null,
    answers: null,
  };

  // Step A: POST to create draft
  dlog(`[createAndReadDraft A] creating draft for ${reqNum}...`);
  try {
    const createRes = await api("/recruitingICEJobApplicationDrafts", {
      method: "POST",
      body: JSON.stringify({
        Action: "SAVE_DRAFT",
        RequisitionNumber: reqNum,
        Content: JSON.stringify({ alternateEmail: "" }),
      }),
    });
    result.steps.createDraft = { status: "OK", response: createRes };
    dlog(`[createAndReadDraft A] OK - draft POST response:`, createRes);
    // Try to extract draftId from response (may be empty)
    if (createRes?.IceDraftId) {
      result.draftId = createRes.IceDraftId;
      dlog(`[createAndReadDraft A] got IceDraftId from response:`, result.draftId);
    }
  } catch (e) {
    result.steps.createDraft = { status: "FAIL", error: e.message, body: e.body };
    dlog(`[createAndReadDraft A] FAIL -`, e.message, e.body);
    return result;
  }

  // Step B: Batch read to try to get the draft back with its ID
  dlog(`[createAndReadDraft B] batch read to find draft...`);
  try {
    const batchRes = await batch([
      {
        id: "getDraft",
        path: `/recruitingICEJobApplicationDrafts?q=RequisitionNumber=${reqNum}&fields=IceDraftId,RequisitionNumber&onlyData=true`,
        operation: "get",
      },
    ]);
    result.steps.batchRead = { status: "OK", response: batchRes };
    dlog(`[createAndReadDraft B] batch response:`, batchRes);

    // Extract draftId from batch response
    const draftPart = batchRes?.parts?.find(p => p.id === "getDraft");
    const draftId = draftPart?.payload?.items?.[0]?.IceDraftId;
    if (draftId && !result.draftId) {
      result.draftId = draftId;
      dlog(`[createAndReadDraft B] got IceDraftId from batch:`, result.draftId);
    }
  } catch (e) {
    result.steps.batchRead = { status: "FAIL", error: e.message, body: e.body };
    dlog(`[createAndReadDraft B] FAIL -`, e.message, e.body);
  }

  // Step C: If we have a draftId, immediately read questionnaireResponses
  if (result.draftId) {
    dlog(`[createAndReadDraft C] reading questionnaireResponses for draftId=${result.draftId}...`);
    try {
      const qData = await api(
        `/recruitingICEJobApplicationDrafts/${result.draftId}/child/questionnaireResponses?onlyData=true&expand=all&limit=50`
      );
      result.rawQuestionnaire = qData;
      result.steps.readQuestionnaire = { status: "OK", count: qData.items?.length ?? 0 };
      dlog(`[createAndReadDraft C] OK - ${qData.items?.length ?? 0} items`);
      console.log("[orc] Raw questionnaire:", qData);

      // Run readAnswers
      dlog(`[createAndReadDraft C] calling readAnswers()...`);
      result.answers = readAnswers(qData);
    } catch (e) {
      result.steps.readQuestionnaire = { status: "FAIL", error: e.message, body: e.body };
      dlog(`[createAndReadDraft C] FAIL -`, e.message, e.body);
    }
  } else {
    dlog(`[createAndReadDraft C] skipped - no draftId obtained`);
    result.steps.readQuestionnaire = { status: "SKIPPED", reason: "no draftId" };
  }

  dlog(`createAndReadDraft() complete for ${reqNum}`);
  return result;
};

/**
 * Write a single answer to a live draft's questionnaire.
 * Mirrors the SPA's batch write shape for questionResponses.
 */
globalThis.setAnswer = async function (draftId, questionnaireResponseId, questionResponseId, questionnaireQuestionId, questionAnswerId) {
  dlog(`[setAnswer] writing answer to draft ${draftId}...`);
  dlog(`[setAnswer] questionnaireResponseId=${questionnaireResponseId}, questionResponseId=${questionResponseId}`);
  dlog(`[setAnswer] questionnaireQuestionId=${questionnaireQuestionId}, questionAnswerId=${questionAnswerId}`);

  // Build the batch payload matching SPA's shape
  const batchPayload = {
    parts: [
      {
        id: "setAnswer",
        path: `${RESOURCE_ROOT}/recruitingICEJobApplicationDrafts/${draftId}/child/questionnaireResponses/${questionnaireResponseId}/child/questionResponses/${questionResponseId}`,
        operation: "update",
        payload: {
          QuestionnaireQuestionId: questionnaireQuestionId,
          QuestionAnswerId: questionAnswerId,
        },
      },
    ],
  };

  dlog(`[setAnswer] request body:`, JSON.stringify(batchPayload, null, 2));

  try {
    const res = await fetch(`${BASE}/`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/vnd.oracle.adf.batch+json",
        "Rest-Framework-Version": "9",
      },
      body: JSON.stringify(batchPayload),
    });
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }

    if (!res.ok) {
      dlog(`[setAnswer] FAIL - HTTP ${res.status}`, body);
      return { status: "FAIL", httpStatus: res.status, body };
    }

    dlog(`[setAnswer] OK - response:`, body);
    console.log("[orc] setAnswer response:", body);
    return { status: "OK", response: body };
  } catch (e) {
    dlog(`[setAnswer] FAIL -`, e.message);
    return { status: "FAIL", error: e.message };
  }
};

/**
 * Apply all ANSWER_MAP entries to a live draft's questionnaire.
 * Iterates questions, looks up QuestionCode in ANSWER_MAP, calls setAnswer for matches.
 * Skips and warns on any question whose code is NOT in ANSWER_MAP (never guesses).
 */
globalThis.applyAnswers = async function (draftId, questionnaire) {
  dlog(`[applyAnswers] applying ANSWER_MAP to draft ${draftId}...`);

  if (!questionnaire?.items?.length) {
    console.warn("[orc] applyAnswers: no questionnaire items to process");
    return { status: "FAIL", reason: "no questionnaire items" };
  }

  const results = [];

  for (const qrItem of questionnaire.items) {
    const questionnaireResponseId = qrItem.QuestionnaireResponseId || qrItem.IceQuestionnaireResponseId;

    // Get questions from nested structure
    let questions = [];
    if (qrItem.questionResponses?.items?.length) {
      questions = qrItem.questionResponses.items;
    } else if (Array.isArray(qrItem.questionResponses)) {
      questions = qrItem.questionResponses;
    }

    for (const q of questions) {
      const code = q.QuestionCode;
      const questionResponseId = q.QuestionResponseId || q.IceQuestionResponseId;
      const questionnaireQuestionId = q.QuestionnaireQuestionId;

      if (!code) {
        dlog(`[applyAnswers] skipping question with no QuestionCode:`, q);
        continue;
      }

      if (!(code in ANSWER_MAP)) {
        console.warn(`[orc] applyAnswers: QuestionCode "${code}" not in ANSWER_MAP - skipping (never guess)`);
        results.push({ QuestionCode: code, status: "SKIPPED", reason: "not in ANSWER_MAP" });
        continue;
      }

      const answerId = ANSWER_MAP[code];
      dlog(`[applyAnswers] setting ${code} -> ${answerId}`);

      try {
        const res = await setAnswer(draftId, questionnaireResponseId, questionResponseId, questionnaireQuestionId, answerId);
        results.push({ QuestionCode: code, status: res.status, response: res });
      } catch (e) {
        results.push({ QuestionCode: code, status: "FAIL", error: e.message });
      }

      await pause();
    }
  }

  console.table(results.map(r => ({ QuestionCode: r.QuestionCode, status: r.status, reason: r.reason || "" })));
  dlog(`[applyAnswers] complete - ${results.length} questions processed`);
  return { status: "OK", results };
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

  // Step E: Try to read questionnaire responses WITHOUT DraftId (SPA uses RequisitionId alone)
  dlog(`[step E] attempting questionnaire reads without DraftId...`);
  result.steps.altQuestionnaireRoutes = { routes: {} };

  // Route E.1: recruitingUICandidateQuestionnaireResponses by RequisitionId
  if (result.RequisitionId) {
    try {
      const data = await api(
        `/recruitingUICandidateQuestionnaireResponses?finder=findByRequisitionId;RequisitionId=${result.RequisitionId}&onlyData=true&expand=all`
      );
      result.steps.altQuestionnaireRoutes.routes.uiCandidateQR = { status: "OK", data };
      dlog(`[step E.1] uiCandidateQR: OK`, data);
      if (data.items?.length && !result.questionnaire) {
        result.questionnaire = data;
        result.answersTable = readAnswers(data);
      }
    } catch (e) {
      result.steps.altQuestionnaireRoutes.routes.uiCandidateQR = { status: "FAIL", error: e.message, body: e.body };
      dlog(`[step E.1] uiCandidateQR: FAIL -`, e.message, e.body);
    }

    // Route E.2: recruitingICEJobApplications child questionnaireResponses with finder
    try {
      const data = await api(
        `/recruitingICEJobApplications?finder=findByRequisition;RequisitionId=${result.RequisitionId}&expand=questionnaireResponses&onlyData=true`
      );
      result.steps.altQuestionnaireRoutes.routes.iceJobAppQR = { status: "OK", data };
      dlog(`[step E.2] iceJobAppQR: OK`, data);
      const qr = data.items?.[0]?.questionnaireResponses;
      if (qr?.items?.length && !result.questionnaire) {
        result.questionnaire = qr;
        result.answersTable = readAnswers(qr);
      }
    } catch (e) {
      result.steps.altQuestionnaireRoutes.routes.iceJobAppQR = { status: "FAIL", error: e.message, body: e.body };
      dlog(`[step E.2] iceJobAppQR: FAIL -`, e.message, e.body);
    }
  }

  // Route E.3: Enumerate all questionnaire-related resources via /describe
  dlog(`[step E.3] enumerating questionnaire-related resources via /describe...`);
  try {
    const desc = await api("/describe");
    const resources = desc.Resources || desc.resources || [];
    const qResources = resources.filter(r => {
      const name = (r.name || r.Name || "").toLowerCase();
      return name.includes("uestionnaire") || name.includes("uestionresponse");
    }).map(r => r.name || r.Name);
    result.steps.altQuestionnaireRoutes.routes.describe = { status: "OK", questionnaireResources: qResources };
    dlog(`[step E.3] questionnaire-related resources:`, qResources);
    console.log("[orc] Questionnaire-related resources in this tenant:", qResources);
  } catch (e) {
    result.steps.altQuestionnaireRoutes.routes.describe = { status: "FAIL", error: e.message, body: e.body };
    dlog(`[step E.3] describe: FAIL -`, e.message, e.body);
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

console.log("loaded. await describeDrafts() | await createAndReadDraft('REQ123') | DEBUG=" + DEBUG);
