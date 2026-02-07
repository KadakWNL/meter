import { getCurrentTheme } from "./utils/theme.js";
import { formatTime } from "./utils/dateUtils.js";

export interface DomainTimeData {
  [domain: string]: number;
}

// declare Chart.js as a global (loaded from CDN in HTML)
declare const Chart: any;

// keep track of the chart instance
let timeChart: any = null;

// chart colors (orange theme)
const chartColors = [
  "#ff6b35", "#f7931e", "#fdc500", "#4ecdc4", "#44a8e5",
  "#8e5ea2", "#3cba54", "#e74c3c", "#95a5a6", "#34495e"
];

// create or update the chart with new data
export function renderChart(dayData: DomainTimeData) {
  const canvas = document.getElementById("time-chart") as HTMLCanvasElement;
  if (!canvas) return;

  // make sure Chart.js is loaded
  if (typeof Chart === 'undefined') {
    console.error('Chart.js not loaded');
    return;
  }

  const allDomains = Object.entries(dayData)
    .sort(([, timeA], [, timeB]) => timeB - timeA);

  if (allDomains.length === 0) {
    // destroy chart if no data
    if (timeChart) {
      timeChart.destroy();
      timeChart = null;
    }
    return;
  }

  // show top 5 domains + merge rest into "Others"
  const top5 = allDomains.slice(0, 5);
  const rest = allDomains.slice(5);
  
  const labels = top5.map(([domain]) => domain);
  const data = top5.map(([, seconds]) => seconds);
  
  // add "Others" category if there are more than 5 domains
  if (rest.length > 0) {
    const othersTotal = rest.reduce((sum, [, seconds]) => sum + seconds, 0);
    labels.push("Others");
    data.push(othersTotal);
  }

  // get theme colors
  const isDark = getCurrentTheme() === "dark";

  if (timeChart) {
    // update existing chart
    timeChart.data.labels = labels;
    timeChart.data.datasets[0].data = data;
    timeChart.data.datasets[0].borderColor = isDark ? "#1e1e1e" : "#f5f5f5";
    timeChart.update();
  } else {
    // create new chart
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    timeChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: chartColors,
          borderWidth: 3,
          borderColor: isDark ? "#1e1e1e" : "#f5f5f5",
          spacing: 1,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: "78%", // makes it thinner
        plugins: {
          legend: {
            display: false // no legend, we have the list below
          },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const label = context.label || "";
                const value = context.parsed || 0;
                return `${label}: ${formatTime(value)}`;
              }
            }
          }
        }
      }
    });
  }
}
