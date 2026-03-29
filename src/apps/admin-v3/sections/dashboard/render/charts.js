let waitTimeChartInstance = null;
let throughputChartInstance = null;

export function renderDashboardCharts(queueAssistant) {
    if (!window.Chart) {
        return;
    }

    const waitTimeCtx = document.getElementById('waitTimeChart');
    const throughputCtx = document.getElementById('throughputChart');

    if (!waitTimeCtx || !throughputCtx) {
        return;
    }

    const today = queueAssistant?.today || {};
    const avgQueueWaitMs = Number(today.avgQueueWaitMs || 0);

    const hourlyThroughput = today.hourlyThroughput || [];
    const sortedThroughput = [...hourlyThroughput].sort((a, b) => {
        const hA = parseInt(a.label, 10) || 0;
        const hB = parseInt(b.label, 10) || 0;
        return hA - hB;
    });

    const throughputLabels = sortedThroughput.map(item => `${item.label}:00`);
    const throughputData = sortedThroughput.map(item => item.count);

    if (throughputChartInstance) {
        throughputChartInstance.destroy();
    }
    if (waitTimeChartInstance) {
        waitTimeChartInstance.destroy();
    }

    const avgWaitMin = (avgQueueWaitMs / 60000).toFixed(1);

    waitTimeChartInstance = new window.Chart(waitTimeCtx, {
        type: 'bar',
        data: {
            labels: ['Hoy (Promedio)'],
            datasets: [{
                label: 'Espera Promedio (min)',
                data: [avgWaitMin],
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgb(54, 162, 235)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    throughputChartInstance = new window.Chart(throughputCtx, {
        type: 'line',
        data: {
            labels: throughputLabels.length > 0 ? throughputLabels : ['Sin datos'],
            datasets: [{
                label: 'Turnos Completados',
                data: throughputData.length > 0 ? throughputData : [0],
                fill: true,
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}
