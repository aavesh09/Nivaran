/**
 * PilotSetu — Client-Side Store
 * All data persisted in localStorage. Seed data loaded from JSON files on first run.
 * 
 * Status state machine:
 * open → matched → pilot_running → pilot_complete → approved_for_scale | not_approved
 */

const STORE_KEY = 'pilotsetu_store';

/** @returns {import('./store').Store} */
export function getStore() {
  const raw = localStorage.getItem(STORE_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  return null;
}

/** @param {import('./store').Store} store */
function saveStore(store) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

/**
 * Initialize store with seed data on first page load.
 * If store already exists in localStorage, leave it untouched.
 */
export function initStore(seedProblems, seedApplications, seedPilotRuns, seedScaleDecisions) {
  if (getStore()) return; // already initialized
  const store = {
    problems: seedProblems,
    applications: seedApplications,
    pilotRuns: seedPilotRuns,
    scaleDecisions: seedScaleDecisions,
  };
  saveStore(store);
}

/** Force-reset store to seed data (useful for dev/demo) */
export function resetStore(seedProblems, seedApplications, seedPilotRuns, seedScaleDecisions) {
  const store = {
    problems: seedProblems,
    applications: seedApplications,
    pilotRuns: seedPilotRuns,
    scaleDecisions: seedScaleDecisions,
  };
  saveStore(store);
  return store;
}

// ─── Problem CRUD ────────────────────────────────────────────────────────────

export function addProblem(fields) {
  const store = getStore();
  const problem = {
    id: 'prob-' + Date.now(),
    ...fields,
    status: 'open',
    created_at: new Date().toISOString(),
  };
  store.problems.unshift(problem);
  saveStore(store);
  return problem;
}

export function deleteProblem(problemId) {
  const store = getStore();
  store.problems = store.problems.filter(p => p.id !== problemId);
  // Cascade: remove related applications, pilots, scale decisions
  store.applications = store.applications.filter(a => a.problem_id !== problemId);
  store.pilotRuns = store.pilotRuns.filter(p => p.problem_id !== problemId);
  store.scaleDecisions = store.scaleDecisions.filter(s => s.problem_id !== problemId);
  saveStore(store);
}

export function updateProblemStatus(problemId, status) {
  const store = getStore();
  const prob = store.problems.find(p => p.id === problemId);
  if (prob) prob.status = status;
  saveStore(store);
}

// ─── Application CRUD ────────────────────────────────────────────────────────

export function addApplication(problemId, startupName, pitch) {
  const store = getStore();
  const app = {
    id: 'app-' + Date.now(),
    problem_id: problemId,
    startup_name: startupName,
    pitch,
    status: 'submitted',
    created_at: new Date().toISOString(),
  };
  store.applications.unshift(app);
  saveStore(store);
  return app;
}

export function shortlistApplication(applicationId) {
  const store = getStore();
  const app = store.applications.find(a => a.id === applicationId);
  if (!app) return;
  app.status = 'shortlisted';
  // Move problem to matched
  const prob = store.problems.find(p => p.id === app.problem_id);
  if (prob && prob.status === 'open') prob.status = 'matched';
  saveStore(store);
}

export function rejectApplication(applicationId) {
  const store = getStore();
  const app = store.applications.find(a => a.id === applicationId);
  if (app) app.status = 'rejected';
  saveStore(store);
}

// ─── Pilot CRUD ───────────────────────────────────────────────────────────────

export function startPilot(problemId, applicationId, scopeNotes, durationDays) {
  const store = getStore();
  const pilot = {
    id: 'pilot-' + Date.now(),
    problem_id: problemId,
    application_id: applicationId,
    scope_notes: scopeNotes,
    duration_days: Number(durationDays),
    start_date: new Date().toISOString().split('T')[0],
    after_value: null,
    field_notes: null,
    status: 'running',
  };
  store.pilotRuns.unshift(pilot);
  // Move problem to pilot_running
  const prob = store.problems.find(p => p.id === problemId);
  if (prob) prob.status = 'pilot_running';
  saveStore(store);
  return pilot;
}

export function recordPilotResult(problemId, afterValue, fieldNotes) {
  const store = getStore();
  const pilot = store.pilotRuns.find(p => p.problem_id === problemId && p.status === 'running');
  if (pilot) {
    pilot.after_value = Number(afterValue);
    pilot.field_notes = fieldNotes;
    pilot.status = 'complete';
  }
  // Move problem to pilot_complete
  const prob = store.problems.find(p => p.id === problemId);
  if (prob) prob.status = 'pilot_complete';
  saveStore(store);
}

// ─── Scale Decision ───────────────────────────────────────────────────────────

export function makeScaleDecision(problemId, decision, notes) {
  const store = getStore();
  const sd = {
    id: 'scale-' + Date.now(),
    problem_id: problemId,
    decision, // 'approved_for_scale' | 'not_approved'
    decided_at: new Date().toISOString(),
    notes,
  };
  store.scaleDecisions.unshift(sd);
  // Move problem to terminal status
  const prob = store.problems.find(p => p.id === problemId);
  if (prob) prob.status = decision;
  saveStore(store);
  return sd;
}

// ─── Computed helpers ─────────────────────────────────────────────────────────

/** Average % improvement across completed pilots (before→after relative change) */
export function avgImprovement(store) {
  const completedPilots = store.pilotRuns.filter(p => p.status === 'complete' && p.after_value !== null);
  if (completedPilots.length === 0) return null;
  let total = 0;
  let count = 0;
  for (const pilot of completedPilots) {
    const prob = store.problems.find(p => p.id === pilot.problem_id);
    if (!prob || prob.baseline_value === 0) continue;
    const baseline = prob.baseline_value;
    const after = pilot.after_value;
    let improvement;
    if (prob.metric_direction === 'lower_is_better') {
      improvement = ((baseline - after) / baseline) * 100;
    } else {
      improvement = ((after - baseline) / baseline) * 100;
    }
    total += improvement;
    count++;
  }
  return count > 0 ? Math.round(total / count) : null;
}
