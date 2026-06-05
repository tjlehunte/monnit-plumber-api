// Wait for the DOM to fully load before executing any code
document.addEventListener("DOMContentLoaded", () => {

  // ==================== CHART VARIABLES ====================
  // References to Chart.js chart instances
  let mainChart = null;           // Main chart for displaying sensor data
  let givenergyChart = null;      // Chart for displaying GiveEnergy data
  
  // Arrays to store column names for different sensor types
  let tempCols = [];              // Temperature sensor columns
  let humCols = [];               // Humidity sensor columns
  let dewCols = [];               // Dew point sensor columns
  let gpkgCols = [];              // Grams per kilogram sensor columns
  let heatindexCols = [];         // Heat index sensor columns
  let wetbulbCols = [];           // Wet bulb temperature sensor columns
  let current3Cols = [];          // Current (min/max/avg) sensor columns
  let currentcumCols = [];        // Cumulative current (amp-hours) columns
  
  // Data storage arrays
  let allData = [];               // All fetched Monnit sensor data
  let givenergyData = [];         // All fetched GiveEnergy data
  
  
  // ==================== SPINNER DISPLAY FUNCTIONS ====================
  // Show the loading spinner for Monnit data
  function showSpinner() {
    document.getElementById("spinner").style.display = "block";
  }
  
  // Hide the loading spinner for Monnit data
  function hideSpinner() {
    document.getElementById("spinner").style.display = "none";
  }

  // Show the loading spinner for GiveEnergy data
  function showGivenergySpinner() {
    document.getElementById("givenergySpinner").style.display = "block";
  }
  
  // Hide the loading spinner for GiveEnergy data
  function hideGivenergySpinner() {
    document.getElementById("givenergySpinner").style.display = "none";
  }

  
  // ==================== COLOR CONFIGURATION ====================
  // Array of predefined colors for different rooms/sensors
  // Used to consistently color each sensor across the dashboard
  const ROOM_COLORS = [
    "#800000", "#9A6324", "#469990", "#000075", "#000000",
    "#e6194B", "#f58231", "#ffe119", "#3cb44b", "#42d4f4",
    "#f032e6", "#dcbeff", "#aaffc3", "#911eb4", "#a9a9a9",
    "#ffd8b1"
  ];

  // Predefined colors for current metric types (min, max, average)
  // These colors remain constant for these specific metric types
  const CURRENT_METRIC_COLORS = {
    "Minimum current": "#00c8f0",   // Cyan for minimum current
    "Maximum current": "#ff1a1a",   // Red for maximum current
    "Average current": "#00cc44"    // Green for average current
  };

  // Object to map room names to colors, ensuring consistency across loads
  const roomColorMap = {};
  // Index to track which color to assign next
  let roomColorIndex = 0;

  // ==================== ROOM COLOR MAPPING ====================
  // Function to get or assign a color to a room
  // If room already has a color, return it; otherwise assign the next color
  function getRoomColor(room) {
    if (!roomColorMap[room]) {
      // Assign a new color to this room, cycling through ROOM_COLORS array
      roomColorMap[room] = ROOM_COLORS[roomColorIndex % ROOM_COLORS.length];
      roomColorIndex++;
    }
    return roomColorMap[room];
  }

  
  // ==================== MAIN CHART DRAWING FUNCTION ====================
  // Draw the main sensor data chart with the provided data and columns
  function drawChart(data, cols, title, unit, isCurrentChart = false) {
    // Extract date labels from the data
    const labels = data.map(d => d.MessageDate);

    // Create alternating grid colors for better readability
    // Every 12th line (every hour) gets a darker color; others get lighter
    const gridColors = labels.map((_, i) => {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (i % 12 === 0) return isDark ? "#444" : "#ccc";     // Darker lines at hour marks
      return isDark ? "#2a2a2a" : "#ebebeb";                 // Lighter lines for other data points
    });

    // Create a dataset for each column (sensor)
    const datasets = cols.map(col => {
      // Split column name to extract room and metric information
      const parts = col.split(" - ");
      // For current charts, use the metric name; for others, use the room name
      const label = isCurrentChart ? parts[1] : parts[0];
      // Get the appropriate color for this sensor/metric
      const color = isCurrentChart ? CURRENT_METRIC_COLORS[parts[1]] : getRoomColor(parts[0]);
      
      return {
        label,                                      // Display name for this dataset
        data: data.map(d => d[col]),               // Array of values for this dataset
        borderColor: color,                         // Color of the line
        backgroundColor: color,                     // Color for data points
        pointStyle: "rect",                         // Data points displayed as squares
        borderWidth: 1,                             // Line thickness
        pointRadius: 1,                             // Size of data point markers
        pointHoverRadius: 8,                        // Size when hovering over a point
        tension: 0.2,                               // Smoothing of the line
        fill: false                                 // Don't fill area under line
      };
    });

    // Calculate the min and max values across all datasets to set Y-axis range
    const allValues = datasets
      .flatMap(ds => ds.data)                     // Flatten all data points
      .map(v => Number(v))                        // Convert to numbers
      .filter(v => Number.isFinite(v));           // Remove non-numeric values

    // Round the max/min to nearest 5 for cleaner axis labels
    const roundedMax = Math.ceil(Math.max(...allValues) / 5) * 5;
    const roundedMin = Math.floor(Math.min(...allValues) / 5) * 5;

    // Determine if dark mode is enabled for text color
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const gridColor = isDark ? "#444" : "#ccc";
    const textColor = isDark ? "#ddd" : "#000";

    // Update chart data and labels
    mainChart.data.labels = labels;
    mainChart.data.datasets = datasets;
    
    // Update chart title
    mainChart.options.plugins.title.text = title;
    mainChart.options.plugins.title.color = textColor;
    
    // Update Y-axis unit label
    mainChart.options.scales.y.title.text = unit;
    
    // Set Y-axis min and max values
    mainChart.options.scales.y.min = roundedMin;
    mainChart.options.scales.y.max = roundedMax;
    
    // Customize legend label generation to match our color scheme
    mainChart.options.plugins.legend.labels.generateLabels = function(chart) {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const tc = isDark ? "#ddd" : "#000";
      return chart.data.datasets.map((ds, i) => ({
        text: ds.label,
        fillStyle: ds.backgroundColor,
        strokeStyle: ds.backgroundColor,
        lineWidth: 0,
        pointStyle: "rect",
        fontColor: tc,
        hidden: !chart.isDatasetVisible(i),        // Preserve visibility state
        datasetIndex: i
      }));
    };
    mainChart.options.plugins.legend.labels.color = textColor;
    
    // Set text colors for axes and labels
    mainChart.options.scales.x.ticks.color = textColor;
    mainChart.options.scales.y.ticks.color = textColor;
    
    // Set title colors for axes
    mainChart.options.scales.x.title.color = textColor;
    mainChart.options.scales.y.title.color = textColor;
    
    // Set grid colors (with alternating pattern on X-axis)
    mainChart.options.scales.x.grid.color = gridColors;
    mainChart.options.scales.y.grid.color = gridColor;

    // Redraw the chart with all updated options
    mainChart.update();
  }

  
  // ==================== GIVENERGY CHART DRAWING FUNCTION ====================
  // Draw the GiveEnergy (solar/battery) data chart
  function drawGivenergyChart(data, flowCol, title) {
    // Log for debugging dark mode detection
    console.log("drawGivenergyChart called, textColor will be:", window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    
    // Extract time labels from the data
    const labels = data.map(d => d.start);
    
    // Create alternating grid colors (every 4th point is darker)
    const gridColors = labels.map((_, i) => {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (i % 4 === 0) return isDark ? "#444" : "#ccc";     // Darker lines every 4 points
      return isDark ? "#2a2a2a" : "#ebebeb";                // Lighter lines for other points
    });

    // Determine if dark mode is enabled
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const gridColor = isDark ? "#444" : "#ccc";
    const textColor = isDark ? "#ddd" : "#000";

    // Create a single dataset for the energy flow data
    const dataset = {
      label: title,                                  // Display name
      data: data.map(d => d[flowCol]),              // Array of energy values
      borderColor: "#3498db",                        // Blue line color
      backgroundColor: "#3498db",                    // Blue data points
      pointStyle: "rect",                            // Square data point markers
      borderWidth: 1,                                // Line thickness
      pointRadius: 1,                                // Size of data point
      pointHoverRadius: 8,                           // Size when hovering
      tension: 0.2,                                  // Line smoothing
      fill: false                                    // Don't fill area under line
    };

    // Calculate min and max values to set Y-axis range
    const allValues = dataset.data.map(v => Number(v)).filter(v => Number.isFinite(v));
 
    const roundedMax = Math.ceil(Math.max(...allValues) / 5) * 5;
    const roundedMin = Math.floor(Math.min(...allValues) / 5) * 5;

    // Ensure there's always a minimum range on Y-axis
    // If min and max are equal, add 5 to max to create some space
    const yMax = roundedMax === roundedMin ? roundedMin + 5 : roundedMax;
    const yMin = roundedMin;

    // Update chart labels and dataset
    givenergyChart.data.labels = labels;
    givenergyChart.data.datasets = [dataset];
    
    // Update chart title
    givenergyChart.options.plugins.title.text = title;
    givenergyChart.options.plugins.title.color = textColor;
    
    // Set Y-axis range
    givenergyChart.options.scales.y.min = yMin;
    givenergyChart.options.scales.y.max = yMax;
    
    // Set legend label color
    givenergyChart.options.plugins.legend.labels.color = textColor;
    
    // Set axis tick colors
    givenergyChart.options.scales.x.ticks.color = textColor;
    givenergyChart.options.scales.y.ticks.color = textColor;
    
    // Set axis title colors
    givenergyChart.options.scales.x.title.color = textColor;
    givenergyChart.options.scales.y.title.color = textColor;
    
    // Set grid colors
    givenergyChart.options.scales.x.grid.color = gridColors;
    givenergyChart.options.scales.y.grid.color = gridColor;
    
    // Redraw the chart with all updated options
    givenergyChart.update();
  }

  
  // ==================== TAB INITIALIZATION FUNCTION ====================
  // Initialize all tab switching functionality
  function initTabs() {

    // ===== MASTER TABS (Environment vs Current) =====
    // Handle clicks on the main master tabs
    document.querySelectorAll("#masterTabs .tab").forEach(tab => {
      tab.addEventListener("click", () => {
        // Remove active class from all master tabs
        document.querySelectorAll("#masterTabs .tab").forEach(t => t.classList.remove("active"));
        // Add active class to clicked tab
        tab.classList.add("active");

        const master = tab.dataset.master;

        // If "environment" tab clicked, show environment sub-tabs
        if (master === "environment") {
          document.getElementById("envTabs").style.display = "flex";
          document.getElementById("currentTabs").style.display = "none";
          // Trigger the currently active environment sub-tab to draw its chart
          const activeEnv = document.querySelector("#envTabs .tab.active");
          if (activeEnv) activeEnv.click();
        }

        // If "current" tab clicked, show current sub-tabs
        if (master === "current") {
          document.getElementById("envTabs").style.display = "none";
          document.getElementById("currentTabs").style.display = "flex";
          // Trigger the currently active current sub-tab to draw its chart
          const activeCurrent = document.querySelector("#currentTabs .tab.active");
          if (activeCurrent) activeCurrent.click();
        }
      });
    });

    // ===== ENVIRONMENT SUB-TABS =====
    // Handle clicks on environment sensor type tabs
    document.querySelectorAll("#envTabs .tab").forEach(tab => {
      tab.addEventListener("click", () => {
        // Remove active class from all environment tabs
        document.querySelectorAll("#envTabs .tab").forEach(t => t.classList.remove("active"));
        // Add active class to clicked tab
        tab.classList.add("active");

        // Get the sensor type from the tab's data attribute
        const type = tab.dataset.type;
        // Draw the appropriate chart based on selected sensor type
        if (type === "temperature") drawChart(allData, tempCols,      "Temperature Sensors",          "Temperature (°C)");
        if (type === "humidity")    drawChart(allData, humCols,       "Humidity Sensors",             "Humidity (%)");
        if (type === "dewpoint")    drawChart(allData, dewCols,       "Dew Point Sensors",            "Dew Point (°C)");
        if (type === "gpkg")        drawChart(allData, gpkgCols,      "Grams per Kilogram Sensors",   "Grams per Kilogram (g/kg)");
        if (type === "heatindex")   drawChart(allData, heatindexCols, "Heat Index Sensors",           "Heat Index (°C)");
        if (type === "wetbulb")     drawChart(allData, wetbulbCols,   "Wet-Bulb Temperature Sensors", "Wet Bulb (°C)");
      });
    });

    // ===== CURRENT SUB-TABS =====
    // Handle clicks on current measurement tabs
    document.querySelectorAll("#currentTabs .tab").forEach(tab => {
      tab.addEventListener("click", () => {
        // Remove active class from all current tabs
        document.querySelectorAll("#currentTabs .tab").forEach(t => t.classList.remove("active"));
        // Add active class to clicked tab
        tab.classList.add("active");

        // Get the current type from the tab's data attribute
        const type = tab.dataset.type;
        // Draw the appropriate current chart
        if (type === "current-summary")    drawChart(allData, current3Cols,   "Current (Min / Max / Avg)", "Current (A)",    true);
        if (type === "current-cumulative") drawChart(allData, currentcumCols, "Cumulative Current (Ah)",   "Amp-Hours (Ah)", true);
      });
    });
  }

  
  // ==================== LEGEND CONTROL BUTTONS ====================
  // Button to hide all datasets in the chart
  document.getElementById("hideAllBtn").onclick = () => {
    // Hide each dataset by setting visibility to false
    mainChart.data.datasets.forEach((_, i) => mainChart.setDatasetVisibility(i, false));
    mainChart.update();
  };
  
  // Button to show all datasets in the chart
  document.getElementById("showAllBtn").onclick = () => {
    // Show each dataset by setting visibility to true
    mainChart.data.datasets.forEach((_, i) => mainChart.setDatasetVisibility(i, true));
    mainChart.update();
  };
  
  // Button to toggle visibility of all datasets
  document.getElementById("invertBtn").onclick = () => {
    // Toggle each dataset's visibility (hide if shown, show if hidden)
    mainChart.data.datasets.forEach((_, i) => mainChart.setDatasetVisibility(i, !mainChart.isDatasetVisible(i)));
    mainChart.update();
  };

  
  // ==================== FETCH WITH RETRY LOGIC ====================
  // Fetch data from a URL with retry capability for reliability
  async function fetchWithRetry(url, retries = 3, delay = 5000) {
    // Attempt to fetch up to 'retries' times
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url);
        // If response is successful, parse and return the JSON
        if (response.ok) return await response.json();
      } catch (e) {
        // If not the last retry, wait before trying again
        if (i < retries - 1) await new Promise(r => setTimeout(r, delay));
      }
    }
    // If all retries exhausted, throw an error
    throw new Error("Failed to fetch after 3 retries");
  }

  
  // ==================== MAIN DATA LOADING FUNCTION ====================
  // Load all data from the API and initialize/update the dashboard
  async function loadData() {
    // Get references to the chart canvas elements
    const canvas = document.getElementById("mainChart");
    const givenergyCanvas = document.getElementById("givenergyChart");
    
    // Add loading class to show visual feedback
    canvas.classList.add("loading");
    givenergyCanvas.classList.add("loading");
    
    // Show loading spinners
    showSpinner();
    showGivenergySpinner();

    // ===== FETCH DATA FROM APIS =====
    // Fetch Monnit sensor data with retry logic
    allData = await fetchWithRetry("https://monnit-plumber-api.onrender.com/data");
 
    // Fetch GiveEnergy (solar/battery) data with retry logic
    givenergyData = await fetchWithRetry("https://monnit-plumber-api.onrender.com/givenergy");
    
    // ===== DETERMINE THEME COLORS =====
    // Check if dark mode is enabled for proper color selection
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const gridColor = isDark ? "#444" : "#ccc";
    const textColor = isDark ? "#ddd" : "#000";

    // ===== ORGANIZE SENSOR COLUMNS =====
    // Get all column names from the first data object
    const columns = Object.keys(allData[0]);

    // Filter columns by type and store in respective arrays
    // These arrays are used later to determine which sensors to display
    tempCols       = columns.filter(c => c.toLowerCase().includes("temp"));
    humCols        = columns.filter(c => c.toLowerCase().includes("humid"));
    dewCols        = columns.filter(c => c.toLowerCase().includes("dewpoint"));
    gpkgCols       = columns.filter(c => c.toLowerCase().includes("gpkg"));
    heatindexCols  = columns.filter(c => c.toLowerCase().includes("heat index"));
    wetbulbCols    = columns.filter(c => c.toLowerCase().includes("wet bulb"));
    current3Cols   = columns.filter(c =>
      c.toLowerCase().includes("average current") ||
      c.toLowerCase().includes("maximum current") ||
      c.toLowerCase().includes("minimum current"));
    currentcumCols = columns.filter(c => c.toLowerCase().includes("amp hours"));

    // ===== INITIALIZE MAIN CHART (only on first load) =====
    if (!mainChart) {
      const ctx = document.getElementById("mainChart").getContext("2d");
      mainChart = new Chart(ctx, {
        type: "line",                                   // Line chart type
        data: { labels: [], datasets: [] },            // Initially empty
        options: {
          responsive: true,                            // Chart resizes with window
          maintainAspectRatio: false,                   // Allow custom height
          animation: { duration: 400, easing: "easeInOutQuart" },  // Smooth animations
          interaction: { mode: "index", intersect: false },        // Hover shows all values at X position
          elements: {
            point: { pointStyle: "rect", radius: 6, hoverRadius: 6 }
          },
          plugins: {
            // Legend configuration
            legend: {
              position: "right",                        // Place legend on the right
              labels: {
                font: { size: 15 },
                color: textColor,
                usePointStyle: true,                    // Use small point style in legend
                pointStyle: "rect",                     // Square legend markers
                pointStyleWidth: 16,
                generateLabels: function(chart) {
                  return chart.data.datasets.map((ds, i) => ({
                    text: ds.label,
                    fillStyle: ds.backgroundColor,
                    strokeStyle: ds.backgroundColor,
                    lineWidth: 0,
                    pointStyle: "rect",
                    fontColor: textColor,
                    hidden: !chart.isDatasetVisible(i),
                    datasetIndex: i
                  }));
                }
              }
            },
            tooltip: { enabled: true },                 // Show data on hover
            // Title configuration
            title: { 
              display: true, 
              text: "", 
              color: textColor, 
              font: { size: 20 }, 
              padding: { bottom: 30 } 
            }
          },
          layout: { padding: { bottom: 20 } },
          scales: {
            // X-axis configuration
            x: {
              title: { 
                display: true, 
                text: "Time",
                align: "center", 
                color: textColor, 
                font: { size: 20 } 
              },
              ticks: {
                color: textColor,
                autoSkip: false,                        // Show every tick
                // Custom callback to only display labels every 12 points (every hour)
                callback: function(value, index) {
                  if (index % 12 === 0) return this.getLabelForValue(value);
                  return "";
                }
              },
              grid: {}
            },
            // Y-axis configuration
            y: {
              min: 0,
              max: 1,
              ticks: { color: textColor },
              grid: { color: gridColor },
              title: { display: true, text: "", align: "center", color: textColor, font: { size: 20 } }
            }
          }
        }
      });
    }
    
    // ===== INITIALIZE GIVENERGY CHART (only on first load) =====
    if (!givenergyChart) {
      const ctx3 = document.getElementById("givenergyChart").getContext("2d");
      givenergyChart = new Chart(ctx3, {
        type: "line",                                   // Line chart type
        data: { labels: [], datasets: [] },            // Initially empty
        options: {
          responsive: true,                            // Chart resizes with window
          maintainAspectRatio: false,                   // Allow custom height
          animation: { duration: 400, easing: "easeInOutQuart" },  // Smooth animations
          interaction: { mode: "index", intersect: false },        // Hover shows all values at X position
          elements: { point: { pointStyle: "rect", radius: 6, hoverRadius: 6 } },
          plugins: {
            legend: { display: false },                 // No legend for single dataset
            tooltip: { enabled: true },                 // Show data on hover
            title: { display: true, text: "", color: textColor, font: { size: 20 }, padding: { bottom: 30 } }
          },
          layout: { padding: { bottom: 20 } },
          scales: {
            // X-axis configuration
            x: {
              title: { display: true, text: "Time", align: "center", color: textColor, font: { size: 20 } },
              ticks: {
                color: textColor,
                autoSkip: false,                        // Show every tick
                // Custom callback to only display labels every 4 points
                callback: function(value, index) {
                  if (index % 4 === 0) return this.getLabelForValue(value);
                  return "";
                }
              },
              grid: { color: isDark ? "#444" : "#ccc" }
            },
            // Y-axis configuration
            y: {
              min: 0,
              max: 1,
              ticks: { color: textColor },
              grid: { color: gridColor },
              title: { display: true, text: "Energy (kW)", align: "center", color: textColor, font: { size: 20 } }
            }
          }
        }
      });
    }
  
    // ===== INITIALIZE GIVENERGY TABS (only once) =====
    if (!window.givenergyTabsInitialised) {
      window.givenergyTabsInitialised = true;
      // Add click listeners to each GiveEnergy flow tab
      document.querySelectorAll("#givenergyTabs .tab").forEach(tab => {
        tab.addEventListener("click", () => {
          // Remove active class from all GiveEnergy tabs
          document.querySelectorAll("#givenergyTabs .tab").forEach(t => t.classList.remove("active"));
          // Add active class to clicked tab
          tab.classList.add("active");

          // Get the energy flow type from the tab's data attribute
          const flow = tab.dataset.flow;
          // Draw the appropriate GiveEnergy chart based on flow type
          if (flow === "pv-home")       drawGivenergyChart(givenergyData, "PV to Home",       "PV to Home");
          if (flow === "pv-battery")    drawGivenergyChart(givenergyData, "PV to Battery",    "PV to Battery");
          if (flow === "pv-grid")       drawGivenergyChart(givenergyData, "PV to Grid",       "PV to Grid");
          if (flow === "grid-home")     drawGivenergyChart(givenergyData, "Grid to Home",     "Grid to Home");
          if (flow === "grid-battery")  drawGivenergyChart(givenergyData, "Grid to Battery",  "Grid to Battery");
          if (flow === "battery-home")  drawGivenergyChart(givenergyData, "Battery to Home",  "Battery to Home");
          if (flow === "battery-grid")  drawGivenergyChart(givenergyData, "Battery to Grid",  "Battery to Grid");
        });
      });
    }
  
    // ===== DRAW DEFAULT GIVENERGY TAB =====
    // Draw the default GiveEnergy chart for the active tab on page load/refresh
    const activeGe = document.querySelector("#givenergyTabs .tab.active");
    console.log("activeGe:", activeGe);
    if (activeGe) {
      const flow = activeGe.dataset.flow;
      console.log("drawing givenergy flow:", flow);
      // Draw chart for the active flow type
      if (flow === "pv-home")       drawGivenergyChart(givenergyData, "PV to Home",      "PV to Home");
      if (flow === "pv-battery")    drawGivenergyChart(givenergyData, "PV to Battery",   "PV to Battery");
      if (flow === "pv-grid")       drawGivenergyChart(givenergyData, "PV to Grid",      "PV to Grid");
      if (flow === "grid-home")     drawGivenergyChart(givenergyData, "Grid to Home",    "Grid to Home");
      if (flow === "grid-battery")  drawGivenergyChart(givenergyData, "Grid to Battery", "Grid to Battery");
      if (flow === "battery-home")  drawGivenergyChart(givenergyData, "Battery to Home", "Battery to Home");
      if (flow === "battery-grid")  drawGivenergyChart(givenergyData, "Battery to Grid", "Battery to Grid");
    }
  
    // ===== INITIALIZE ENVIRONMENT & CURRENT TABS (only once) =====
    if (!window.tabsInitialised) {
      window.tabsInitialised = true;
      // Initialize all tab functionality
      initTabs();
    }
  
    // ===== DRAW DEFAULT CHART ON LOAD/REFRESH =====
    // Redraw the currently active tab to display updated data
    const activeMaster = document.querySelector("#masterTabs .tab.active");
    if (activeMaster && activeMaster.dataset.master === "current") {
      // If current tab is active, trigger the active current sub-tab
      const activeSub = document.querySelector("#currentTabs .tab.active");
      if (activeSub) activeSub.click();
    } else {
      // Otherwise, trigger the active environment sub-tab
      const activeSub = document.querySelector("#envTabs .tab.active");
      if (activeSub) activeSub.click();
    }

    // ===== HIDE LOADING INDICATORS =====
    // Hide spinners to indicate data loading is complete
    hideSpinner();
    hideGivenergySpinner();
  
    // Remove loading class from canvas elements
    canvas.classList.remove("loading");
    givenergyCanvas.classList.remove("loading");
  }

  // ===== INITIAL DATA LOAD =====
  // Load data when the page first loads
  loadData();
  
  // ===== AUTO-REFRESH =====
  // Refresh data every 10 minutes (600,000 milliseconds)
  setInterval(loadData, 10 * 60 * 1000);
  
  // ===== DARK MODE LISTENER =====
  // Listen for changes to dark/light mode preference
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    // Redraw all charts with the new color scheme when dark mode changes
    
    // Redraw the currently active GiveEnergy chart with new colors
    const activeGe = document.querySelector("#givenergyTabs .tab.active");
    if (activeGe) {
      const flow = activeGe.dataset.flow;
      if (flow === "pv-home")       drawGivenergyChart(givenergyData, "PV to Home",      "PV to Home");
      if (flow === "pv-battery")    drawGivenergyChart(givenergyData, "PV to Battery",   "PV to Battery");
      if (flow === "pv-grid")       drawGivenergyChart(givenergyData, "PV to Grid",      "PV to Grid");
      if (flow === "grid-home")     drawGivenergyChart(givenergyData, "Grid to Home",    "Grid to Home");
      if (flow === "grid-battery")  drawGivenergyChart(givenergyData, "Grid to Battery", "Grid to Battery");
      if (flow === "battery-home")  drawGivenergyChart(givenergyData, "Battery to Home", "Battery to Home");
      if (flow === "battery-grid")  drawGivenergyChart(givenergyData, "Battery to Grid", "Battery to Grid");
    }
    
    // Redraw the currently active main sensor chart with new colors
    const activeMaster = document.querySelector("#masterTabs .tab.active");
    if (activeMaster && activeMaster.dataset.master === "current") {
      // If current tab is active, trigger the active current sub-tab
      const activeSub = document.querySelector("#currentTabs .tab.active");
      if (activeSub) activeSub.click();
    } else {
      // Otherwise, trigger the active environment sub-tab
      const activeSub = document.querySelector("#envTabs .tab.active");
      if (activeSub) activeSub.click();
    }
  });

}); // end DOMContentLoaded
