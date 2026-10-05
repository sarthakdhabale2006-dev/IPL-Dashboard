// Global object to store normalized data and precomputed indexes
window.IPLData = {
  matches: [],
  deliveries: [],
  matchesMap: new Map(),
  deliveriesByMatchId: new Map(),
  teamsList: [],
  seasonsList: [],
  venuesList: [],
  playersList: [],
  playerStatsIndex: {},
  seasonWinners: {}, // season -> { champion, runnerUp }
};

// Normalize team names for consistency across seasons
const TEAM_NORMALIZATION_MAP = {
  'Rising Pune Supergiant': 'Rising Pune Supergiants',
  'Royal Challengers Bengaluru': 'Royal Challengers Bangalore',
  'Delhi Daredevils': 'Delhi Capitals',
  'Kings XI Punjab': 'Punjab Kings'
};

function normalizeTeamName(name) {
  if (!name) return "";
  const trimmed = name.trim();
  return TEAM_NORMALIZATION_MAP[trimmed] || trimmed;
}

// Normalize seasons (e.g. 2007/08 -> 2008)
function normalizeSeason(season) {
  if (!season) return "";
  const s = season.toString().trim();
  if (s === "2007/08") return "2008";
  if (s === "2009/10") return "2010";
  if (s === "2020/21") return "2020";
  return s;
}

// Number formatting helpers
const formatNum = (num, decimals = 0) => {
  if (num === null || num === undefined || isNaN(num)) return "N/A";
  return Number(num).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

const formatRate = (num, decimals = 2) => {
  if (num === null || num === undefined || isNaN(num) || !isFinite(num)) return "0.00";
  return Number(num).toFixed(decimals);
};

// Parse a single CSV file using PapaParse
function parseCSV(fileOrUrl) {
  return new Promise((resolve, reject) => {
    Papa.parse(fileOrUrl, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: function(results) {
        resolve(results.data);
      },
      error: function(err) {
        reject(err);
      }
    });
  });
}

// Build optimized indexes for fast client-side operations
function indexIPLData(matches, deliveries) {
  console.time("Indexing IPL Data");
  
  // 1. Normalize matches
  const normalizedMatches = matches.map(m => {
    const team1 = normalizeTeamName(m.team1);
    const team2 = normalizeTeamName(m.team2);
    const winner = normalizeTeamName(m.winner);
    const toss_winner = normalizeTeamName(m.toss_winner);
    const season = normalizeSeason(m.season);
    
    return {
      ...m,
      team1,
      team2,
      winner: m.winner ? winner : null,
      toss_winner: m.toss_winner ? toss_winner : null,
      season
    };
  });

  // 2. Normalize deliveries
  const normalizedDeliveries = deliveries.map(d => {
    const batting_team = normalizeTeamName(d.batting_team);
    const bowling_team = normalizeTeamName(d.bowling_team);
    return {
      ...d,
      batting_team,
      bowling_team
    };
  });

  window.IPLData.matches = normalizedMatches;
  window.IPLData.deliveries = normalizedDeliveries;

  // 3. Map matches by ID for quick lookups
  const matchesMap = new Map();
  normalizedMatches.forEach(m => {
    matchesMap.set(m.id, m);
  });
  window.IPLData.matchesMap = matchesMap;

  // 4. Group deliveries by match ID
  const deliveriesByMatchId = new Map();
  normalizedDeliveries.forEach(d => {
    if (!deliveriesByMatchId.has(d.match_id)) {
      deliveriesByMatchId.set(d.match_id, []);
    }
    deliveriesByMatchId.get(d.match_id).push(d);
  });
  window.IPLData.deliveriesByMatchId = deliveriesByMatchId;

  // 5. Unique lists for dropdown filters
  const teamsSet = new Set();
  const seasonsSet = new Set();
  const venuesSet = new Set();
  const playersSet = new Set();

  normalizedMatches.forEach(m => {
    if (m.team1) teamsSet.add(m.team1);
    if (m.team2) teamsSet.add(m.team2);
    if (m.season) seasonsSet.add(m.season);
    if (m.venue) venuesSet.add(m.venue);
  });

  normalizedDeliveries.forEach(d => {
    if (d.batter) playersSet.add(d.batter);
    if (d.bowler) playersSet.add(d.bowler);
    if (d.non_striker) playersSet.add(d.non_striker);
  });

  window.IPLData.teamsList = Array.from(teamsSet).sort();
  window.IPLData.seasonsList = Array.from(seasonsSet).sort((a, b) => parseInt(a) - parseInt(b));
  window.IPLData.venuesList = Array.from(venuesSet).sort();
  window.IPLData.playersList = Array.from(playersSet).sort();

  // 6. Precompute yearly champions & runners-up
  // In IPL, the final match of a season determines the winner. 
  // Let's find the last match of each season by date.
  const matchesBySeasonMap = {};
  normalizedMatches.forEach(m => {
    if (!matchesBySeasonMap[m.season]) {
      matchesBySeasonMap[m.season] = [];
    }
    matchesBySeasonMap[m.season].push(m);
  });

  window.IPLData.seasonWinners = {};
  Object.keys(matchesBySeasonMap).forEach(season => {
    const seasonMatches = matchesBySeasonMap[season];
    // Sort matches by date to find the final match of the season (latest date, league matches are first, final is last)
    // Sometimes final is not the absolute latest because of scheduling, but in standard datasets, it has the highest ID or date.
    // Let's sort by ID or date. Standard IPL datasets have IDs ordered chronologically.
    seasonMatches.sort((a, b) => a.id - b.id);
    const finalMatch = seasonMatches[seasonMatches.length - 1];
    
    if (finalMatch && finalMatch.winner) {
      const champion = finalMatch.winner;
      const runnerUp = (finalMatch.winner === finalMatch.team1) ? finalMatch.team2 : finalMatch.team1;
      window.IPLData.seasonWinners[season] = {
        champion,
        runnerUp,
        finalMatchId: finalMatch.id
      };
    }
  });

  // 7. Compile Player Stats Index for speedy Player Analysis searching
  compilePlayerStatsIndex(normalizedMatches, normalizedDeliveries);

  console.timeEnd("Indexing IPL Data");
}

// Compile stats for all players in one pass
function compilePlayerStatsIndex(matches, deliveries) {
  const index = {};
  
  // Initialize index for all unique players
  window.IPLData.playersList.forEach(p => {
    index[p] = {
      name: p,
      // Batting
      battingMatches: new Set(),
      runs: 0,
      ballsFaced: 0,
      highestScore: 0,
      dismissals: 0,
      fours: 0,
      sixes: 0,
      scoresByMatch: {}, // match_id -> runs in that match
      // Bowling
      bowlingMatches: new Set(),
      wickets: 0, // wickets credited to bowler
      runsConceded: 0,
      ballsBowled: 0,
      wicketsByMatch: {}, // match_id -> wickets
      runsConcededByMatch: {}, // match_id -> runs conceded
      // Season stats
      runsBySeason: {}, // season -> runs
      wicketsBySeason: {}, // season -> wickets
      ballsBySeason: {}, // season -> balls faced (batting)
    };
  });

  // Iterate over all deliveries to sum runs, balls, wickets, etc.
  deliveries.forEach(d => {
    const match = window.IPLData.matchesMap.get(d.match_id);
    if (!match) return;
    const season = match.season;

    // Batting Calculations
    const batter = d.batter;
    if (index[batter]) {
      const bObj = index[batter];
      bObj.battingMatches.add(d.match_id);
      
      // Batsman runs
      bObj.runs += d.batsman_runs;
      if (!bObj.runsBySeason[season]) bObj.runsBySeason[season] = 0;
      bObj.runsBySeason[season] += d.batsman_runs;

      if (!bObj.scoresByMatch[d.match_id]) bObj.scoresByMatch[d.match_id] = 0;
      bObj.scoresByMatch[d.match_id] += d.batsman_runs;

      // Balls faced (exclude wides)
      if (d.extras_type !== 'wides') {
        bObj.ballsFaced += 1;
        if (!bObj.ballsBySeason[season]) bObj.ballsBySeason[season] = 0;
        bObj.ballsBySeason[season] += 1;
      }

      // Boundaries
      if (d.batsman_runs === 4) bObj.fours += 1;
      if (d.batsman_runs === 6) bObj.sixes += 1;

      // Dismissal check (if batter is dismissed)
      if (d.is_wicket && d.player_dismissed === batter) {
        bObj.dismissals += 1;
      }
    }

    // Bowling Calculations
    const bowler = d.bowler;
    if (index[bowler]) {
      const bowObj = index[bowler];
      bowObj.bowlingMatches.add(d.match_id);

      // Runs conceded: batsman_runs + extra_runs (excluding byes and legbyes)
      const runs = d.batsman_runs + d.extra_runs;
      const isByeOrLegBye = (d.extras_type === 'byes' || d.extras_type === 'legbyes');
      const bowlerRuns = isByeOrLegBye ? d.batsman_runs : runs; // Wait, byes & legbyes are not credited to bowler. wide/noball runs are.
      
      bowObj.runsConceded += bowlerRuns;
      if (!bowObj.runsConcededByMatch[d.match_id]) bowObj.runsConcededByMatch[d.match_id] = 0;
      bowObj.runsConcededByMatch[d.match_id] += bowlerRuns;

      // Legal balls bowled (exclude wides and noballs)
      const isExtraBall = (d.extras_type === 'wides' || d.extras_type === 'noballs');
      if (!isExtraBall) {
        bowObj.ballsBowled += 1;
      }

      // Wickets (exclude run out, retired hurt, obstructing field)
      if (d.is_wicket && d.dismissal_kind) {
        const dk = d.dismissal_kind.trim().toLowerCase();
        const bowlerWicket = !['run out', 'retired hurt', 'obstructing the field', 'retired out', 'na'].includes(dk);
        if (bowlerWicket) {
          bowObj.wickets += 1;
          if (!bowObj.wicketsBySeason[season]) bowObj.wicketsBySeason[season] = 0;
          bowObj.wicketsBySeason[season] += 1;

          if (!bowObj.wicketsByMatch[d.match_id]) bowObj.wicketsByMatch[d.match_id] = 0;
          bowObj.wicketsByMatch[d.match_id] += 1;
        }
      }
    }
  });

  // Calculate highest scores, best bowling and convert Set sizes to counts
  Object.keys(index).forEach(name => {
    const p = index[name];
    
    // Batting summarizing
    p.matchesCount = p.battingMatches.size || p.bowlingMatches.size || 0;
    
    const scores = Object.values(p.scoresByMatch);
    p.highestScore = scores.length > 0 ? Math.max(...scores) : 0;

    // Check how many 50s and 100s
    p.fifties = 0;
    p.hundreds = 0;
    scores.forEach(s => {
      if (s >= 100) p.hundreds += 1;
      else if (s >= 50) p.fifties += 1;
    });

    p.battingAvg = p.dismissals > 0 ? p.runs / p.dismissals : (p.runs > 0 ? p.runs : 0);
    p.battingSR = p.ballsFaced > 0 ? (p.runs / p.ballsFaced) * 100 : 0;

    // Bowling summarizing
    p.oversBowled = Math.floor(p.ballsBowled / 6) + (p.ballsBowled % 6) / 10;
    const totalOversFractional = p.ballsBowled / 6;
    p.economy = totalOversFractional > 0 ? p.runsConceded / totalOversFractional : 0;
    p.bowlingAvg = p.wickets > 0 ? p.runsConceded / p.wickets : (p.wickets > 0 ? 0 : null);
    
    // Find best bowling in a match
    let bestWickets = 0;
    let bestRuns = 999;
    let hasBowled = false;

    Object.keys(p.runsConcededByMatch).forEach(mId => {
      hasBowled = true;
      const w = p.wicketsByMatch[mId] || 0;
      const r = p.runsConcededByMatch[mId] || 0;
      if (w > bestWickets) {
        bestWickets = w;
        bestRuns = r;
      } else if (w === bestWickets && r < bestRuns) {
        bestRuns = r;
      }
    });

    p.bestBowling = hasBowled ? `${bestWickets}/${bestRuns === 999 ? 0 : bestRuns}` : "N/A";
  });

  window.IPLData.playerStatsIndex = index;
}

// Map known captains to teams based on season
function getMatchCaptain(team, season) {
  const s = parseInt(season);
  if (isNaN(s)) return "Unknown";
  
  if (team === "Chennai Super Kings") {
    if (s === 2024) return "Ruturaj Gaikwad";
    return "MS Dhoni";
  }
  if (team === "Mumbai Indians") {
    if (s === 2024) return "Hardik Pandya";
    if (s >= 2013 && s <= 2023) return "Rohit Sharma";
    if (s === 2012) return "Harbhajan Singh";
    return "Sachin Tendulkar";
  }
  if (team === "Royal Challengers Bangalore") {
    if (s >= 2022) return "Faf du Plessis";
    if (s >= 2011 && s <= 2021) return "Virat Kohli";
    if (s >= 2009 && s <= 2010) return "Anil Kumble";
    return "Rahul Dravid";
  }
  if (team === "Kolkata Knight Riders") {
    if (s === 2024 || s === 2022) return "Shreyas Iyer";
    if (s === 2023) return "Nitish Rana";
    if (s >= 2020 && s <= 2021) return "Eoin Morgan";
    if (s >= 2018 && s <= 2020) return "Dinesh Karthik";
    if (s >= 2011 && s <= 2017) return "Gautam Gambhir";
    if (s === 2009) return "Brendon McCullum";
    return "Sourav Ganguly";
  }
  if (team === "Rajasthan Royals") {
    if (s >= 2021) return "Sanju Samson";
    if (s === 2020 || s === 2015) return "Steve Smith";
    if (s === 2018 || s === 2019) return "Ajinkya Rahane";
    if (s >= 2012 && s <= 2013) return "Rahul Dravid";
    return "Shane Warne";
  }
  if (team === "Sunrisers Hyderabad") {
    if (s === 2024) return "Pat Cummins";
    if (s === 2023) return "Aiden Markram";
    if (s === 2022) return "Kane Williamson";
    if (s >= 2015 && s <= 2021) return "David Warner";
    return "Shikhar Dhawan";
  }
  if (team === "Delhi Capitals") {
    if (s === 2024 || s === 2021 || s === 2022) return "Rishabh Pant";
    if (s === 2023) return "David Warner";
    if (s >= 2018 && s <= 2020) return "Shreyas Iyer";
    if (s >= 2016 && s <= 2017) return "Zaheer Khan";
    return "Virender Sehwag";
  }
  if (team === "Punjab Kings") {
    if (s >= 2023) return "Shikhar Dhawan";
    if (s === 2022) return "Mayank Agarwal";
    if (s >= 2020 && s <= 2021) return "KL Rahul";
    if (s >= 2018 && s <= 2019) return "R Ashwin";
    if (s === 2017) return "Glenn Maxwell";
    if (s === 2016) return "Murali Vijay";
    if (s >= 2014 && s <= 2015) return "George Bailey";
    return "Adam Gilchrist";
  }
  if (team === "Deccan Chargers") {
    if (s === 2008) return "VVS Laxman";
    return "Adam Gilchrist";
  }
  if (team === "Gujarat Titans") {
    if (s === 2024) return "Shubman Gill";
    return "Hardik Pandya";
  }
  if (team === "Lucknow Super Giants") {
    return "KL Rahul";
  }
  if (team === "Pune Warriors") {
    if (s === 2012) return "Sourav Ganguly";
    if (s === 2011) return "Yuvraj Singh";
    return "Aaron Finch";
  }
  if (team === "Rising Pune Supergiants") {
    if (s === 2016) return "MS Dhoni";
    return "Steve Smith";
  }
  if (team === "Gujarat Lions") {
    return "Suresh Raina";
  }
  if (team === "Kochi Tuskers Kerala") {
    return "Mahela Jayawardene";
  }
  return "Unknown";
}

window.getMatchCaptain = getMatchCaptain;

