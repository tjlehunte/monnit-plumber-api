document.addEventListener("DOMContentLoaded", () => {

  // ==================== CHART INSTANCES ====================
  let mainChart      = null;
  let givenergyChart = null;

  // ==================== COLUMN NAME ARRAYS ====================
  let tempCols = [], humCols = [], dewCols = [], gpkgCols = [];
  let heatindexCols = [], wetbulbCols = [], current3Cols = [], currentcumCols = [];

  // ==================== DATA ARRAYS ====================
  let allData      = [];
  let givenergyData = [];

  // ==================== STATE ====================
  // Which chart is currently active — controls legend controls + resize
  let activeChartType = "monnit"; // "monnit" | "givenergy"

  // ==================== HELPERS ====================
  const isMobile = () => window.innerWidth <= 768;

  function getActiveChart() {
    return activeChartType === "givenergy" ? givenergyChart : mainChart;
  }

  // ==================== SPINNERS ====================
  function showSpinner()          { document.getElementById("spinner").style.display = "block"; }
  function hideSpinner()          { document.getElementById("spinner").style.display = "none";  }
  function showGivenergySpinner() { document.getElementById("givenergySpinner").style.display = "block"; }
  function hideGivenergySpinner() { document.getElementById("givenergySpinner").style.display = "none";  }

  // ==================== COLORS ====================
  const ROOM_COLORS = [
    "#800000","#9A6324","#469990","#000075","#000000",
    "#e6194B","#f58231","#ffe119","#3cb44b","#42d4f4",
    "#f032e6","#dcbeff","#aaffc3","#911eb4","#a9a9a9","#ffd8b1"
  ];
  const CURRENT_METRIC_COLORS = {
    "Minimum current": "#00c8f0",
    "Maximum current": "#ff1a1a",
    "Average current": "#00cc44"
  };
  const roomColorMap = {};
  let roomColorIndex = 0;

  function getRoomColor(room) {
    if (!roomColorMap[room]) {
      roomColorMap[room] = ROOM_COLORS[roomColorIndex % ROOM_COLORS.length];
      roomColorIndex++;
    }
    return roomColorMap[room];
  }

  // ==================== SHOW / HIDE CHART AREAS ====================
  function showMonnitChart() {
    document.getElementById("monnitChartArea").style.display = "block";
    document.getElementById("givenergyChartArea").style.display = "none";
    document.getElementById("legendControls").style.display = "flex";
    activeChartType = "monnit";
    if (mainChart) setTimeout(() => mainChart.resize(), 50);
  }

  function showGivenergyChartCanvas() {
    document.getElementById("monnitChartArea").style.display = "none";
    document.getElementById("givenergyChartArea").style.display = "block";
    document.getElementById("legendControls").style.display = "none";
    activeChartType = "givenergy";
    if (givenergyChart) setTimeout(() => givenergyChart.resize(), 50);
  }

  // ==================== CUSTOM LEGEND (mobile) ====================
  function populateCustomLegend(chart) {
    const legend = document.getElementById("customLegend");
    if (!legend || !isMobile()) return;

    const COLLAPSE_AT = 6;
    const datasets = chart.data.datasets;

    const itemsHTML = datasets.map((ds, i) => {
      const visible = chart.isDatasetVisible(i);
      return `
        <label class="legend-item${visible ? "" : " legend-hidden"}" data-index="${i}">
          <input type="checkbox" class="legend-checkbox" data-index="${i}" ${visible ? "checked" : ""}>
          <span class="legend-swatch" style="background:${ds.backgroundColor};"></span>
          <span class="legend-label">${ds.label}</span>
        </label>`;
    }).join("");

    const needsCollapse = datasets.length > COLLAPSE_AT;

    legend.innerHTML = `
      <div class="legend-grid${needsCollapse ? " legend-collapsed" : ""}" id="legendGrid">
        ${itemsHTML}
      </div>
      ${needsCollapse ? `
        <button class="legend-toggle" id="legendToggle">
          Show ${datasets.length} sensors &#9660;
        </button>` : ""}
    `;

    // Collapse toggle
    if (needsCollapse) {
      document.getElementById("legendToggle").addEventListener("click", () => {
        const grid    = document.getElementById("legendGrid");
        const btn     = document.getElementById("legendToggle");
        const collapsed = grid.classList.toggle("legend-collapsed");
        btn.innerHTML = collapsed
          ? `Show ${datasets.length} sensors &#9660;`
          : `Hide sensors &#9650;`;
      });
    }

    // Checkbox (label click) toggle dataset visibility
    legend.querySelectorAll(".legend-item").forEach(item => {
      item.addEventListener("click", () => {
        const idx = parseInt(item.dataset.index);
        const cb  = item.querySelector(".legend-checkbox");
        const nowVisible = !chart.isDatasetVisible(idx);
        chart.setDatasetVisibility(idx, nowVisible);
        chart.update();
        cb.checked = nowVisible;
        if (nowVisible) item.classList.remove("legend-hidden");
        else            item.classList.add("legend-hidden");
      });
    });
  }

  // ==================== DRAW MONNIT CHART ====================
  function drawChart(data, cols, title, unit, isCurrentChart = false) {
    const labels = data.map(d => d.MessageDate);
    const isDark  = window.matchMedia("(prefers-color-scheme: dark)").matches;

    const gridColors = labels.map((_, i) =>
      (i % 12 === 0) ? (isDark ? "#444" : "#ccc") : (isDark ? "#2a2a2a" : "#ebebeb")
    );

    const datasets = cols.map(col => {
      const parts = col.split(" - ");
      const label = isCurrentChart ? parts[1] : parts[0];
      const color = isCurrentChart ? CURRENT_METRIC_COLORS[parts[1]] : getRoomColor(parts[0]);
      return {
        label, data: data.map(d => d[col]),
        borderColor: color, backgroundColor: color,
        pointStyle: "rect", borderWidth: 1,
        pointRadius: 1, pointHoverRadius: 8,
        tension: 0.2, fill: false
      };
    });

    const allValues  = datasets.flatMap(ds => ds.data).map(Number).filter(Number.isFinite);
    const roundedMax = Math.ceil(Math.max(...allValues) / 5) * 5;
    const roundedMin = Math.floor(Math.min(...allValues) / 5) * 5;
    const textColor  = isDark ? "#ddd" : "#000";
    const gridColor  = isDark ? "#444" : "#ccc";

    mainChart.data.labels   = labels;
    mainChart.data.datasets = datasets;
    mainChart.options.plugins.title.text         = title;
    mainChart.options.plugins.title.color        = textColor;
    mainChart.options.scales.y.title.text        = unit;
    mainChart.options.scales.y.min               = roundedMin;
    mainChart.options.scales.y.max               = roundedMax;
    mainChart.options.scales.x.ticks.color       = textColor;
    mainChart.options.scales.y.ticks.color       = textColor;
    mainChart.options.scales.x.title.color       = textColor;
    mainChart.options.scales.y.title.color       = textColor;
    mainChart.options.scales.x.grid.color        = gridColors;
    mainChart.options.scales.y.grid.color        = gridColor;
    mainChart.options.plugins.legend.labels.color = textColor;
    mainChart.options.plugins.legend.labels.generateLabels = chart =>
      chart.data.datasets.map((ds, i) => ({
        text: ds.label, fillStyle: ds.backgroundColor,
        strokeStyle: ds.backgroundColor, lineWidth: 0,
        pointStyle: "rect", fontColor: textColor,
        hidden: !chart.isDatasetVisible(i), datasetIndex: i
      }));
    mainChart.update();

    populateCustomLegend(mainChart);
  }

  // ==================== DRAW GIVENERGY CHART ====================
  function drawGivenergyChart(data, flowCol, title) {
    const isDark    = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const textColor = isDark ? "#ddd" : "#000";
    const gridColor = isDark ? "#444" : "#ccc";
    const labels    = data.map(d => d.start);

    const gridColors = labels.map((_, i) =>
      (i % 4 === 0) ? (isDark ? "#444" : "#ccc") : (isDark ? "#2a2a2a" : "#ebebeb")
    );

    const dataset = {
      label: title, data: data.map(d => d[flowCol]),
      borderColor: "#3498db", backgroundColor: "#3498db",
      pointStyle: "rect", borderWidth: 1,
      pointRadius: 1, pointHoverRadius: 8,
      tension: 0.2, fill: false
    };

    const allValues  = dataset.data.map(Number).filter(Number.isFinite);
    const roundedMax = Math.ceil(Math.max(...allValues) / 5) * 5;
    const roundedMin = Math.floor(Math.min(...allValues) / 5) * 5;
    const yMax       = roundedMax === roundedMin ? roundedMin + 5 : roundedMax;

    givenergyChart.data.labels   = labels;
    givenergyChart.data.datasets = [dataset];
    givenergyChart.options.plugins.title.text         = title;
    givenergyChart.options.plugins.title.color        = textColor;
    givenergyChart.options.scales.y.min               = roundedMin;
    givenergyChart.options.scales.y.max               = yMax;
    givenergyChart.options.scales.x.ticks.color       = textColor;
    givenergyChart.options.scales.y.ticks.color       = textColor;
    givenergyChart.options.scales.x.title.color       = textColor;
    givenergyChart.options.scales.y.title.color       = textColor;
    givenergyChart.options.scales.x.grid.color        = gridColors;
    givenergyChart.options.scales.y.grid.color        = gridColor;
    givenergyChart.options.plugins.legend.labels.color = textColor;
    givenergyChart.update();

    populateCustomLegend(givenergyChart);
  }

  // ==================== TABS ====================
  function initTabs() {

    // --- Master tabs ---
    document.querySelectorAll("#masterTabs .tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll("#masterTabs .tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        const master = tab.dataset.master;

        if (master === "environment") {
          document.getElementById("envTabs").style.display        = "flex";
          document.getElementById("currentTabs").style.display    = "none";
          document.getElementById("givenergyTabs").style.display  = "none";
          showMonnitChart();
          document.querySelector("#envTabs .tab.active")?.click();
        }

        if (master === "current") {
          document.getElementById("envTabs").style.display        = "none";
          document.getElementById("currentTabs").style.display    = "flex";
          document.getElementById("givenergyTabs").style.display  = "none";
          showMonnitChart();
          document.querySelector("#currentTabs .tab.active")?.click();
        }

        if (master === "givenergy") {
          document.getElementById("envTabs").style.display        = "none";
          document.getElementById("currentTabs").style.display    = "none";
          document.getElementById("givenergyTabs").style.display  = "flex";
          showGivenergyChartCanvas();
          document.querySelector("#givenergyTabs .tab.active")?.click();
        }
      });
    });

    // --- Environment sub-tabs ---
    document.querySelectorAll("#envTabs .tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll("#envTabs .tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        const type = tab.dataset.type;
        if (type === "temperature") drawChart(allData, tempCols,      "Temperature Sensors",          "Temperature (°C)");
        if (type === "humidity")    drawChart(allData, humCols,       "Humidity Sensors",             "Humidity (%)");
        if (type === "dewpoint")    drawChart(allData, dewCols,       "Dew Point Sensors",            "Dew Point (°C)");
        if (type === "gpkg")        drawChart(allData, gpkgCols,      "Grams per Kilogram Sensors",   "Grams per Kilogram (g/kg)");
        if (type === "heatindex")   drawChart(allData, heatindexCols, "Heat Index Sensors",           "Heat Index (°C)");
        if (type === "wetbulb")     drawChart(allData, wetbulbCols,   "Wet-Bulb Temperature Sensors", "Wet Bulb (°C)");
      });
    });

    // --- Current sub-tabs ---
    document.querySelectorAll("#currentTabs .tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll("#currentTabs .tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        const type = tab.dataset.type;
        if (type === "current-summary")    drawChart(allData, current3Cols,   "Current (Min / Max / Avg)", "Current (A)",    true);
        if (type === "current-cumulative") drawChart(allData, currentcumCols, "Cumulative Current (Ah)",   "Amp-Hours (Ah)", true);
      });
    });

    // --- GivEnergy sub-tabs ---
    document.querySelectorAll("#givenergyTabs .tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll("#givenergyTabs .tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        const flow = tab.dataset.flow;
        if (flow === "pv-home")      drawGivenergyChart(givenergyData, "PV to Home",      "PV to Home");
        if (flow === "pv-battery")   drawGivenergyChart(givenergyData, "PV to Battery",   "PV to Battery");
        if (flow === "pv-grid")      drawGivenergyChart(givenergyData, "PV to Grid",      "PV to Grid");
        if (flow === "grid-home")    drawGivenergyChart(givenergyData, "Grid to Home",    "Grid to Home");
        if (flow === "grid-battery") drawGivenergyChart(givenergyData, "Grid to Battery", "Grid to Battery");
        if (flow === "battery-home") drawGivenergyChart(givenergyData, "Battery to Home", "Battery to Home");
        if (flow === "battery-grid") drawGivenergyChart(givenergyData, "Battery to Grid", "Battery to Grid");
      });
    });
  }

  // ==================== LEGEND CONTROL BUTTONS ====================
  document.getElementById("hideAllBtn").onclick = () => {
    const chart = getActiveChart();
    chart.data.datasets.forEach((_, i) => chart.setDatasetVisibility(i, false));
    chart.update();
    populateCustomLegend(chart);
  };

  document.getElementById("showAllBtn").onclick = () => {
    const chart = getActiveChart();
    chart.data.datasets.forEach((_, i) => chart.setDatasetVisibility(i, true));
    chart.update();
    populateCustomLegend(chart);
  };

  document.getElementById("invertBtn").onclick = () => {
    const chart = getActiveChart();
    chart.data.datasets.forEach((_, i) => chart.setDatasetVisibility(i, !chart.isDatasetVisible(i)));
    chart.update();
    populateCustomLegend(chart);
  };

  // ==================== SCROLL ARROWS ====================
  function initScrollArrows() {
    const wrapper      = document.getElementById("chartScrollWrapper");
    const SCROLL_STEP  = 220;
    document.getElementById("scrollLeft").addEventListener("click",  () => wrapper.scrollBy({ left: -SCROLL_STEP, behavior: "smooth" }));
    document.getElementById("scrollRight").addEventListener("click", () => wrapper.scrollBy({ left:  SCROLL_STEP, behavior: "smooth" }));
  }

  // ==================== FOOTER ====================
  function updateFooter() {
    const el = document.getElementById("lastUpdated");
    if (!el) return;
    const latest = allData.length ? allData[allData.length - 1].MessageDate : null;
    if (latest) el.textContent = `Last updated: ${latest}`;
  }

  // ==================== FETCH WITH RETRY ====================
  async function fetchWithRetry(url, retries = 3, delay = 5000) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url);
        if (response.ok) return await response.json();
      } catch (e) {
        if (i < retries - 1) await new Promise(r => setTimeout(r, delay));
      }
    }
    throw new Error("Failed to fetch after 3 retries");
  }

  // ==================== LOAD DATA ====================
  async function loadData() {
    const canvas          = document.getElementById("mainChart");
    const givenergyCanvas = document.getElementById("givenergyChart");
    canvas.classList.add("loading");
    givenergyCanvas.classList.add("loading");
    showSpinner();
    showGivenergySpinner();

    allData       = await fetchWithRetry("https://monnit-plumber-api.onrender.com/data");
    givenergyData = await fetchWithRetry("https://monnit-plumber-api.onrender.com/givenergy");

    const isDark      = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const gridColor   = isDark ? "#444" : "#ccc";
    const textColor   = isDark ? "#ddd" : "#000";
    const showLegend  = !isMobile(); // Desktop: use Chart.js legend; Mobile: use custom legend

    // Organise columns
    const columns   = Object.keys(allData[0]);
    tempCols        = columns.filter(c => c.toLowerCase().includes("temp"));
    humCols         = columns.filter(c => c.toLowerCase().includes("humid"));
    dewCols         = columns.filter(c => c.toLowerCase().includes("dewpoint"));
    gpkgCols        = columns.filter(c => c.toLowerCase().includes("gpkg"));
    heatindexCols   = columns.filter(c => c.toLowerCase().includes("heat index"));
    wetbulbCols     = columns.filter(c => c.toLowerCase().includes("wet bulb"));
    current3Cols    = columns.filter(c =>
      c.toLowerCase().includes("average current") ||
      c.toLowerCase().includes("maximum current") ||
      c.toLowerCase().includes("minimum current"));
    currentcumCols  = columns.filter(c => c.toLowerCase().includes("amp hours"));

    // ---- Init main chart ----
    if (!mainChart) {
      const ctx = canvas.getContext("2d");
      mainChart = new Chart(ctx, {
        type: "line",
        data: { labels: [], datasets: [] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 400, easing: "easeInOutQuart" },
          interaction: { mode: "index", intersect: false },
          elements: { point: { pointStyle: "rect", radius: 6, hoverRadius: 6 } },
          plugins: {
            legend: {
              display: showLegend,
              position: "right",
              labels: {
                font: { size: 15 }, color: textColor,
                usePointStyle: true, pointStyle: "rect", pointStyleWidth: 16,
                generateLabels: chart => chart.data.datasets.map((ds, i) => ({
                  text: ds.label, fillStyle: ds.backgroundColor,
                  strokeStyle: ds.backgroundColor, lineWidth: 0,
                  pointStyle: "rect", fontColor: textColor,
                  hidden: !chart.isDatasetVisible(i), datasetIndex: i
                }))
              }
            },
            tooltip: { enabled: true },
            title: { display: true, text: "", color: textColor, font: { size: 20 }, padding: { bottom: 30 } }
          },
          layout: { padding: { bottom: 20 } },
          scales: {
            x: {
              title: { display: true, text: "Time", align: "center", color: textColor, font: { size: 20 } },
              ticks: {
                color: textColor, autoSkip: false,
                callback: function(value, index) {
                  return (index % 12 === 0) ? this.getLabelForValue(value) : "";
                }
              },
              grid: {}
            },
            y: {
              min: 0, max: 1,
              ticks: { color: textColor },
              grid:  { color: gridColor },
              title: { display: true, text: "", align: "center", color: textColor, font: { size: 20 } }
            }
          }
        }
      });
    }

    // ---- Init GivEnergy chart ----
    if (!givenergyChart) {
      const ctx3 = givenergyCanvas.getContext("2d");
      givenergyChart = new Chart(ctx3, {
        type: "line",
        data: { labels: [], datasets: [] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 400, easing: "easeInOutQuart" },
          interaction: { mode: "index", intersect: false },
          elements: { point: { pointStyle: "rect", radius: 6, hoverRadius: 6 } },
          plugins: {
            legend: { display: false, labels: { color: textColor } },
            tooltip: { enabled: true },
            title: { display: true, text: "", color: textColor, font: { size: 20 }, padding: { bottom: 30 } }
          },
          layout: { padding: { bottom: 20 } },
          scales: {
            x: {
              title: { display: true, text: "Time", align: "center", color: textColor, font: { size: 20 } },
              ticks: {
                color: textColor, autoSkip: false,
                callback: function(value, index) {
                  return (index % 4 === 0) ? this.getLabelForValue(value) : "";
                }
              },
              grid: { color: isDark ? "#444" : "#ccc" }
            },
            y: {
              min: 0, max: 1,
              ticks: { color: textColor },
              grid:  { color: gridColor },
              title: { display: true, text: "Energy (kW)", align: "center", color: textColor, font: { size: 20 } }
            }
          }
        }
      });
    }

    // ---- One-time init ----
    if (!window.tabsInitialised) {
      window.tabsInitialised = true;
      initTabs();
      initScrollArrows();
    }

    // ---- Redraw active tab ----
    const activeMaster = document.querySelector("#masterTabs .tab.active");
    if (activeMaster) {
      const master = activeMaster.dataset.master;
      if (master === "givenergy") {
        document.querySelector("#givenergyTabs .tab.active")?.click();
      } else if (master === "current") {
        document.querySelector("#currentTabs .tab.active")?.click();
      } else {
        document.querySelector("#envTabs .tab.active")?.click();
      }
    }

    updateFooter();

    hideSpinner();
    hideGivenergySpinner();
    canvas.classList.remove("loading");
    givenergyCanvas.classList.remove("loading");
  }

  // ==================== DARK MODE LISTENER ====================
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const activeMaster = document.querySelector("#masterTabs .tab.active");
    if (!activeMaster) return;
    const master = activeMaster.dataset.master;
    if (master === "givenergy") {
      document.querySelector("#givenergyTabs .tab.active")?.click();
    } else if (master === "current") {
      document.querySelector("#currentTabs .tab.active")?.click();
    } else {
      document.querySelector("#envTabs .tab.active")?.click();
    }
  });

  // ==================== START ====================
  loadData();
  setInterval(loadData, 10 * 60 * 1000);

}); // end DOMContentLoaded
