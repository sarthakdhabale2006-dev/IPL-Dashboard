// Player Analysis Page Controller
window.PlayerPage = {
  isInitialized: false,
  selectedPlayer: null,

  init: function() {
    this.setupAutocomplete();
    
    // Default to a popular player on load
    const popular = ["V Kohli", "MS Dhoni", "RG Sharma", "DA Warner", "AB de Villiers"];
    let defaultPlayer = window.IPLData.playersList[0];
    
    for (let p of popular) {
      if (window.IPLData.playerStatsIndex[p]) {
        defaultPlayer = p;
        break;
      }
    }
    
    if (defaultPlayer) {
      this.displayPlayer(defaultPlayer);
    }
    
    this.isInitialized = true;
  },

  setupAutocomplete: function() {
    const input = document.getElementById('player-search-input');
    const suggestionsContainer = document.getElementById('player-suggestions');

    if (!input || !suggestionsContainer) return;

    input.addEventListener('input', (e) => {
      const value = e.target.value.toLowerCase().trim();
      suggestionsContainer.innerHTML = '';

      if (value.length < 2) {
        suggestionsContainer.classList.add('hidden');
        return;
      }

      // Filter players
      const matches = window.IPLData.playersList.filter(p => 
        p.toLowerCase().includes(value)
      ).slice(0, 8); // Limit to top 8 suggestions

      if (matches.length === 0) {
        suggestionsContainer.classList.add('hidden');
        return;
      }

      suggestionsContainer.classList.remove('hidden');
      matches.forEach(player => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.textContent = player;
        item.addEventListener('click', () => {
          input.value = player;
          suggestionsContainer.classList.add('hidden');
          this.displayPlayer(player);
        });
        suggestionsContainer.appendChild(item);
      });
    });

    // Close suggestions dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (e.target !== input && e.target !== suggestionsContainer) {
        suggestionsContainer.classList.add('hidden');
      }
    });
  },

  displayPlayer: function(playerName) {
    const p = window.IPLData.playerStatsIndex[playerName];
    if (!p) return;

    this.selectedPlayer = playerName;

    // Display Avatar and Meta
    document.getElementById('pl-avatar-initials').textContent = playerName.split(" ").map(n => n[0]).join("");
    document.getElementById('pl-name').textContent = playerName;
    
    // Determine player role based on historical activity
    let role = "All-Rounder";
    if (p.runs > 500 && p.wickets < 5) role = "Batsman";
    else if (p.wickets > 15 && p.runs < 100) role = "Bowler";
    else if (p.runs === 0 && p.wickets === 0) role = "Player";
    document.getElementById('pl-role').textContent = role;

    // Set Roster Meta info
    document.getElementById('pl-meta-matches').textContent = p.matchesCount;
    
    // Try to find the team they played most recently for
    let lastTeam = "N/A";
    const lastMatchId = Array.from(p.battingMatches).pop() || Array.from(p.bowlingMatches).pop();
    if (lastMatchId) {
      const match = window.IPLData.matchesMap.get(lastMatchId);
      if (match) {
        // Find batting or bowling team in that match
        const delivery = window.IPLData.deliveriesByMatchId.get(lastMatchId).find(d => d.batter === playerName || d.bowler === playerName);
        if (delivery) {
          lastTeam = delivery.batter === playerName ? delivery.batting_team : delivery.bowling_team;
        }
      }
    }
    document.getElementById('pl-meta-team').textContent = lastTeam;

    // Batting stats
    document.getElementById('pl-runs').textContent = formatNum(p.runs);
    document.getElementById('pl-highest').textContent = p.highestScore;
    document.getElementById('pl-average').textContent = formatRate(p.battingAvg, 2);
    document.getElementById('pl-sr').textContent = formatRate(p.battingSR, 1) + "%";
    document.getElementById('pl-fifties').textContent = p.fifties;
    document.getElementById('pl-hundreds').textContent = p.hundreds;
    document.getElementById('pl-fours').textContent = formatNum(p.fours);
    document.getElementById('pl-sixes').textContent = formatNum(p.sixes);

    // Bowling stats
    document.getElementById('pl-wickets').textContent = p.wickets;
    document.getElementById('pl-economy').textContent = p.economy > 0 ? formatRate(p.economy, 2) : "0.00";
    document.getElementById('pl-bowl-avg').textContent = p.bowlingAvg !== null ? formatRate(p.bowlingAvg, 2) : "N/A";
    document.getElementById('pl-best-bowl').textContent = p.bestBowling;

    // Render trend charts
    this.renderTrendCharts(p);
  },

  renderTrendCharts: function(player) {
    const colors = window.ChartManager.getThemeColors();
    const seasons = window.IPLData.seasonsList;

    // Filter seasons where player actually did something
    const activeSeasons = seasons.filter(s => 
      (player.runsBySeason[s] > 0) || (player.wicketsBySeason[s] > 0)
    );

    const runsData = activeSeasons.map(s => player.runsBySeason[s] || 0);
    const wicketsData = activeSeasons.map(s => player.wicketsBySeason[s] || 0);

    // Strike rate per season: (runs in season / balls in season) * 100
    const srData = activeSeasons.map(s => {
      const runs = player.runsBySeason[s] || 0;
      const balls = player.ballsBySeason[s] || 0;
      return balls > 0 ? (runs / balls) * 100 : 0;
    });

    // 1. Runs by season
    window.ChartManager.createChart('chart-player-runs', 'line', {
      labels: activeSeasons,
      datasets: [{
        label: 'Runs Scored',
        data: runsData,
        borderColor: colors.primary,
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.3
      }]
    }, {
      plugins: { legend: { display: false } }
    });

    // 2. Strike rate trend
    window.ChartManager.createChart('chart-player-sr', 'line', {
      labels: activeSeasons,
      datasets: [{
        label: 'Strike Rate',
        data: srData,
        borderColor: colors.accent,
        backgroundColor: 'transparent',
        borderWidth: 3,
        pointStyle: 'circle',
        pointRadius: 5,
        pointHoverRadius: 7,
        tension: 0.1
      }]
    }, {
      plugins: { legend: { display: false } }
    });

    // 3. Wickets by season
    window.ChartManager.createChart('chart-player-wickets', 'bar', {
      labels: activeSeasons,
      datasets: [{
        label: 'Wickets Taken',
        data: wicketsData,
        backgroundColor: colors.success,
        borderRadius: 4
      }]
    }, {
      plugins: { legend: { display: false } }
    });
  }
};
