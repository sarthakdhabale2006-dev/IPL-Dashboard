// Prediction Page Controller
window.PredictionPage = {
  isInitialized: false,

  init: function() {
    this.populateSelectors();
    this.setupListeners();
    this.isInitialized = true;
  },

  populateSelectors: function() {
    const t1 = document.getElementById('predict-team1');
    const t2 = document.getElementById('predict-team2');
    const venue = document.getElementById('predict-venue');

    // Populate teams
    t1.innerHTML = '<option value="">Select Team 1</option>';
    t2.innerHTML = '<option value="">Select Team 2</option>';
    window.IPLData.teamsList.forEach(team => {
      t1.innerHTML += `<option value="${team}">${team}</option>`;
      t2.innerHTML += `<option value="${team}">${team}</option>`;
    });

    // Populate venues
    venue.innerHTML = '<option value="">Select Venue</option>';
    window.IPLData.venuesList.forEach(v => {
      venue.innerHTML += `<option value="${v}">${v}</option>`;
    });
  },

  setupListeners: function() {
    const t1 = document.getElementById('predict-team1');
    const t2 = document.getElementById('predict-team2');
    const tossWin = document.getElementById('predict-toss-winner');
    const submitBtn = document.getElementById('predict-submit');

    // Update Toss Winner options when teams are selected
    const updateTossOptions = () => {
      const team1 = t1.value;
      const team2 = t2.value;

      tossWin.innerHTML = '<option value="">Select Toss Winner</option>';
      if (team1) tossWin.innerHTML += `<option value="${team1}">${team1}</option>`;
      if (team2) tossWin.innerHTML += `<option value="${team2}">${team2}</option>`;
    };

    t1.removeEventListener('change', updateTossOptions);
    t1.addEventListener('change', updateTossOptions);

    t2.removeEventListener('change', updateTossOptions);
    t2.addEventListener('change', updateTossOptions);

    // Predict button listener
    submitBtn.removeEventListener('click', this.runPrediction);
    submitBtn.addEventListener('click', () => this.runPrediction());
  },

  runPrediction: function() {
    const team1 = document.getElementById('predict-team1').value;
    const team2 = document.getElementById('predict-team2').value;
    const venue = document.getElementById('predict-venue').value;
    const tossWinner = document.getElementById('predict-toss-winner').value;
    const tossDecision = document.getElementById('predict-toss-decision').value;

    // Validate inputs
    if (!team1 || !team2 || !venue || !tossWinner || !tossDecision) {
      alert("Please fill in all prediction fields!");
      return;
    }

    if (team1 === team2) {
      alert("Please select two different teams!");
      return;
    }

    const matches = window.IPLData.matches;

    // --- 1. HEAD TO HEAD (35% Weight) ---
    const h2hMatches = matches.filter(m => 
      (m.team1 === team1 && m.team2 === team2) || 
      (m.team1 === team2 && m.team2 === team1)
    );
    let h2hT1Wins = 0;
    let h2hT2Wins = 0;
    h2hMatches.forEach(m => {
      if (m.winner === team1) h2hT1Wins++;
      else if (m.winner === team2) h2hT2Wins++;
    });

    let sH2H1 = 0.5;
    if (h2hMatches.length > 0) {
      sH2H1 = h2hT1Wins / h2hMatches.length;
    }

    // --- 2. VENUE ADVANTAGE (20% Weight) ---
    const venueMatchesT1 = matches.filter(m => m.venue === venue && (m.team1 === team1 || m.team2 === team1));
    const venueMatchesT2 = matches.filter(m => m.venue === venue && (m.team1 === team2 || m.team2 === team2));

    let vWinsT1 = 0;
    let vWinsT2 = 0;
    venueMatchesT1.forEach(m => { if (m.winner === team1) vWinsT1++; });
    venueMatchesT2.forEach(m => { if (m.winner === team2) vWinsT2++; });

    const rVenueT1 = venueMatchesT1.length > 0 ? vWinsT1 / venueMatchesT1.length : 0.5;
    const rVenueT2 = venueMatchesT2.length > 0 ? vWinsT2 / venueMatchesT2.length : 0.5;
    const sVenue1 = rVenueT1 / (rVenueT1 + rVenueT2 || 1);

    // --- 3. RECENT FORM (20% Weight) ---
    // Get last 5 matches of Team 1 and Team 2
    const getRecentForm = (teamName) => {
      const teamM = matches.filter(m => m.winner && (m.team1 === teamName || m.team2 === teamName))
                            .sort((a, b) => b.id - a.id) // Latest first
                            .slice(0, 5);
      let wins = 0;
      teamM.forEach(m => { if (m.winner === teamName) wins++; });
      return teamM.length > 0 ? wins / teamM.length : 0.5;
    };

    const formT1 = getRecentForm(team1);
    const formT2 = getRecentForm(team2);
    const sForm1 = formT1 / (formT1 + formT2 || 1);

    // --- 4. TOSS IMPACT (15% Weight) ---
    // Win rate at venue when choosing tossDecision
    const tossDecisionMatches = matches.filter(m => m.venue === venue && m.toss_decision === tossDecision);
    let tossDecisionWins = 0;
    tossDecisionMatches.forEach(m => {
      if (m.toss_winner === m.winner) tossDecisionWins++;
    });

    const tossDecisionAdv = tossDecisionMatches.length > 0 ? tossDecisionWins / tossDecisionMatches.length : 0.53; // Default historical toss win rate in IPL is ~53%
    
    let sToss1 = 0.5;
    if (tossWinner === team1) {
      sToss1 = tossDecisionAdv;
    } else {
      sToss1 = 1 - tossDecisionAdv;
    }

    // --- 5. OVERALL STRENGTH (10% Weight) ---
    const allMatchesT1 = matches.filter(m => m.team1 === team1 || m.team2 === team1);
    const allMatchesT2 = matches.filter(m => m.team2 === team2 || m.team2 === team2);
    
    let allWinsT1 = 0;
    let allWinsT2 = 0;
    allMatchesT1.forEach(m => { if (m.winner === team1) allWinsT1++; });
    allMatchesT2.forEach(m => { if (m.winner === team2) allWinsT2++; });

    const rOverallT1 = allMatchesT1.length > 0 ? allWinsT1 / allMatchesT1.length : 0.5;
    const rOverallT2 = allMatchesT2.length > 0 ? allWinsT2 / allMatchesT2.length : 0.5;
    const sOverall1 = rOverallT1 / (rOverallT1 + rOverallT2 || 1);

    // --- COMBINE SCORES ---
    const finalT1Prob = (0.35 * sH2H1) + (0.20 * sVenue1) + (0.20 * sForm1) + (0.15 * sToss1) + (0.10 * sOverall1);
    
    // Percentage format
    const probPercentage = Math.round(finalT1Prob * 100);
    const t1Pct = probPercentage;
    const t2Pct = 100 - probPercentage;

    // --- CONFIDENCE SCORE ---
    // Confidence goes up with the amount of data we have
    const dataSizeScore = Math.min(h2hMatches.length, 12) * 2.5 + Math.min(venueMatchesT1.length + venueMatchesT2.length, 12) * 1.5;
    const confidence = Math.min(Math.round(55 + dataSizeScore), 92); // Cap between 55% and 92%

    // --- NARRATIVE SUMMARY ---
    let narrative = `Statistical prediction model shows `;
    if (t1Pct > t2Pct) {
      narrative += `<strong>${team1}</strong> holds the upper hand. `;
    } else {
      narrative += `<strong>${team2}</strong> holds the upper hand. `;
    }

    if (h2hMatches.length > 0) {
      narrative += `Historically, in head-to-head matches, ${team1} has won ${h2hT1Wins} out of ${h2hMatches.length} matches against ${team2}. `;
    } else {
      narrative += `These teams have no recorded head-to-head matchups in our database, making venue and recent form the dominant factors. `;
    }

    if (venueMatchesT1.length > 0 || venueMatchesT2.length > 0) {
      narrative += `At ${venue.split(',')[0]}, ${team1} has a win rate of ${Math.round(rVenueT1 * 100)}% compared to ${team2}'s ${Math.round(rVenueT2 * 100)}%. `;
    }

    const formDiff = Math.abs(formT1 - formT2);
    if (formDiff > 0.1) {
      const inFormTeam = formT1 > formT2 ? team1 : team2;
      narrative += `Recent momentum favors ${inFormTeam}, who has won ${Math.round(getRecentForm(inFormTeam) * 5)} of their last 5 matches. `;
    }
    
    narrative += `Winning the toss and choosing to ${tossDecision} gives the toss winner a historical ${Math.round(tossDecisionAdv * 100)}% advantage at this venue.`;

    // --- RENDER RESULTS TO DOM ---
    // Hide placeholder, show prediction results
    document.getElementById('predict-placeholder').classList.add('hidden');
    document.getElementById('predict-result-content').classList.remove('hidden');

    // 1. Probabilities
    document.getElementById('prob-team1-name').textContent = team1;
    document.getElementById('prob-team2-name').textContent = team2;
    document.getElementById('prob-team1-pct').textContent = `${t1Pct}%`;
    document.getElementById('prob-team2-pct').textContent = `${t2Pct}%`;

    // 2. Animate Circular Gauge
    // SVG radius is 90. Circumference is 2 * pi * r = 565.48. 
    // Half circumference (semicircle) is 282.74 (approx 283).
    // An offset of 283 is 0%, and 0 offset is 100% of the semicircle.
    // Offset = 283 - (t1Pct / 100) * 283
    const gaugeFill = document.getElementById('gauge-fill-arc');
    const offsetValue = 283 - (t1Pct / 100) * 283;
    gaugeFill.style.strokeDashoffset = offsetValue;
    
    // Set percentage text
    document.getElementById('gauge-pct-text').textContent = `${t1Pct}%`;
    document.getElementById('gauge-winner-text').textContent = t1Pct >= 50 ? team1 : team2;

    // Winner announcer banner
    const winAnnounce = document.getElementById('predict-winner-banner');
    winAnnounce.innerHTML = `Predicted Winner: <span>${t1Pct >= 50 ? team1 : team2}</span>`;

    // 3. Progress Bars (factors)
    const updateBar = (barId, pct) => {
      const bar = document.getElementById(barId);
      bar.style.width = `${pct}%`;
    };

    updateBar('bar-h2h', Math.round(sH2H1 * 100));
    updateBar('bar-venue', Math.round(sVenue1 * 100));
    updateBar('bar-form', Math.round(sForm1 * 100));
    updateBar('bar-toss', Math.round(sToss1 * 100));
    updateBar('bar-strength', Math.round(sOverall1 * 100));

    // 4. Confidence Score
    document.getElementById('predict-confidence-val').textContent = `${confidence}%`;
    const confDot = document.getElementById('confidence-dot');
    if (confidence > 80) {
      confDot.style.backgroundColor = 'var(--success-color)';
    } else if (confidence > 65) {
      confDot.style.backgroundColor = 'var(--accent-color)';
    } else {
      confDot.style.backgroundColor = 'var(--danger-color)';
    }

    // 5. Narrative Text
    document.getElementById('predict-narrative-text').innerHTML = narrative;
  }
};
