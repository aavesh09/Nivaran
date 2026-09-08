/**
 * GovPilot Rule-Based Matching Engine
 * Scores startups against a government problem based on domain, stage, and team size.
 *
 * score = (domainOverlap × 0.5) + (stageFit × 0.3) + (teamSizeFit × 0.2)
 */

/**
 * Calculate domain overlap score (0–100)
 * Full match if any startup domain matches the problem domain
 */
function domainScore(problemDomain, startupDomains) {
  if (startupDomains.includes(problemDomain)) {
    // Bonus for specialists (single-domain startups matching exactly)
    return startupDomains.length === 1 ? 100 : 85;
  }
  // Partial credit for adjacent domains
  const adjacencyMap = {
    traffic: ['safety', 'digital'],
    waste: ['environment', 'digital'],
    water: ['environment', 'safety'],
    safety: ['traffic', 'digital'],
    energy: ['environment', 'digital'],
    digital: ['traffic', 'safety', 'energy'],
    environment: ['water', 'waste', 'energy'],
  };
  const adjacent = adjacencyMap[problemDomain] || [];
  const hasAdjacent = startupDomains.some(d => adjacent.includes(d));
  return hasAdjacent ? 35 : 0;
}

/**
 * Calculate stage fitness score (0–100)
 * Large budgets (>$150k) prefer growth-stage; smaller budgets prefer early-stage
 */
function stageScore(budget, startupStage) {
  const isLargeBudget = budget > 150000;

  if (isLargeBudget && startupStage === 'growth') return 100;
  if (isLargeBudget && startupStage === 'early') return 50;
  if (!isLargeBudget && startupStage === 'early') return 100;
  if (!isLargeBudget && startupStage === 'growth') return 60;
  return 50;
}

/**
 * Calculate team size fitness score (0–100)
 * Higher urgency prefers larger teams; medium/low urgency is flexible
 */
function teamSizeScore(urgency, teamSize) {
  const urgencyMap = { critical: 30, high: 20, medium: 10, low: 5 };
  const idealMin = urgencyMap[urgency] || 10;

  if (teamSize >= idealMin) return 100;
  if (teamSize >= idealMin * 0.5) return 70;
  return 40;
}

/**
 * Match startups to a problem and return sorted results
 * @param {Object} problem - The government problem
 * @param {Array} startups - List of startups to score
 * @returns {Array} Startups sorted by match score (highest first)
 */
export function matchStartups(problem, startups) {
  const results = startups.map(startup => {
    const domain = domainScore(problem.domain, startup.domains);
    const stage = stageScore(problem.budget, startup.stage);
    const team = teamSizeScore(problem.urgency, startup.teamSize);

    const totalScore = Math.round(
      (domain * 0.5) + (stage * 0.3) + (team * 0.2)
    );

    return {
      ...startup,
      matchScore: totalScore,
      matchBreakdown: {
        domain,
        stage,
        team,
      },
    };
  });

  return results.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Get match quality label based on score
 */
export function getMatchLabel(score) {
  if (score >= 80) return { label: 'Excellent', color: 'emerald' };
  if (score >= 60) return { label: 'Good', color: 'blue' };
  if (score >= 40) return { label: 'Fair', color: 'amber' };
  return { label: 'Low', color: 'red' };
}
