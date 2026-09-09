/**
 * PilotSetu Client-Side Store
 * localStorage-backed state management for problems, pilots, and KPI updates
 */

const KEYS = {
  problems: 'pilotsetu_problems',
  pilots: 'pilotsetu_pilots',
  initialized: 'pilotsetu_initialized',
};

/** Initialize store with seed data if not already done */
export function initStore(seedProblems, seedPilots) {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(KEYS.initialized)) return;

  localStorage.setItem(KEYS.problems, JSON.stringify(seedProblems));
  localStorage.setItem(KEYS.pilots, JSON.stringify(seedPilots));
  localStorage.setItem(KEYS.initialized, 'true');
}

/** Reset store to seed data */
export function resetStore(seedProblems, seedPilots) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.problems, JSON.stringify(seedProblems));
  localStorage.setItem(KEYS.pilots, JSON.stringify(seedPilots));
  localStorage.setItem(KEYS.initialized, 'true');
}

// ─── Problems ───

export function getProblems() {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(KEYS.problems);
  return data ? JSON.parse(data) : [];
}

export function getProblem(id) {
  return getProblems().find(p => p.id === id) || null;
}

export function addProblem(problem) {
  const problems = getProblems();
  const newProblem = {
    ...problem,
    id: `prob-${String(problems.length + 1).padStart(3, '0')}`,
    status: 'open',
    submittedAt: new Date().toISOString(),
  };
  problems.push(newProblem);
  localStorage.setItem(KEYS.problems, JSON.stringify(problems));
  return newProblem;
}

export function updateProblemStatus(id, status) {
  const problems = getProblems();
  const idx = problems.findIndex(p => p.id === id);
  if (idx !== -1) {
    problems[idx].status = status;
    localStorage.setItem(KEYS.problems, JSON.stringify(problems));
  }
  return problems[idx] || null;
}

// ─── Pilots ───

export function getPilots() {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(KEYS.pilots);
  return data ? JSON.parse(data) : [];
}

export function getPilot(id) {
  return getPilots().find(p => p.id === id) || null;
}

export function addPilot(pilot) {
  const pilots = getPilots();
  const newPilot = {
    ...pilot,
    id: `pilot-${String(pilots.length + 1).padStart(3, '0')}`,
    status: 'active',
    outcome: null,
  };
  pilots.push(newPilot);
  localStorage.setItem(KEYS.pilots, JSON.stringify(pilots));

  // Update problem status
  updateProblemStatus(pilot.problemId, 'pilot-active');

  return newPilot;
}

export function updateKpi(pilotId, kpiIndex, newCurrent) {
  const pilots = getPilots();
  const pilot = pilots.find(p => p.id === pilotId);
  if (pilot && pilot.kpis[kpiIndex]) {
    pilot.kpis[kpiIndex].current = parseFloat(newCurrent);
    localStorage.setItem(KEYS.pilots, JSON.stringify(pilots));
  }
  return pilot;
}

export function setOutcome(pilotId, outcome) {
  const pilots = getPilots();
  const pilot = pilots.find(p => p.id === pilotId);
  if (pilot) {
    pilot.outcome = outcome;
    pilot.status = 'completed';
    localStorage.setItem(KEYS.pilots, JSON.stringify(pilots));

    // Update problem status
    const status = outcome === 'scale' ? 'pilot-completed' : outcome === 'extend' ? 'pilot-active' : 'pilot-completed';
    updateProblemStatus(pilot.problemId, status);
  }
  return pilot;
}

// ─── Stats ───

export function getStats() {
  const problems = getProblems();
  const pilots = getPilots();

  const activePilots = pilots.filter(p => p.status === 'active');
  const completedPilots = pilots.filter(p => p.status === 'completed');
  const scaledPilots = completedPilots.filter(p => p.outcome === 'scale');

  return {
    totalProblems: problems.length,
    openProblems: problems.filter(p => p.status === 'open').length,
    activePilots: activePilots.length,
    completedPilots: completedPilots.length,
    matchedStartups: problems.filter(p => p.status === 'matched' || p.status === 'pilot-active' || p.status === 'pilot-completed').length,
    successRate: completedPilots.length > 0
      ? Math.round((scaledPilots.length / completedPilots.length) * 100)
      : 0,
  };
}
