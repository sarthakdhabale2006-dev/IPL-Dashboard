// Chart Manager to track and modify chart instances globally
window.ChartManager = {
  instances: {},

  // Create or reuse a chart instance
  createChart: function(canvasId, type, data, options = {}) {
    // If instance exists, destroy it first to avoid overlap bugs
    if (this.instances[canvasId]) {
      this.instances[canvasId].destroy();
    }

    const ctx = document.getElementById(canvasId);
    if (!ctx) {
      console.warn(`Canvas element with ID '${canvasId}' not found.`);
      return null;
    }

    // Apply global theme-aware styling to options
    const finalOptions = this.applyThemeToOptions(type, options);

    const chart = new Chart(ctx, {
      type: type,
      data: data,
      options: finalOptions
    });

    this.instances[canvasId] = chart;
    return chart;
  },

  // Destroy a specific chart
  destroyChart: function(canvasId) {
    if (this.instances[canvasId]) {
      this.instances[canvasId].destroy();
      delete this.instances[canvasId];
    }
  },

  // Destroy all charts (useful on reset/reloading data)
  destroyAllCharts: function() {
    Object.keys(this.instances).forEach(id => {
      this.destroyChart(id);
    });
  },

  // Get color variables based on current theme
  getThemeColors: function() {
    const isDark = document.body.classList.contains('dark-theme');
    return {
      text: isDark ? '#F1F5F9' : '#1F2937',
      mutedText: isDark ? '#94A3B8' : '#6B7280',
      gridLines: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      tooltipBg: isDark ? '#1E293B' : '#FFFFFF',
      tooltipBorder: isDark ? '#334155' : '#E2E8F0',
      primary: '#2563EB',
      secondary: '#1E40AF',
      accent: '#F59E0B',
      success: '#10B981',
      danger: '#EF4444',
      // Multi-color palette for team/pie charts
      palette: [
        '#2563EB', '#F59E0B', '#10B981', '#EF4444', 
        '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', 
        '#14B8A6', '#6366F1', '#A855F7', '#84CC16'
      ]
    };
  },

  // Adjust Chart.js options dynamically based on light/dark mode variables
  applyThemeToOptions: function(type, options) {
    const colors = this.getThemeColors();
    
    // Copy options
    const opt = JSON.parse(JSON.stringify(options));
    
    // Set default responsive options
    opt.responsive = true;
    opt.maintainAspectRatio = false;

    // Tooltip defaults
    opt.plugins = opt.plugins || {};
    opt.plugins.tooltip = opt.plugins.tooltip || {};
    opt.plugins.tooltip.backgroundColor = colors.tooltipBg;
    opt.plugins.tooltip.titleColor = colors.text;
    opt.plugins.tooltip.bodyColor = colors.text;
    opt.plugins.tooltip.borderColor = colors.tooltipBorder;
    opt.plugins.tooltip.borderWidth = 1;
    opt.plugins.tooltip.padding = 10;
    opt.plugins.tooltip.cornerRadius = 8;

    // Legend defaults
    opt.plugins.legend = opt.plugins.legend || {};
    opt.plugins.legend.labels = opt.plugins.legend.labels || {};
    opt.plugins.legend.labels.color = colors.text;
    opt.plugins.legend.labels.font = {
      family: "'Poppins', sans-serif",
      size: 11
    };

    // Title defaults
    opt.plugins.title = opt.plugins.title || {};
    opt.plugins.title.color = colors.text;
    opt.plugins.title.font = {
      family: "'Poppins', sans-serif",
      size: 14,
      weight: '600'
    };

    // Scale axes defaults for cartesian charts (bar, line, etc.)
    if (type !== 'pie' && type !== 'doughnut' && type !== 'radar') {
      opt.scales = opt.scales || {};
      
      // X Axis
      opt.scales.x = opt.scales.x || {};
      opt.scales.x.grid = opt.scales.x.grid || {};
      opt.scales.x.grid.color = colors.gridLines;
      opt.scales.x.ticks = opt.scales.x.ticks || {};
      opt.scales.x.ticks.color = colors.mutedText;
      opt.scales.x.ticks.font = { family: "'Poppins', sans-serif", size: 10 };

      // Y Axis
      opt.scales.y = opt.scales.y || {};
      opt.scales.y.grid = opt.scales.y.grid || {};
      opt.scales.y.grid.color = colors.gridLines;
      opt.scales.y.ticks = opt.scales.y.ticks || {};
      opt.scales.y.ticks.color = colors.mutedText;
      opt.scales.y.ticks.font = { family: "'Poppins', sans-serif", size: 10 };
    } else if (type === 'radar') {
      opt.scales = opt.scales || {};
      opt.scales.r = opt.scales.r || {};
      opt.scales.r.grid = opt.scales.r.grid || {};
      opt.scales.r.grid.color = colors.gridLines;
      opt.scales.r.angleLines = opt.scales.r.angleLines || {};
      opt.scales.r.angleLines.color = colors.gridLines;
      opt.scales.r.pointLabels = opt.scales.r.pointLabels || {};
      opt.scales.r.pointLabels.color = colors.text;
      opt.scales.r.ticks = opt.scales.r.ticks || {};
      opt.scales.r.ticks.color = colors.mutedText;
      opt.scales.r.ticks.backdropColor = 'transparent';
    }

    return opt;
  },

  // Update theme colors on all active charts
  updateChartsTheme: function() {
    const colors = this.getThemeColors();
    
    Object.keys(this.instances).forEach(canvasId => {
      const chart = this.instances[canvasId];
      if (!chart) return;

      // Update options
      const opt = chart.options;
      
      // Legend
      if (opt.plugins && opt.plugins.legend && opt.plugins.legend.labels) {
        opt.plugins.legend.labels.color = colors.text;
      }

      // Tooltips
      if (opt.plugins && opt.plugins.tooltip) {
        opt.plugins.tooltip.backgroundColor = colors.tooltipBg;
        opt.plugins.tooltip.titleColor = colors.text;
        opt.plugins.tooltip.bodyColor = colors.text;
        opt.plugins.tooltip.borderColor = colors.tooltipBorder;
      }

      // Axis Scales
      if (opt.scales) {
        if (opt.scales.x && opt.scales.x.grid) {
          opt.scales.x.grid.color = colors.gridLines;
          opt.scales.x.ticks.color = colors.mutedText;
        }
        if (opt.scales.y && opt.scales.y.grid) {
          opt.scales.y.grid.color = colors.gridLines;
          opt.scales.y.ticks.color = colors.mutedText;
        }
        if (opt.scales.r) {
          if (opt.scales.r.grid) opt.scales.r.grid.color = colors.gridLines;
          if (opt.scales.r.angleLines) opt.scales.r.angleLines.color = colors.gridLines;
          if (opt.scales.r.pointLabels) opt.scales.r.pointLabels.color = colors.text;
          if (opt.scales.r.ticks) opt.scales.r.ticks.color = colors.mutedText;
        }
      }

      chart.update();
    });
  },

  // Export chart as PNG file
  exportChartAsPNG: function(canvasId, fileName = 'chart.png') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // To ensure the canvas background is clean (especially for transparent dark mode charts)
    // we can draw it on a temporary canvas with current background color or just trigger download.
    // Standard canvas.toDataURL() works perfectly.
    const imageURL = canvas.toDataURL("image/png");
    
    const link = document.createElement('a');
    link.href = imageURL;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
