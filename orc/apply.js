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
 *   inspect(reqNum)         full read chain for one requisition
 *   inspectDraft(draftId)   read a known draft's children directly
 *   createAndReadDraft(req) create draft + immediately read questionnaire
 *   describeDrafts()        check finders/actions - is discovery possible?
 *   readAnswers(qResp)      flatten questionnaire into readable table
 *   resolveAnswer(id)       lookup answer text from LOV
 *
 * ANSWER WRITE LAYER
 *   setAnswer(...)          write a single answer to a live draft
 *   applyAnswers(draftId,q) apply all ANSWER_MAP entries to a draft
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
 * Your answers, keyed by QuestionCode -> QuestionAnswerId.
 * Fill this in AFTER reading the rendered questions via createAndReadDraft().
 * These are regulatory attestations — set them yourself, once, having read
 * the full question text. applyAnswers() uses this map to write answers.
 *
 * Example:
 *   ANSWER_MAP["IRC_WORK_AUTH_US"] = 300000123456789;
 */
globalThis.ANSWER_MAP = globalThis.ANSWER_MAP || {};

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
 * Describe the drafts resource to see finders, collection actions, item actions.
 * This definitively answers: is DraftId discovery possible, or POST-only by design?
 */
globalThis.describeDrafts = async function () {
  dlog(`[describeDrafts] fetching /recruitingICEJobApplicationDrafts/describe...`);

  try {
    const d = await api("/recruitingICEJobApplicationDrafts/describe");
    const res = d.Resources?.recruitingICEJobApplicationDrafts || d.Resources?.["recruitingICEJobApplicationDrafts"];

    if (!res) {
      console.warn("[orc] describeDrafts: resource not found in describe response");
      console.log("Raw describe:", d);
      return d;
    }

    // FINDERS - is there ANY way to look one up besides PrimaryKey?
    console.log("=== FINDERS (can we query drafts?) ===");
    console.log(JSON.stringify(res.collection?.finders, null, 2));

    // COLLECTION ACTIONS - is GET allowed, or POST-only?
    console.log("\n=== COLLECTION ACTIONS (GET allowed?) ===");
    console.log(JSON.stringify(res.collection?.actions, null, 2));

    // ITEM ACTIONS - can you GET one by id?
    console.log("\n=== ITEM ACTIONS (GET by ID?) ===");
    console.log(JSON.stringify(res.item?.actions, null, 2));

    // Check questionnaireResponses child
    const childKey = "recruitingICEJobApplicationDrafts-questionnaireResponses";
    const child = d.Resources?.[childKey];
    console.log("\n=== CHILD: questionnaireResponses ===");
    if (child) {
      console.log("CHILD FINDERS:", JSON.stringify(child.collection?.finders, null, 2));
      console.log("CHILD COLLECTION ACTIONS:", JSON.stringify(child.collection?.actions, null, 2));
    } else {
      console.log("Not in describe as separate resource. Check res.children:");
      console.log(JSON.stringify(res.children, null, 2));
    }

    dlog(`[describeDrafts] complete`);
    return { resource: res, child, raw: d };
  } catch (e) {
    dlog(`[describeDrafts] FAIL -`, e.message, e.body);
    return { status: "FAIL", error: e.message, body: e.body };
  }
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
