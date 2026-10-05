// Season Analysis Page Controller
window.SeasonPage = {
  isInitialized: false,

  init: function() {
    this.populateSeasons();
    this.applySeasonSelection();
    this.isInitialized = true;
  },

  populateSeasons: function() {
    const seasonSelect = document.getElementById('season-select');
    seasonSelect.innerHTML = '';
    // Reverse seasons so latest is first
    const reversedSeasons = [...window.IPLData.seasonsList].reverse();
    reversedSeasons.forEach(s => {
      seasonSelect.innerHTML += `<option value="${s}">${s}</option>`;
    });

    const triggerSeasonChange = () => this.applySeasonSelection();
    seasonSelect.removeEventListener('change', triggerSeasonChange);
    seasonSelect.addEventListener('change', triggerSeasonChange);
  },

  applySeasonSelection: function() {
    const selectedSeason = document.getElementById('season-select').value;
    if (!selectedSeason) return;

    this.calculateSeasonStats(selectedSeason);
  },

  calculateSeasonStats: function(season) {
    const matches = window.IPLData.matches.filter(m => m.season === season);
    const deliveries = window.IPLData.deliveries;

    const totalMatches = matches.length;
    
    // Champions and Runners-up from window.IPLData.seasonWinners
    const winners = window.IPLData.seasonWinners[season] || { champion: "Unknown", runnerUp: "Unknown" };

    // Group matches of the season to filter deliveries easily
    const matchIds = new Set(matches.map(m => m.id));

    // Stats variables
    let totalRuns = 0;
    let totalWickets = 0;
    let totalSixes = 0;
    
    const playerRuns = {};
    const playerWickets = {};
    const playerSixes = {};
    const inningsScores = {}; // "matchId_inn" -> runs
    const teamWins = {};

    deliveries.forEach(d => {
      if (matchIds.has(d.match_id)) {
        totalRuns += d.total_runs;
        
        // Batter runs
        playerRuns[d.batter] = (playerRuns[d.batter] || 0) + d.batsman_runs;
        if (d.batsman_runs === 6) {
          totalSixes++;
          playerSixes[d.batter] = (playerSixes[d.batter] || 0) + 1;
        }

        // Bowler wickets
        if (d.is_wicket && d.dismissal_kind) {
          const dk = d.dismissal_kind.trim().toLowerCase();
          const bowlerWicket = !['run out', 'retired hurt', 'obstructing the field', 'retired out', 'na'].includes(dk);
          if (bowlerWicket) {
            playerWickets[d.bowler] = (playerWickets[d.bowler] || 0) + 1;
          }
          // General wicket total
          if (dk !== 'na' && dk !== 'retired hurt' && dk !== 'retired out') {
            totalWickets++;
          }
        }

        // Innings score
        const key = `${d.match_id}_${d.inning}`;
        inningsScores[key] = (inningsScores[key] || 0) + d.total_runs;
      }
    });

    // Find Orange and Purple Cap
    const sortedRuns = Object.keys(playerRuns).sort((a, b) => playerRuns[b] - playerRuns[a]);
    const orangeCap = sortedRuns.length > 0 ? sortedRuns[0] : "N/A";
    const orangeRuns = sortedRuns.length > 0 ? playerRuns[orangeCap] : 0;

    const sortedWickets = Object.keys(playerWickets).sort((a, b) => playerWickets[b] - playerWickets[a]);
    const purpleCap = sortedWickets.length > 0 ? sortedWickets[0] : "N/A";
    const purpleWickets = sortedWickets.length > 0 ? playerWickets[purpleCap] : 0;

    const sortedSixes = Object.keys(playerSixes).sort((a, b) => playerSixes[b] - playerSixes[a]);
    const mostSixesPlayer = sortedSixes.length > 0 ? sortedSixes[0] : "N/A";
    const mostSixesCount = sortedSixes.length > 0 ? playerSixes[mostSixesPlayer] : 0;

    // Highest Team Score
    let highestScore = 0;
    let highestScoreTeam = "N/A";
    deliveries.forEach(d => {
      if (matchIds.has(d.match_id)) {
        const key = `${d.match_id}_${d.inning}`;
        const runs = inningsScores[key] || 0;
        if (runs > highestScore) {
          highestScore = runs;
          highestScoreTeam = d.batting_team;
        }
      }
    });

    // Wins by team
    matches.forEach(m => {
      if (m.winner) {
        teamWins[m.winner] = (teamWins[m.winner] || 0) + 1;
      }
    });

    // Render Stats values
    document.getElementById('se-champion').textContent = winners.champion;
    document.getElementById('se-runner-up').textContent = winners.runnerUp;
    document.getElementById('se-orange-cap').textContent = `${orangeCap} (${orangeRuns} Runs)`;
    document.getElementById('se-purple-cap').textContent = `${purpleCap} (${purpleWickets} Wickets)`;
    document.getElementById('se-most-sixes').textContent = `${mostSixesPlayer} (${mostSixesCount} Sixes)`;
    document.getElementById('se-highest-score').textContent = `${highestScore} (${highestScoreTeam})`;
    document.getElementById('se-matches').textContent = formatNum(totalMatches);
    document.getElementById('se-runs').textContent = formatNum(totalRuns);
    document.getElementById('se-wickets').textContent = formatNum(totalWickets);

    // Render Season Charts
    this.renderSeasonCharts(matches, teamWins);
  },

  renderSeasonCharts: function(matches, teamWins) {
    const colors = window.ChartManager.getThemeColors();

    // 1. Runs Progression (Cumulative Runs)
    // Sort matches chronologically
    matches.sort((a, b) => a.id - b.id);
    let runCumulative = 0;
    const labels = [];
    const runProgression = [];

    matches.forEach((m, index) => {
      const deliveries = window.IPLData.deliveriesByMatchId.get(m.id) || [];
      let matchRuns = 0;
      deliveries.forEach(d => matchRuns += d.total_runs);
      
      runCumulative += matchRuns;
      labels.push(`M${index + 1}`);
      runProgression.push(runCumulative);
    });

    window.ChartManager.createChart('chart-season-progression', 'line', {
      labels: labels,
      datasets: [{
        label: 'Cumulative Runs Scored',
        data: runProgression,
        borderColor: colors.primary,
        backgroundColor: 'rgba(37, 99, 235, 0.08)',
        borderWidth: 2,
        fill: true,
        pointRadius: 0
      }]
    }, {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { maxTicksLimit: 15 } }
      }
    });

    // 2. Winning Teams (Bar Chart)
    const sortedTeams = Object.keys(teamWins).sort((a, b) => teamWins[b] - teamWins[a]);
    window.ChartManager.createChart('chart-season-wins', 'bar', {
      labels: sortedTeams,
      datasets: [{
        label: 'Wins',
        data: sortedTeams.map(t => teamWins[t]),
        backgroundColor: colors.success,
        borderRadius: 4
      }]
    }, {
      plugins: { legend: { display: false } }
    });

    // 3. Venue Distribution (Pie Chart - top 5 venues, others grouped)
    const venueCount = {};
    matches.forEach(m => {
      if (m.venue) {
        venueCount[m.venue] = (venueCount[m.venue] || 0) + 1;
      }
    });

    const sortedVenues = Object.keys(venueCount).sort((a, b) => venueCount[b] - venueCount[a]);
    const topVenues = sortedVenues.slice(0, 5);
    const venueLabels = topVenues.map(v => v.split(',')[0]);
    const venueData = topVenues.map(v => venueCount[v]);

    if (sortedVenues.length > 5) {
      let otherSum = 0;
      sortedVenues.slice(5).forEach(v => otherSum += venueCount[v]);
      venueLabels.push('Others');
      venueData.push(otherSum);
    }

    window.ChartManager.createChart('chart-season-venues', 'doughnut', {
      labels: venueLabels,
      datasets: [{
        data: venueData,
        backgroundColor: colors.palette.slice(2, 2 + venueData.length),
        borderWidth: 0
      }]
    }, {
      plugins: {
        legend: { position: 'bottom' }
      }
    });
  }
};
