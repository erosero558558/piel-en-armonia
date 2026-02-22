import { apiRequest } from './api.js';
import { showToast } from './ui.js';

let currentFeatures = {};

export async function loadFeatures() {
    try {
        const response = await apiRequest('admin-features');
        if (response.ok && response.data) {
            currentFeatures = response.data;
            renderFeatures(currentFeatures);
        }
    } catch (error) {
        showToast(`Error cargando features: ${error.message}`, 'error');
    }
}

function renderFeatures(features) {
    const tbody = document.getElementById('featuresTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    const sortedKeys = Object.keys(features).sort();

    if (sortedKeys.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-message">No hay features configurados</td></tr>';
        return;
    }

    sortedKeys.forEach(flag => {
        const config = features[flag];
        const tr = document.createElement('tr');

        // Flag Name
        const tdName = document.createElement('td');
        tdName.innerHTML = `<code>${flag}</code>`;
        tr.appendChild(tdName);

        // Status Toggle
        const tdStatus = document.createElement('td');
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.gap = '8px';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = config.enabled;
        input.style.width = 'auto'; // Override global input width if any
        input.onchange = () => updateStatus(flag, input.checked);

        const span = document.createElement('span');
        span.className = 'status-badge ' + (config.enabled ? 'status-confirmed' : 'status-cancelled');
        span.textContent = config.enabled ? 'Activado' : 'Desactivado';

        // Update badge on change immediately for visual feedback
        input.addEventListener('change', () => {
             span.className = 'status-badge ' + (input.checked ? 'status-confirmed' : 'status-cancelled');
             span.textContent = input.checked ? 'Activado' : 'Desactivado';
        });

        container.appendChild(input);
        container.appendChild(span);
        tdStatus.appendChild(container);
        tr.appendChild(tdStatus);

        // Percentage Input
        const tdPercentage = document.createElement('td');
        const percentageInput = document.createElement('input');
        percentageInput.type = 'number';
        percentageInput.min = 0;
        percentageInput.max = 100;
        percentageInput.value = config.percentage;
        percentageInput.style.width = '70px';
        percentageInput.style.padding = '6px';
        percentageInput.style.borderRadius = '6px';
        percentageInput.style.border = '1px solid #ccc';

        percentageInput.onchange = () => updatePercentage(flag, percentageInput.value);

        tdPercentage.appendChild(percentageInput);
        tdPercentage.appendChild(document.createTextNode(' %'));
        tr.appendChild(tdPercentage);

        // Actions
        const tdActions = document.createElement('td');
        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn-icon success';
        saveBtn.innerHTML = '<i class="fas fa-save"></i>';
        saveBtn.title = 'Guardar';
        saveBtn.onclick = () => saveFeature(flag, {
            enabled: input.checked,
            percentage: Number(percentageInput.value)
        });

        tdActions.appendChild(saveBtn);
        tr.appendChild(tdActions);

        tbody.appendChild(tr);
    });
}

async function updateStatus(flag, enabled) {
    const config = currentFeatures[flag] || {};
    config.enabled = enabled;
    await saveFeature(flag, config);
}

async function updatePercentage(flag, value) {
    const config = currentFeatures[flag] || {};
    config.percentage = Math.max(0, Math.min(100, Number(value)));
    await saveFeature(flag, config);
}

async function saveFeature(flag, config) {
    try {
        const payload = {
            flag: flag,
            enabled: config.enabled,
            percentage: config.percentage
        };

        const response = await apiRequest('admin-features', {
            method: 'POST',
            body: payload
        });

        if (response.ok) {
            showToast(`Feature ${flag} actualizado`, 'success');
            // Update local state from response to be sure
            if (response.data && response.data[flag]) {
                currentFeatures[flag] = response.data[flag];
            }
        }
    } catch (error) {
        showToast(`Error guardando feature: ${error.message}`, 'error');
        await loadFeatures(); // Reload to restore correct state
    }
}
