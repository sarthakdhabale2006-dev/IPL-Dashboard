// Dashboard Page Controller
window.DashboardPage = {
  isInitialized: false,
  
  // Cache for precalculated dashboard metrics to avoid recalculating on tab switch
  metrics: null,

  init: function() {
    this.calculateMetrics();
    this.renderKPIs();
    this.renderCharts();
    this.isInitialized = true;
  },

  calculateMetrics: function() {
    if (this.metrics) return;

    const matches = window.IPLData.matches;
    const deliveries = window.IPLData.deliveries;

    let totalRuns = 0;
    let totalWickets = 0;
    let totalSixes = 0;
    let totalFours = 0;

    // Calculate boundary and run totals
    deliveries.forEach(d => {
      totalRuns += d.total_runs;
      if (d.batsman_runs === 6) totalSixes += 1;
      if (d.batsman_runs === 4) totalFours += 1;
      
      if (d.is_wicket && d.dismissal_kind) {
        const dk = d.dismissal_kind.trim().toLowerCase();
        // Standard wickets credited to bowler + run outs are general wickets
        if (dk !== 'na' && dk !== 'retired hurt' && dk !== 'retired out') {
          totalWickets += 1;
        }
      }
    });

    // Calculate Highest and Lowest Innings Scores
    const inningsGroup = {};
    deliveries.forEach(d => {
      const key = `${d.match_id}_${d.inning}`;
      if (!inningsGroup[key]) {
        inningsGroup[key] = {
          runs: 0,
          team: d.batting_team,
          legalBalls: 0
        };
      }
      inningsGroup[key].runs += d.total_runs;
      if (d.extras_type !== 'wides' && d.extras_type !== 'noballs') {
        inningsGroup[key].legalBalls += 1;
      }
    });

    let highestScore = 0;
    let highestTeam = "";
    let lowestScore = 999;
    let lowestTeam = "";

    Object.values(inningsGroup).forEach(i => {
      // Find highest score (any innings)
      if (i.runs > highestScore) {
        highestScore = i.runs;
        highestTeam = i.team;
      }
      // Find lowest score - filter for innings that faced at least 10 overs (60 legal balls) to avoid rain shortened matches
      if (i.legalBalls >= 60 && i.runs < lowestScore && i.runs > 0) {
        lowestScore = i.runs;
        lowestTeam = i.team;
      }
    });

    // Calculate average Strike Rate & Economy of active players
    let sumSR = 0;
    let countSRPlayers = 0;
    let sumEcon = 0;
    let countEconBowlers = 0;

    Object.values(window.IPLData.playerStatsIndex).forEach(p => {
      // Average strike rate of players who scored at least 150 runs
      if (p.runs >= 150 && p.battingSR > 0) {
        sumSR += p.battingSR;
        countSRPlayers += 1;
      }
      // Average economy of bowlers who bowled at least 15 overs (90 legal balls)
      if (p.ballsBowled >= 90 && p.economy > 0) {
        sumEcon += p.economy;
        countEconBowlers += 1;
      }
    });

    const avgSR = countSRPlayers > 0 ? (sumSR / countSRPlayers) : 130.0;
    const avgEcon = countEconBowlers > 0 ? (sumEcon / countEconBowlers) : 8.2;

    this.metrics = {
      totalMatches: matches.length,
      totalTeams: window.IPLData.teamsList.length,
      totalPlayers: window.IPLData.playersList.length,
      totalRuns,
      totalWickets,
      totalSixes,
      totalFours,
      avgScore: matches.length > 0 ? totalRuns / (matches.length * 2) : 0,
      highestScore: `${highestScore} (${highestTeam})`,
      lowestScore: `${lowestScore} (${lowestTeam})`,
      avgSR,
      avgEcon
    };
  },

  renderKPIs: function() {
    const m = this.metrics;
    
    document.getElementById('kpi-total-matches').textContent = formatNum(m.totalMatches);
    document.getElementById('kpi-total-teams').textContent = formatNum(m.totalTeams);
    document.getElementById('kpi-total-players').textContent = formatNum(m.totalPlayers);
    document.getElementById('kpi-total-runs').textContent = formatNum(m.totalRuns);
    document.getElementById('kpi-total-wickets').textContent = formatNum(m.totalWickets);
    document.getElementById('kpi-total-sixes').textContent = formatNum(m.totalSixes);
    document.getElementById('kpi-total-fours').textContent = formatNum(m.totalFours);
    document.getElementById('kpi-avg-score').textContent = formatRate(m.avgScore, 1);
    document.getElementById('kpi-highest-score').textContent = m.highestScore;
    document.getElementById('kpi-lowest-score').textContent = m.lowestScore;
    document.getElementById('kpi-avg-sr').textContent = formatRate(m.avgSR, 1) + "%";
    document.getElementById('kpi-avg-econ').textContent = formatRate(m.avgEcon, 2);
  },

  renderCharts: function() {
    const matches = window.IPLData.matches;
    const colors = window.ChartManager.getThemeColors();

    // 1. Team Wins (Bar Chart)
    const teamWins = {};
    matches.forEach(m => {
      if (m.winner) {
        teamWins[m.winner] = (teamWins[m.winner] || 0) + 1;
      }
    });

    // Sort teams by wins descending
    const sortedTeams = Object.keys(teamWins).sort((a, b) => teamWins[b] - teamWins[a]);
    const winData = sortedTeams.map(t => teamWins[t]);

    window.ChartManager.createChart('chart-team-wins', 'bar', {
      labels: sortedTeams,
      datasets: [{
        label: 'Total Wins',
        data: winData,
        backgroundColor: colors.primary,
        borderRadius: 6
      }]
    }, {
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { ticks: { maxRotation: 45, minRotation: 45 } }
      }
    });

    // 2. Runs by Season (Line Chart)
    // 3. Matches per Season (Bar Chart)
    const seasonRuns = {};
    const seasonMatches = {};
    
    // Initialize seasons
    window.IPLData.seasonsList.forEach(s => {
      seasonRuns[s] = 0;
      seasonMatches[s] = 0;
    });

    matches.forEach(m => {
      seasonMatches[m.season] = (seasonMatches[m.season] || 0) + 1;
    });

    window.IPLData.deliveries.forEach(d => {
      const match = window.IPLData.matchesMap.get(d.match_id);
      if (match) {
        seasonRuns[match.season] = (seasonRuns[match.season] || 0) + d.total_runs;
      }
    });

    const seasons = window.IPLData.seasonsList;
    const runsData = seasons.map(s => seasonRuns[s]);
    const matchesData = seasons.map(s => seasonMatches[s]);

    window.ChartManager.createChart('chart-runs-season', 'line', {
      labels: seasons,
      datasets: [{
        label: 'Total Runs Scored',
        data: runsData,
        borderColor: colors.accent,
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.3
      }]
    }, {
      plugins: { legend: { display: false } }
    });

    window.ChartManager.createChart('chart-matches-season', 'bar', {
      labels: seasons,
      datasets: [{
        label: 'Matches Played',
        data: matchesData,
        backgroundColor: colors.success,
        borderRadius: 4
      }]
    }, {
      plugins: { legend: { display: false } }
    });

    // 4. Toss Decision (Pie Chart)
    let tossBat = 0;
    let tossField = 0;
    matches.forEach(m => {
      if (m.toss_decision === 'bat') tossBat += 1;
      else if (m.toss_decision === 'field') tossField += 1;
    });

    window.ChartManager.createChart('chart-toss-decision', 'pie', {
      labels: ['Field First', 'Bat First'],
      datasets: [{
        data: [tossField, tossBat],
        backgroundColor: [colors.primary, colors.accent],
        borderWidth: 0
      }]
    }, {
      plugins: {
        legend: { position: 'bottom' }
      }
    });

    // 5. Venue Analysis (Horizontal Bar Chart - Top 10 Venues)
    const venueCount = {};
    matches.forEach(m => {
      if (m.venue) {
        venueCount[m.venue] = (venueCount[m.venue] || 0) + 1;
      }
    });

    const topVenues = Object.keys(venueCount)
      .sort((a, b) => venueCount[b] - venueCount[a])
      .slice(0, 10);
    const venueData = topVenues.map(v => venueCount[v]);

    window.ChartManager.createChart('chart-venue-analysis', 'bar', {
      labels: topVenues.map(v => v.split(',')[0]), // Abbreviate venue name for readability
      datasets: [{
        label: 'Matches Played',
        data: venueData,
        backgroundColor: colors.palette[4],
        borderRadius: 4
      }]
    }, {
      indexAxis: 'y',
      plugins: { legend: { display: false } }
    });

    // 6. Top Teams by Win % (Doughnut Chart - Top 5 Teams with min 30 matches)
    const teamStats = {};
    window.IPLData.teamsList.forEach(t => {
      teamStats[t] = { played: 0, wins: 0 };
    });

    matches.forEach(m => {
      if (m.team1 && teamStats[m.team1]) teamStats[m.team1].played += 1;
      if (m.team2 && teamStats[m.team2]) teamStats[m.team2].played += 1;
      if (m.winner && teamStats[m.winner]) teamStats[m.winner].wins += 1;
    });

    const eligibleTeams = window.IPLData.teamsList.filter(t => teamStats[t].played >= 30);
    const topTeamsWinPct = eligibleTeams.map(t => {
      const stats = teamStats[t];
      return {
        name: t,
        winPct: (stats.wins / stats.played) * 100
      };
    }).sort((a, b) => b.winPct - a.winPct).slice(0, 5);

    window.ChartManager.createChart('chart-top-teams', 'doughnut', {
      labels: topTeamsWinPct.map(t => t.name),
      datasets: [{
        data: topTeamsWinPct.map(t => t.winPct),
        backgroundColor: colors.palette.slice(0, 5),
        borderWidth: 0
      }]
    }, {
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ` ${context.label}: ${context.raw.toFixed(1)}% Win Rate`;
            }
          }
        }
      }
    });
  }
};
