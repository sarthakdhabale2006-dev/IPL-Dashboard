// Team Analysis Page Controller
window.TeamPage = {
  isInitialized: false,

  init: function() {
    this.populateTeams();
    this.applyTeamSelection();
    this.isInitialized = true;
  },

  populateTeams: function() {
    const teamSelect = document.getElementById('team-select');
    teamSelect.innerHTML = '';
    window.IPLData.teamsList.forEach(t => {
      teamSelect.innerHTML += `<option value="${t}">${t}</option>`;
    });

    const triggerTeamChange = () => this.applyTeamSelection();
    teamSelect.removeEventListener('change', triggerTeamChange);
    teamSelect.addEventListener('change', triggerTeamChange);
  },

  applyTeamSelection: function() {
    const selectedTeam = document.getElementById('team-select').value;
    if (!selectedTeam) return;

    this.calculateTeamStats(selectedTeam);
  },

  calculateTeamStats: function(team) {
    const matches = window.IPLData.matches;
    const deliveries = window.IPLData.deliveries;

    // Filter matches played by the team
    const teamMatches = matches.filter(m => m.team1 === team || m.team2 === team);
    const played = teamMatches.length;

    let wins = 0;
    teamMatches.forEach(m => {
      if (m.winner === team) wins++;
    });

    const losses = played - wins;
    const winPct = played > 0 ? (wins / played) * 100 : 0;

    // Calculate Highest, Lowest, and Average Scores
    let totalInningsRuns = 0;
    let inningsCount = 0;
    let highestScore = 0;
    let lowestScore = 999;

    // Group deliveries by match and inning for this team
    const teamInnings = {};
    deliveries.forEach(d => {
      if (d.batting_team === team) {
        const key = `${d.match_id}_${d.inning}`;
        if (!teamInnings[key]) {
          teamInnings[key] = { runs: 0, legalBalls: 0 };
        }
        teamInnings[key].runs += d.total_runs;
        if (d.extras_type !== 'wides' && d.extras_type !== 'noballs') {
          teamInnings[key].legalBalls += 1;
        }
      }
    });

    Object.values(teamInnings).forEach(inn => {
      totalInningsRuns += inn.runs;
      inningsCount++;
      if (inn.runs > highestScore) highestScore = inn.runs;
      // Filter for min 10 overs (60 legal balls) to avoid rain shortening
      if (inn.legalBalls >= 60 && inn.runs < lowestScore && inn.runs > 0) {
        lowestScore = inn.runs;
      }
    });

    const avgScore = inningsCount > 0 ? totalInningsRuns / inningsCount : 0;

    // Player aggregations within this team
    const batsmanRuns = {};
    const bowlerWickets = {};
    const batsmanSixes = {};
    const batsmanFours = {};
    const partnerships = {}; // "match_inn_pair" -> runs

    deliveries.forEach(d => {
      const match = window.IPLData.matchesMap.get(d.match_id);
      if (!match) return;

      // Batting for team
      if (d.batting_team === team) {
        // Runs
        batsmanRuns[d.batter] = (batsmanRuns[d.batter] || 0) + d.batsman_runs;
        
        // Sixes & Fours
        if (d.batsman_runs === 6) batsmanSixes[d.batter] = (batsmanSixes[d.batter] || 0) + 1;
        if (d.batsman_runs === 4) batsmanFours[d.batter] = (batsmanFours[d.batter] || 0) + 1;

        // Partnerships: sort pair names alphabetically to make unique key
        if (d.batter && d.non_striker) {
          const pair = [d.batter, d.non_striker].sort().join(" & ");
          const partKey = `${d.match_id}_${d.inning}_${pair}`;
          if (!partnerships[partKey]) {
            partnerships[partKey] = { runs: 0, players: pair, matchId: d.match_id };
          }
          partnerships[partKey].runs += d.total_runs;
        }
      }

      // Bowling for team
      if (d.bowling_team === team) {
        if (d.is_wicket && d.dismissal_kind) {
          const dk = d.dismissal_kind.trim().toLowerCase();
          const bowlerWicket = !['run out', 'retired hurt', 'obstructing the field', 'retired out', 'na'].includes(dk);
          if (bowlerWicket) {
            bowlerWickets[d.bowler] = (bowlerWickets[d.bowler] || 0) + 1;
          }
        }
      }
    });

    // Best Bat / Bowl
    const topBatsmen = Object.keys(batsmanRuns).sort((a, b) => batsmanRuns[b] - batsmanRuns[a]);
    const bestBatsman = topBatsmen.length > 0 ? `${topBatsmen[0]} (${batsmanRuns[topBatsmen[0]]} Runs)` : "N/A";

    const topBowlers = Object.keys(bowlerWickets).sort((a, b) => bowlerWickets[b] - bowlerWickets[a]);
    const bestBowler = topBowlers.length > 0 ? `${topBowlers[0]} (${bowlerWickets[topBowlers[0]]} Wkts)` : "N/A";

    const topSixes = Object.keys(batsmanSixes).sort((a, b) => batsmanSixes[b] - batsmanSixes[a]);
    const mostSixes = topSixes.length > 0 ? `${topSixes[0]} (${batsmanSixes[topSixes[0]]} Sixes)` : "N/A";

    const topFours = Object.keys(batsmanFours).sort((a, b) => batsmanFours[b] - batsmanFours[a]);
    const mostFours = topFours.length > 0 ? `${topFours[0]} (${batsmanFours[topFours[0]]} Fours)` : "N/A";

    // Top Partnerships (Top 3)
    const sortedParts = Object.values(partnerships).sort((a, b) => b.runs - a.runs).slice(0, 3);
    let partListHTML = "";
    if (sortedParts.length === 0) {
      partListHTML = "<li>No partnerships recorded</li>";
    } else {
      sortedParts.forEach(p => {
        const m = window.IPLData.matchesMap.get(p.matchId);
        const opponent = m.team1 === team ? m.team2 : m.team1;
        partListHTML += `
          <li class="flex-between mb-10 pb-10" style="border-bottom: 1px dashed var(--border-color);">
            <div>
              <strong style="font-size:0.85rem; color:var(--text-main);">${p.players}</strong>
              <span style="font-size:0.75rem; display:block; color:var(--text-light);">vs ${opponent} (${m.season})</span>
            </div>
            <span class="badge badge-primary" style="font-size:0.8rem; padding: 4px 10px;">${p.runs} Runs</span>
          </li>
        `;
      });
    }
    document.getElementById('tm-partnership-list').innerHTML = partListHTML;

    // Display Stats
    document.getElementById('tm-logo-placeholder').textContent = team.split(" ").map(w => w[0]).join("").slice(0, 3);
    document.getElementById('tm-played').textContent = formatNum(played);
    document.getElementById('tm-wins').textContent = formatNum(wins);
    document.getElementById('tm-losses').textContent = formatNum(losses);
    document.getElementById('tm-win-pct').textContent = formatRate(winPct, 1) + "%";
    document.getElementById('tm-highest').textContent = highestScore > 0 ? formatNum(highestScore) : "N/A";
    document.getElementById('tm-lowest').textContent = lowestScore < 999 ? formatNum(lowestScore) : "N/A";
    document.getElementById('tm-average').textContent = formatRate(avgScore, 1);
    document.getElementById('tm-best-batsman').textContent = bestBatsman;
    document.getElementById('tm-best-bowler').textContent = bestBowler;
    document.getElementById('tm-most-sixes').textContent = mostSixes;
    document.getElementById('tm-most-fours').textContent = mostFours;

    // Head to head calculation against every other team
    const opponentStats = {};
    window.IPLData.teamsList.forEach(opp => {
      if (opp !== team) {
        opponentStats[opp] = { played: 0, wins: 0 };
      }
    });

    teamMatches.forEach(m => {
      const opp = m.team1 === team ? m.team2 : m.team1;
      if (opponentStats[opp]) {
        opponentStats[opp].played++;
        if (m.winner === team) opponentStats[opp].wins++;
      }
    });

    const oppBody = document.getElementById('tm-h2h-table-body');
    oppBody.innerHTML = '';
    
    Object.keys(opponentStats).forEach(opp => {
      const stats = opponentStats[opp];
      const oppWins = stats.played - stats.wins;
      const pct = stats.played > 0 ? (stats.wins / stats.played) * 100 : 0;
      
      const rateClass = pct >= 50 ? 'h2h-cell-won' : 'h2h-cell-lost';
      
      oppBody.innerHTML += `
        <tr>
          <td><strong>${opp}</strong></td>
          <td>${stats.played}</td>
          <td>${stats.wins}</td>
          <td>${oppWins}</td>
          <td class="${rateClass}">${stats.played > 0 ? pct.toFixed(1) + '%' : '0.0%'}</td>
        </tr>
      `;
    });

    // Render Charts
    this.renderTeamCharts(team, teamMatches, teamInnings);
  },

  renderTeamCharts: function(team, matches, innings) {
    const colors = window.ChartManager.getThemeColors();
    const seasons = window.IPLData.seasonsList;

    // 1. Runs Scored by Season (Line Chart)
    const runsBySeason = {};
    seasons.forEach(s => runsBySeason[s] = 0);
    
    window.IPLData.deliveries.forEach(d => {
      if (d.batting_team === team) {
        const m = window.IPLData.matchesMap.get(d.match_id);
        if (m) {
          runsBySeason[m.season] += d.total_runs;
        }
      }
    });

    window.ChartManager.createChart('chart-team-runs', 'line', {
      labels: seasons,
      datasets: [{
        label: 'Runs Scored',
        data: seasons.map(s => runsBySeason[s]),
        borderColor: colors.primary,
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.3
      }]
    }, {
      plugins: { legend: { display: false } }
    });

    // 2. Wins by Season (Bar Chart)
    const winsBySeason = {};
    seasons.forEach(s => winsBySeason[s] = 0);
    matches.forEach(m => {
      if (m.winner === team) {
        winsBySeason[m.season]++;
      }
    });

    window.ChartManager.createChart('chart-team-wins-season', 'bar', {
      labels: seasons,
      datasets: [{
        label: 'Wins',
        data: seasons.map(s => winsBySeason[s]),
        backgroundColor: colors.success,
        borderRadius: 4
      }]
    }, {
      plugins: { legend: { display: false } }
    });

    // 3. Venue Performance (Bar Chart - Top 5 Venues by wins)
    const venueWins = {};
    matches.forEach(m => {
      if (m.venue && m.winner === team) {
        venueWins[m.venue] = (venueWins[m.venue] || 0) + 1;
      }
    });

    const topVenues = Object.keys(venueWins)
      .sort((a, b) => venueWins[b] - venueWins[a])
      .slice(0, 5);

    window.ChartManager.createChart('chart-team-venues', 'bar', {
      labels: topVenues.map(v => v.split(',')[0]),
      datasets: [{
        label: 'Wins at Venue',
        data: topVenues.map(v => venueWins[v]),
        backgroundColor: colors.accent,
        borderRadius: 4
      }]
    }, {
      indexAxis: 'y',
      plugins: { legend: { display: false } }
    });
  }
};
