// Core App Controller
window.App = {
  activeTab: 'dashboard',
  uploadedFiles: {
    matches: null,
    deliveries: null
  },

  init: function() {
    this.setupTheme();
    this.setupNavigation();
    this.setupMobileControls();
    this.setupGlobalSearch();
    this.setupScrollToTop();
    this.setupKeyboardShortcuts();
    this.setupWindowResize();
    this.attemptAutoLoad();
  },

  // Theme Management (Light/Dark)
  setupTheme: function() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;

    // Load saved theme or default to dark
    const savedTheme = localStorage.getItem('ipl-dashboard-theme') || 'dark-theme';
    if (savedTheme === 'dark-theme') {
      document.body.classList.add('dark-theme');
      themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
      document.body.classList.remove('dark-theme');
      themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    }

    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-theme');
      const isDark = document.body.classList.contains('dark-theme');
      
      if (isDark) {
        localStorage.setItem('ipl-dashboard-theme', 'dark-theme');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
      } else {
        localStorage.setItem('ipl-dashboard-theme', 'light-theme');
        themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
      }
      
      // Update Chart Colors
      if (window.ChartManager && typeof window.ChartManager.updateChartsTheme === 'function') {
        window.ChartManager.updateChartsTheme();
      }
    });
  },

  // Single-page navigation routing
  setupNavigation: function() {
    const navLinks = document.querySelectorAll('.nav-link[data-tab]');
    const views = document.querySelectorAll('.view-section');
    const breadcrumbCurrent = document.getElementById('bc-current');

    const switchTab = (tabId) => {
      if (!window.IPLData.matches.length) return; // Block nav until data loaded

      this.activeTab = tabId;

      // Update Nav active classes
      navLinks.forEach(link => {
        if (link.getAttribute('data-tab') === tabId) {
          link.classList.add('active');
          // Update breadcrumb
          if (breadcrumbCurrent) {
            breadcrumbCurrent.textContent = link.querySelector('span').textContent;
          }
        } else {
          link.classList.remove('active');
        }
      });

      // Update Views visibility
      views.forEach(view => {
        if (view.id === `${tabId}-view`) {
          view.classList.remove('hidden');
        } else {
          view.classList.add('hidden');
        }
      });

      // Close mobile drawer on navigation
      document.querySelector('.sidebar').classList.remove('active');

      // Initialize page-specific data
      this.initPageData(tabId);
    };

    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const tabId = link.getAttribute('data-tab');
        switchTab(tabId);
      });
    });

    window.switchTab = switchTab; // Expose globally
  },

  initPageData: function(tabId) {
    // Lazy load pages as clicked to conserve browser performance
    if (tabId === 'dashboard' && window.DashboardPage) {
      window.DashboardPage.init();
    } else if (tabId === 'analysis' && window.AnalysisPage) {
      window.AnalysisPage.init();
    } else if (tabId === 'advanced' && window.AdvancedPage) {
      window.AdvancedPage.init();
    } else if (tabId === 'team' && window.TeamPage) {
      window.TeamPage.init();
    } else if (tabId === 'player' && window.PlayerPage) {
      window.PlayerPage.init();
    } else if (tabId === 'season' && window.SeasonPage) {
      window.SeasonPage.init();
    } else if (tabId === 'prediction' && window.PredictionPage) {
      window.PredictionPage.init();
    }
  },

  // Hamburger drawer for Mobile
  setupMobileControls: function() {
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.querySelector('.sidebar');

    if (menuToggle && sidebar) {
      menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
      });
    }

    // Fullscreen Toggle
    const fsToggle = document.getElementById('fullscreen-toggle');
    if (fsToggle) {
      fsToggle.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen()
            .then(() => {
              fsToggle.innerHTML = '<i class="fas fa-compress"></i>';
            });
        } else {
          document.exitFullscreen()
            .then(() => {
              fsToggle.innerHTML = '<i class="fas fa-expand"></i>';
            });
        }
      });
    }

    // Export PDF Trigger
    const pdfBtn = document.getElementById('export-pdf-btn');
    if (pdfBtn) {
      pdfBtn.addEventListener('click', () => {
        window.print();
      });
    }

    // Reset Filters Trigger
    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    if (resetFiltersBtn) {
      resetFiltersBtn.addEventListener('click', () => {
        // Reset analysis page dropdowns
        const anSeason = document.getElementById('analysis-season');
        const anVenue = document.getElementById('analysis-venue');
        const anTeam = document.getElementById('analysis-team');
        if (anSeason) anSeason.value = 'all';
        if (anVenue) anVenue.value = 'all';
        if (anTeam) anTeam.value = 'all';

        // Reset advanced page dropdowns
        const advSeason = document.getElementById('adv-season');
        const advTeam = document.getElementById('adv-team');
        if (advSeason) advSeason.value = 'all';
        if (advTeam) advTeam.value = 'all';

        // Reapply stats
        if (this.activeTab === 'analysis' && window.AnalysisPage) {
          window.AnalysisPage.applyFilters();
        } else if (this.activeTab === 'advanced' && window.AdvancedPage) {
          window.AdvancedPage.applyFilters();
        }
        alert("All filters reset successfully.");
      });
    }
  },

  // Smart Global Search Redirect
  setupGlobalSearch: function() {
    const input = document.getElementById('global-search-input');
    if (!input) return;

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const query = e.target.value.toLowerCase().trim();
        if (!query) return;

        // Check if matches a team
        const matchedTeam = window.IPLData.teamsList.find(t => t.toLowerCase().includes(query));
        if (matchedTeam) {
          input.value = '';
          window.switchTab('team');
          const select = document.getElementById('team-select');
          if (select) {
            select.value = matchedTeam;
            window.TeamPage.applyTeamSelection();
          }
          return;
        }

        // Check if matches a player
        const matchedPlayer = window.IPLData.playersList.find(p => p.toLowerCase().includes(query));
        if (matchedPlayer) {
          input.value = '';
          window.switchTab('player');
          const playerInput = document.getElementById('player-search-input');
          if (playerInput) {
            playerInput.value = matchedPlayer;
            window.PlayerPage.displayPlayer(matchedPlayer);
          }
          return;
        }

        // Check if matches a season
        const matchedSeason = window.IPLData.seasonsList.find(s => s.toLowerCase().includes(query));
        if (matchedSeason) {
          input.value = '';
          window.switchTab('season');
          const seasonSelect = document.getElementById('season-select');
          if (seasonSelect) {
            seasonSelect.value = matchedSeason;
            window.SeasonPage.applySeasonSelection();
          }
          return;
        }

        // Check if matches a venue
        const matchedVenue = window.IPLData.venuesList.find(v => v.toLowerCase().includes(query));
        if (matchedVenue) {
          input.value = '';
          window.switchTab('analysis');
          const venueSelect = document.getElementById('analysis-venue');
          if (venueSelect) {
            venueSelect.value = matchedVenue;
            window.AnalysisPage.applyFilters();
          }
          return;
        }

        alert(`No matching Team, Player, Season, or Venue found for "${e.target.value}".`);
      }
    });
  },

  // Scroll to Top Smooth Transition
  setupScrollToTop: function() {
    const scrollBtn = document.getElementById('scroll-top');
    if (!scrollBtn) return;

    window.addEventListener('scroll', () => {
      if (window.scrollY > 400) {
        scrollBtn.classList.add('visible');
      } else {
        scrollBtn.classList.remove('visible');
      }
    });

    scrollBtn.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  },

  setupKeyboardShortcuts: function() {
    document.addEventListener('keydown', (e) => {
      // Toggle Dark/Light theme: Alt + T
      if (e.altKey && e.key.toLowerCase() === 't') {
        const toggle = document.getElementById('theme-toggle');
        if (toggle) toggle.click();
      }
      // Toggle Fullscreen: Alt + F
      if (e.altKey && e.key.toLowerCase() === 'f') {
        const fsToggle = document.getElementById('fullscreen-toggle');
        if (fsToggle) fsToggle.click();
      }
    });
  },

  setupWindowResize: function() {
    // Redraw charts on resize to fit nicely
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (window.ChartManager && typeof window.ChartManager.updateChartsTheme === 'function') {
          window.ChartManager.updateChartsTheme();
        }
      }, 100);
    });
  },

  // Automatic Data Ingestion Flow (Server Mode)
  attemptAutoLoad: function() {
    const spinner = document.getElementById('load-spinner');
    const uploadForm = document.getElementById('upload-form');
    const loadingText = document.getElementById('load-status-text');

    loadingText.textContent = "Checking workspace datasets...";

    // Check if files exist at data/matches.csv and data/deliveries.csv
    Promise.all([
      fetch('data/matches.csv').then(res => {
        if (!res.ok) throw new Error("matches.csv not found");
        return res.text();
      }),
      fetch('data/deliveries.csv').then(res => {
        if (!res.ok) throw new Error("deliveries.csv not found");
        return res.text();
      })
    ])
    .then(([matchesCsv, deliveriesCsv]) => {
      loadingText.textContent = "Parsing CSV datasets...";
      
      // Parse using PapaParse
      const matches = Papa.parse(matchesCsv, { header: true, dynamicTyping: true, skipEmptyLines: true }).data;
      const deliveries = Papa.parse(deliveriesCsv, { header: true, dynamicTyping: true, skipEmptyLines: true }).data;

      loadingText.textContent = "Compiling analytics...";
      
      setTimeout(() => {
        indexIPLData(matches, deliveries);
        document.getElementById('loading-overlay').classList.add('hidden');
        window.switchTab('dashboard'); // Go home!
      }, 100);
    })
    .catch(err => {
      console.warn("Auto load failed or blocked by CORS. Switching to Upload Interface.", err);
      // Fail -> transition loading screen into drag-and-drop upload screen
      spinner.classList.add('hidden');
      uploadForm.classList.remove('hidden');
      loadingText.textContent = "CORS block or files missing. Please select matches.csv & deliveries.csv.";
      this.setupUploadHandlers();
    });
  },

  // Drag and Drop Upload Interface Handler (File Mode)
  setupUploadHandlers: function() {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const fileStatus = document.getElementById('file-status-list');
    const statusText = document.getElementById('load-status-text');

    const handleFiles = (files) => {
      for (let file of files) {
        if (file.name.includes('matches')) {
          this.uploadedFiles.matches = file;
        } else if (file.name.includes('deliveries')) {
          this.uploadedFiles.deliveries = file;
        }
      }

      this.renderUploadStatus();

      // If both files are selected, process them!
      if (this.uploadedFiles.matches && this.uploadedFiles.deliveries) {
        this.processUploadedFiles();
      }
    };

    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    // Drag-over styling
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    ['dragleave', 'dragend'].forEach(evt => {
      dropzone.addEventListener(evt, () => {
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      handleFiles(e.dataTransfer.files);
    });
  },

  renderUploadStatus: function() {
    const container = document.getElementById('file-status-list');
    container.innerHTML = '';

    const files = [
      { name: 'matches.csv', key: 'matches' },
      { name: 'deliveries.csv', key: 'deliveries' }
    ];

    files.forEach(f => {
      const isUploaded = this.uploadedFiles[f.key] !== null;
      const bg = isUploaded ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
      const color = isUploaded ? 'var(--success-color)' : 'var(--danger-color)';
      const text = isUploaded ? 'Uploaded ✓' : 'Pending';

      container.innerHTML += `
        <div class="file-status-item">
          <span class="file-status-name">${f.name}</span>
          <span class="file-status-badge" style="background:${bg}; color:${color};">${text}</span>
        </div>
      `;
    });
  },

  processUploadedFiles: function() {
    const spinner = document.getElementById('load-spinner');
    const uploadForm = document.getElementById('upload-form');
    const loadingText = document.getElementById('load-status-text');

    uploadForm.classList.add('hidden');
    spinner.classList.remove('hidden');
    loadingText.textContent = "Parsing local uploads...";

    Promise.all([
      parseCSV(this.uploadedFiles.matches),
      parseCSV(this.uploadedFiles.deliveries)
    ])
    .then(([matches, deliveries]) => {
      loadingText.textContent = "Analyzing historical indices...";
      setTimeout(() => {
        indexIPLData(matches, deliveries);
        document.getElementById('loading-overlay').classList.add('hidden');
        window.switchTab('dashboard'); // Redirect to Dashboard
      }, 200);
    })
    .catch(err => {
      alert("Failed to parse files. Make sure they are correct matches.csv and deliveries.csv files!");
      console.error(err);
      // Reset status
      this.uploadedFiles.matches = null;
      this.uploadedFiles.deliveries = null;
      spinner.classList.add('hidden');
      uploadForm.classList.remove('hidden');
      this.renderUploadStatus();
    });
  }
};

// Initialize App
window.addEventListener('DOMContentLoaded', () => {
  window.App.init();
});
