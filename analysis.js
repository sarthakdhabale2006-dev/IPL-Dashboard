// Match Analysis Page Controller
window.AnalysisPage = {
  isInitialized: false,

  init: function() {
    this.populateFilters();
    this.applyFilters();
    this.isInitialized = true;
  },

  populateFilters: function() {
    const seasonSelect = document.getElementById('analysis-season');
    const venueSelect = document.getElementById('analysis-venue');
    const teamSelect = document.getElementById('analysis-team');

    // Reset selects
    seasonSelect.innerHTML = '<option value="all">All Seasons</option>';
    venueSelect.innerHTML = '<option value="all">All Venues</option>';
    teamSelect.innerHTML = '<option value="all">All Teams</option>';

    // Populate
    window.IPLData.seasonsList.forEach(s => {
      seasonSelect.innerHTML += `<option value="${s}">${s}</option>`;
    });

    window.IPLData.venuesList.forEach(v => {
      venueSelect.innerHTML += `<option value="${v}">${v}</option>`;
    });

    window.IPLData.teamsList.forEach(t => {
      teamSelect.innerHTML += `<option value="${t}">${t}</option>`;
    });

    // Listeners
    const triggerFilter = () => this.applyFilters();
    seasonSelect.removeEventListener('change', triggerFilter);
    seasonSelect.addEventListener('change', triggerFilter);
    
    venueSelect.removeEventListener('change', triggerFilter);
    venueSelect.addEventListener('change', triggerFilter);
    
    teamSelect.removeEventListener('change', triggerFilter);
    teamSelect.addEventListener('change', triggerFilter);
  },

  applyFilters: function() {
    const selectedSeason = document.getElementById('analysis-season').value;
    const selectedVenue = document.getElementById('analysis-venue').value;
    const selectedTeam = document.getElementById('analysis-team').value;

    let filteredMatches = window.IPLData.matches;

    // Filter by season
    if (selectedSeason !== 'all') {
      filteredMatches = filteredMatches.filter(m => m.season === selectedSeason);
    }

    // Filter by venue
    if (selectedVenue !== 'all') {
      filteredMatches = filteredMatches.filter(m => m.venue === selectedVenue);
    }

    // Filter by team
    if (selectedTeam !== 'all') {
      filteredMatches = filteredMatches.filter(m => m.team1 === selectedTeam || m.team2 === selectedTeam);
    }

    this.renderStats(filteredMatches, selectedTeam);
  },

  renderStats: function(matches, selectedTeam) {
    const totalMatches = matches.length;
    
    // Win stats
    let wins = 0;
    let winPctText = "N/A";
    if (selectedTeam !== 'all') {
      matches.forEach(m => {
        if (m.winner === selectedTeam) wins++;
      });
      winPctText = totalMatches > 0 ? `${((wins / totalMatches) * 100).toFixed(1)}%` : "0.0%";
    } else {
      winPctText = "N/A (Select Team)";
    }

    // Toss winner vs Match winner
    let tossAndMatchWins = 0;
    matches.forEach(m => {
      if (m.toss_winner && m.winner && m.toss_winner === m.winner) {
        tossAndMatchWins++;
      }
    });
    const tossWinPctText = totalMatches > 0 ? `${((tossAndMatchWins / totalMatches) * 100).toFixed(1)}%` : "0.0%";

    // Win methods
    let winsByRuns = 0;
    let winsByWickets = 0;
    let tiesOrNoResults = 0;

    matches.forEach(m => {
      if (m.result === 'runs') winsByRuns++;
      else if (m.result === 'wickets') winsByWickets++;
      else tiesOrNoResults++;
    });

    // Innings Scores & Chases
    let sumInnings1 = 0;
    let countInnings1 = 0;
    let sumInnings2 = 0;
    let countInnings2 = 0;
    let highestChase = 0;
    let highestChaseTeam = "N/A";
    let lowestDefended = 999;
    let lowestDefendedTeam = "N/A";

    matches.forEach(m => {
      const deliveries = window.IPLData.deliveriesByMatchId.get(m.id) || [];
      
      let inn1Runs = 0;
      let inn2Runs = 0;
      let inn1Balls = 0;
      let inn2Balls = 0;
      let inn1Team = "";
      let inn2Team = "";

      deliveries.forEach(d => {
        if (d.inning === 1) {
          inn1Runs += d.total_runs;
          inn1Team = d.batting_team;
          if (d.extras_type !== 'wides' && d.extras_type !== 'noballs') inn1Balls++;
        } else if (d.inning === 2) {
          inn2Runs += d.total_runs;
          inn2Team = d.batting_team;
          if (d.extras_type !== 'wides' && d.extras_type !== 'noballs') inn2Balls++;
        }
      });

      if (inn1Runs > 0) {
        sumInnings1 += inn1Runs;
        countInnings1++;
      }
      if (inn2Runs > 0) {
        sumInnings2 += inn2Runs;
        countInnings2++;
      }

      // Successful chase: batting team in inning 2 won
      if (m.winner && m.winner === inn2Team && m.result === 'wickets') {
        if (inn2Runs > highestChase) {
          highestChase = inn2Runs;
          highestChaseTeam = m.winner;
        }
      }

      // Successful defense: batting team in inning 1 won, check if played min 10 overs (60 legal balls) to avoid rain shortening
      if (m.winner && m.winner === inn1Team && m.result === 'runs' && inn1Balls >= 60) {
        if (inn1Runs < lowestDefended) {
          lowestDefended = inn1Runs;
          lowestDefendedTeam = m.winner;
        }
      }
    });

    const avgInn1 = countInnings1 > 0 ? (sumInnings1 / countInnings1) : 0;
    const avgInn2 = countInnings2 > 0 ? (sumInnings2 / countInnings2) : 0;

    // Display values
    document.getElementById('an-total-matches').textContent = formatNum(totalMatches);
    document.getElementById('an-win-pct').textContent = winPctText;
    document.getElementById('an-toss-match-pct').textContent = tossWinPctText;
    document.getElementById('an-avg-1st-inn').textContent = formatRate(avgInn1, 1);
    document.getElementById('an-avg-2nd-inn').textContent = formatRate(avgInn2, 1);
    document.getElementById('an-highest-chase').textContent = highestChase > 0 ? `${highestChase} (${highestChaseTeam})` : "N/A";
    document.getElementById('an-lowest-defended').textContent = lowestDefended < 999 ? `${lowestDefended} (${lowestDefendedTeam})` : "N/A";
    document.getElementById('an-win-runs').textContent = formatNum(winsByRuns);
    document.getElementById('an-win-wickets').textContent = formatNum(winsByWickets);

    // Render Most Successful Venues (Top 5)
    const venueStats = {};
    matches.forEach(m => {
      if (!m.venue) return;
      if (!venueStats[m.venue]) {
        venueStats[m.venue] = { matches: 0, wins: 0 };
      }
      venueStats[m.venue].matches++;
      if (selectedTeam !== 'all' && m.winner === selectedTeam) {
        venueStats[m.venue].wins++;
      } else if (selectedTeam === 'all' && m.winner) {
        // If no team is selected, count wins for the home/batting-first team or just wins generally
        venueStats[m.venue].wins++;
      }
    });

    const sortedVenues = Object.keys(venueStats).sort((a, b) => venueStats[b].matches - venueStats[a].matches).slice(0, 5);
    const venueBody = document.getElementById('an-venue-table-body');
    venueBody.innerHTML = '';
    
    if (sortedVenues.length === 0) {
      venueBody.innerHTML = '<tr><td colspan="3" class="text-center">No venue data matches filters</td></tr>';
    } else {
      sortedVenues.forEach((venue, index) => {
        const stats = venueStats[venue];
        const pct = stats.matches > 0 ? (stats.wins / stats.matches) * 100 : 0;
        const pctText = selectedTeam !== 'all' ? `${pct.toFixed(1)}%` : `N/A`;
        venueBody.innerHTML += `
          <tr>
            <td>${index + 1}</td>
            <td>${venue}</td>
            <td>${stats.matches}</td>
            ${selectedTeam !== 'all' ? `<td>${pctText} (Wins: ${stats.wins})</td>` : `<td>All Teams</td>`}
          </tr>
        `;
      });
    }

    // Render Most Successful Captains (Top 5)
    const captainStats = {};
    matches.forEach(m => {
      if (!m.winner) return;
      const winningCaptain = getMatchCaptain(m.winner, m.season);
      if (winningCaptain && winningCaptain !== 'Unknown') {
        if (!captainStats[winningCaptain]) {
          captainStats[winningCaptain] = { wins: 0, team: m.winner };
        }
        captainStats[winningCaptain].wins++;
      }
    });

    const sortedCaptains = Object.keys(captainStats).sort((a, b) => captainStats[b].wins - captainStats[a].wins).slice(0, 5);
    const captainBody = document.getElementById('an-captain-table-body');
    captainBody.innerHTML = '';

    if (sortedCaptains.length === 0) {
      captainBody.innerHTML = '<tr><td colspan="4" class="text-center">No captain data matches filters</td></tr>';
    } else {
      sortedCaptains.forEach((cap, index) => {
        const stats = captainStats[cap];
        captainBody.innerHTML += `
          <tr>
            <td>${index + 1}</td>
            <td><strong>${cap}</strong></td>
            <td>${stats.team}</td>
            <td><span class="badge badge-success">${stats.wins} Wins</span></td>
          </tr>
        `;
      });
    }

    // Render Mini-charts on Analysis Page
    this.renderPageCharts(winsByRuns, winsByWickets, tossAndMatchWins, totalMatches - tossAndMatchWins);
  },

  renderPageCharts: function(winRuns, winWickets, tossMatchWins, tossMatchLosses) {
    const colors = window.ChartManager.getThemeColors();

    // 1. Win Type Distribution (Pie Chart)
    window.ChartManager.createChart('chart-analysis-wintype', 'pie', {
      labels: ['Win by Runs (Defending)', 'Win by Wickets (Chasing)'],
      datasets: [{
        data: [winRuns, winWickets],
        backgroundColor: [colors.danger, colors.success],
        borderWidth: 0
      }]
    }, {
      plugins: {
        legend: { position: 'bottom' }
      }
    });

    // 2. Toss Win vs Match Win Impact (Doughnut Chart)
    window.ChartManager.createChart('chart-analysis-tossimpact', 'doughnut', {
      labels: ['Toss Winner Wins Match', 'Toss Winner Loses Match'],
      datasets: [{
        data: [tossMatchWins, tossMatchLosses],
        backgroundColor: [colors.primary, colors.mutedText],
        borderWidth: 0
      }]
    }, {
      plugins: {
        legend: { position: 'bottom' }
      }
    });
  }
};

// Advanced Analytics Page Controller
window.AdvancedPage = {
  isInitialized: false,

  init: function() {
    this.populateFilters();
    this.applyFilters();
    this.isInitialized = true;
  },

  populateFilters: function() {
    const seasonSelect = document.getElementById('adv-season');
    const teamSelect = document.getElementById('adv-team');

    seasonSelect.innerHTML = '<option value="all">All Seasons</option>';
    teamSelect.innerHTML = '<option value="all">All Teams</option>';

    window.IPLData.seasonsList.forEach(s => {
      seasonSelect.innerHTML += `<option value="${s}">${s}</option>`;
    });

    window.IPLData.teamsList.forEach(t => {
      teamSelect.innerHTML += `<option value="${t}">${t}</option>`;
    });

    const triggerFilter = () => this.applyFilters();
    seasonSelect.removeEventListener('change', triggerFilter);
    seasonSelect.addEventListener('change', triggerFilter);
    teamSelect.removeEventListener('change', triggerFilter);
    teamSelect.addEventListener('change', triggerFilter);
  },

  applyFilters: function() {
    const season = document.getElementById('adv-season').value;
    const team = document.getElementById('adv-team').value;

    let filteredMatches = window.IPLData.matches;
    if (season !== 'all') {
      filteredMatches = filteredMatches.filter(m => m.season === season);
    }
    if (team !== 'all') {
      filteredMatches = filteredMatches.filter(m => m.team1 === team || m.team2 === team);
    }

    const matchIds = new Set(filteredMatches.map(m => m.id));
    this.calculateAdvancedStats(matchIds, team);
  },

  calculateAdvancedStats: function(matchIds, selectedTeam) {
    const deliveries = window.IPLData.deliveries;

    // Phase counters: Powerplay (0-5 overs), Middle (6-14 overs), Death (15-19 overs)
    let ppRuns = 0, ppBalls = 0, ppWickets = 0;
    let midRuns = 0, midBalls = 0, midWickets = 0;
    let deathRuns = 0, deathBalls = 0, deathWickets = 0;

    let totalBalls = 0;
    let dotBalls = 0;
    let boundariesCount = 0;

    // Extras
    let wides = 0, noballs = 0, legbyes = 0, byes = 0, penalty = 0;

    // Dismissals
    const dismissalCounts = {};

    deliveries.forEach(d => {
      if (!matchIds.has(d.match_id)) return;

      // If a team is selected, only analyze deliveries where they were batting (or bowling, but let's focus on batting/bowling depending on context. The prompt mentions boundaries and dots, let's analyze the selected team's batting deliveries. If "all teams", analyze all deliveries.)
      if (selectedTeam !== 'all' && d.batting_team !== selectedTeam) return;

      const over = d.over; // 0-indexed (0 to 19)
      const runs = d.total_runs;
      const isExtraBall = (d.extras_type === 'wides' || d.extras_type === 'noballs');

      // Global indicators
      if (d.extras_type !== 'wides') {
        totalBalls++;
        if (d.batsman_runs === 0 && d.extra_runs === 0) dotBalls++;
      }
      if (d.batsman_runs === 4 || d.batsman_runs === 6) boundariesCount++;

      // Extras Breakdown
      if (d.extras_type === 'wides') wides += d.extra_runs;
      else if (d.extras_type === 'noballs') noballs += d.extra_runs;
      else if (d.extras_type === 'legbyes') legbyes += d.extra_runs;
      else if (d.extras_type === 'byes') byes += d.extra_runs;
      else if (d.extras_type === 'penalty') penalty += d.extra_runs;

      // Phase-wise sorting
      if (over >= 0 && over <= 5) {
        ppRuns += runs;
        if (!isExtraBall) ppBalls++;
        if (d.is_wicket && d.player_dismissed) ppWickets++;
      } else if (over >= 6 && over <= 14) {
        midRuns += runs;
        if (!isExtraBall) midBalls++;
        if (d.is_wicket && d.player_dismissed) midWickets++;
      } else if (over >= 15 && over <= 19) {
        deathRuns += runs;
        if (!isExtraBall) deathBalls++;
        if (d.is_wicket && d.player_dismissed) deathWickets++;
      }

      // Dismissals
      if (d.is_wicket && d.dismissal_kind && d.dismissal_kind !== 'NA') {
        const dk = d.dismissal_kind.trim();
        dismissalCounts[dk] = (dismissalCounts[dk] || 0) + 1;
      }
    });

    // Run Rates (runs per over = runs / (balls/6))
    const ppOvers = ppBalls / 6;
    const midOvers = midBalls / 6;
    const deathOvers = deathBalls / 6;

    const ppRR = ppOvers > 0 ? ppRuns / ppOvers : 0;
    const midRR = midOvers > 0 ? midRuns / midOvers : 0;
    const deathRR = deathOvers > 0 ? deathRuns / deathOvers : 0;

    const boundaryPct = totalBalls > 0 ? (boundariesCount / totalBalls) * 100 : 0;
    const dotPct = totalBalls > 0 ? (dotBalls / totalBalls) * 100 : 0;
    const totalExtras = wides + noballs + legbyes + byes + penalty;

    // Display
    document.getElementById('adv-pp-rr').textContent = formatRate(ppRR, 2);
    document.getElementById('adv-pp-wickets').textContent = ppWickets;
    document.getElementById('adv-mid-rr').textContent = formatRate(midRR, 2);
    document.getElementById('adv-mid-wickets').textContent = midWickets;
    document.getElementById('adv-death-rr').textContent = formatRate(deathRR, 2);
    document.getElementById('adv-death-wickets').textContent = deathWickets;

    document.getElementById('adv-boundary-pct').textContent = formatRate(boundaryPct, 1) + "%";
    document.getElementById('adv-dot-pct').textContent = formatRate(dotPct, 1) + "%";
    document.getElementById('adv-total-extras').textContent = formatNum(totalExtras);

    // Render Charts
    this.renderAdvancedCharts(
      { ppRR, midRR, deathRR },
      { wides, noballs, legbyes, byes },
      dismissalCounts
    );
  },

  renderAdvancedCharts: function(rates, extras, dismissals) {
    const colors = window.ChartManager.getThemeColors();

    // 1. Overs Run Rate (Bar Chart)
    window.ChartManager.createChart('chart-adv-phases', 'bar', {
      labels: ['Powerplay (0-6 Ov)', 'Middle Overs (6-15 Ov)', 'Death Overs (15-20 Ov)'],
      datasets: [{
        label: 'Run Rate (Runs/Over)',
        data: [rates.ppRR, rates.midRR, rates.deathRR],
        backgroundColor: [colors.accent, colors.primary, colors.danger],
        borderRadius: 6
      }]
    }, {
      plugins: { legend: { display: false } },
      scales: {
        y: { title: { display: true, text: 'Runs per Over', color: colors.text } }
      }
    });

    // 2. Extras Breakdown (Bar Chart)
    window.ChartManager.createChart('chart-adv-extras', 'bar', {
      labels: ['Wides', 'No Balls', 'Leg Byes', 'Byes'],
      datasets: [{
        label: 'Runs Conceded',
        data: [extras.wides, extras.noballs, extras.legbyes, extras.byes],
        backgroundColor: colors.palette.slice(4, 8),
        borderRadius: 4
      }]
    }, {
      plugins: { legend: { display: false } }
    });

    // 3. Dismissal Types (Pie Chart)
    const disLabels = Object.keys(dismissals);
    const disData = Object.values(dismissals);

    window.ChartManager.createChart('chart-adv-dismissals', 'doughnut', {
      labels: disLabels,
      datasets: [{
        data: disData,
        backgroundColor: colors.palette.slice(0, disLabels.length),
        borderWidth: 0
      }]
    }, {
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12 } }
      }
    });
  }
};

