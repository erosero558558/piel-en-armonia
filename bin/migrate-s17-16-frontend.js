const fs = require('fs');
const path = require('path');

const targetFilePath = path.join(__dirname, '../src/apps/queue-shared/turnero-admin-clinic-onboarding-console.js');
let content = fs.readFileSync(targetFilePath, 'utf8');

// 1. Remove localStorage methods
// Regex: from 'function getStorage(storage) {' to the ending '}' before 'function cloneRows'
content = content.replace(/function getStorage\(storage\) \{[\s\S]*?return null;\n\}/, '');
content = content.replace(/function loadPersistedState\(storage, fallbackState\) \{[\s\S]*?return fallbackState;\n    \}\n\}/, '');
content = content.replace(/function persistState\(storage, state\) \{[\s\S]*?\/\/ best effort only\n    \}\n\}/, '');
content = content.replace(/function clearPersistedState\(storage\) \{[\s\S]*?\/\/ best effort only\n    \}\n\}/, '');
content = content.replace(/const STORAGE_KEY = 'turnero-admin-clinic-onboarding-console\/v1';\n/, '');

// 2. Add API sync methods before cloneRows
const apiMethods = `
async function fetchBackendState(clinicId) {
    try {
        const res = await fetch(\`/api.php?resource=onboarding-status&clinic_id=\${encodeURIComponent(clinicId)}\`);
        if (!res.ok) return null;
        const json = await res.json();
        return json.data || null;
    } catch (e) {
        return null;
    }
}

async function submitStep(clinicId, stepId, payload) {
    try {
        const res = await fetch('/api.php?resource=onboarding-step', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clinic_id: clinicId, step_id: stepId, status: 'done', payload })
        });
        if (!res.ok) return null;
        const json = await res.json();
        return json.data || null;
    } catch (e) {
        return null;
    }
}
`;
content = content.replace(/function cloneRows\(/, apiMethods + '\nfunction cloneRows(');

// 3. Inject Banner HTML in renderConsoleHtml
const bannerHtml = `
    const p = state.backendProgress;
    let progressHtml = '';
    if (p) {
        progressHtml = \`
        <div style="background: rgb(240 253 244 / 90%); border: 1px solid rgb(22 163 74 / 30%); padding: 1rem; border-radius: 12px; margin-bottom: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="color: #166534; font-size: 1.1rem;">🚀 Progreso Onboarding: \${escapeHtml(String(p.percent))}%\</strong>
                    <p style="margin: 0; font-size: 0.85rem; color: #166534;">\${escapeHtml(p.nextActionLabel || 'Completado')}</p>
                </div>
                \${p.blockers && p.blockers.length > 0 ? \`<span style="color: #9f1239; font-size: 0.85rem; font-weight: 500;">Blockers: \${escapeHtml(String(p.blockers.length))}</span>\` : ''}
            </div>
            <div style="width: 100%; height: 6px; background: #dcfce7; border-radius: 3px; margin-top: 0.6rem; overflow: hidden;">
                <div style="width: \${escapeHtml(String(p.percent))}%; height: 100%; background: #16a34a; transition: width 0.3s ease;"></div>
            </div>
        </div>\`;
    }
`;
content = content.replace(/const urls = toArray\(state\.pack\?\.urls\);/, 'const urls = toArray(state.pack?.urls);\n' + bannerHtml);
content = content.replace(/<section class="turnero-admin-clinic-onboarding-console" data-role="console"/, '${progressHtml}\n        <section class="turnero-admin-clinic-onboarding-console" data-role="console"');

// 4. Update mountTurneroAdminClinicOnboardingConsole
const mountReplacement = `
    const clinicId = options.clinicId || 'default';
    const baseState = {
        clinicDraft: getDefaultTurneroClinicOnboardingDraft(options),
        staffRows: cloneRows(options.staffRows || options.staff || []),
        serviceRows: cloneRows(options.serviceRows || options.services || []),
        backendProgress: null
    };
    const state = baseState;
`;
content = content.replace(/const storage = getStorage\(options\.storage\);\s*const baseState = {[\s\S]*?};\s*const state = loadPersistedState\(storage, baseState\);/, mountReplacement);

content = content.replace(/        persistState\(storage, state\);\n/, '');

// 5. Update actions
const handleActionUpdate = `
    async function handleAction(action) {
        switch (action) {
            case 'save-clinic': {
                state.clinicDraft = getClinicDraftFromForm(host, state.clinicDraft);
                const ret = await submitStep(clinicId, 'basic_config', { clinicDraft: state.clinicDraft });
                if (ret && ret.progress) state.backendProgress = ret.progress;
                render();
                break;
            }
            case 'add-staff': {
                const row = getStaffRowFromForm(host);
                if (!row.name) {
                    return;
                }
                state.staffRows = [...state.staffRows, row];
                const ret = await submitStep(clinicId, 'staff', { staffRows: state.staffRows });
                if (ret && ret.progress) state.backendProgress = ret.progress;
                render();
                clearFormFields(host, ['[data-field="staff-name"]']);
                break;
            }
            case 'add-service': {
                const row = getServiceRowFromForm(host);
                if (!row.label) {
                    return;
                }
                state.serviceRows = [...state.serviceRows, row];
                const ret = await submitStep(clinicId, 'services', { serviceRows: state.serviceRows });
                if (ret && ret.progress) state.backendProgress = ret.progress;
                render();
                clearFormFields(host, ['[data-field="service-label"]']);
                const durationField = host.querySelector(
                    '[data-field="service-duration"]'
                );
                if (durationField) {
                    durationField.value = '30';
                }
                break;
            }
            case 'copy-brief':
                await copyToClipboardSafe(state.pack?.brief || '');
                break;
            case 'download-json':
                downloadJsonSnapshot(
                    \`turnero-clinic-onboarding-\${toString(
                        state.pack?.turneroClinicProfile?.clinic_id,
                        'clinica-demo'
                    )}.json\`,
                    state.pack
                );
                break;
            case 'reset-console':
                state.clinicDraft = getDefaultTurneroClinicOnboardingDraft(options);
                state.staffRows = cloneRows(options.staffRows || options.staff || []);
                state.serviceRows = cloneRows(
                    options.serviceRows || options.services || []
                );
                render();
                break;
            default:
                break;
        }
    }
`;
content = content.replace(/async function handleAction\(action\) \{[\s\S]*?\}\s*\}\n\n    host\.onclick/, handleActionUpdate.trim() + '\n\n    host.onclick');

// 6. Init fetching
const initAndRender = `
    const model = {
        host,
        state,
        render,
        handleAction,
    };

    host.innerHTML = '<div style="padding: 2rem; color: #666;">Cargando wizard de onboarding...</div>';

    fetchBackendState(clinicId).then(data => {
        if (data) {
            state.backendProgress = data.progress;
            const steps = data.progress?.steps || [];
            steps.forEach(s => {
                if (s.id === 'basic_config' && s.payload?.clinicDraft) {
                    state.clinicDraft = { ...state.clinicDraft, ...s.payload.clinicDraft };
                }
                if (s.id === 'staff' && s.payload?.staffRows) {
                    state.staffRows = s.payload.staffRows;
                }
                if (s.id === 'services' && s.payload?.serviceRows) {
                    state.serviceRows = s.payload.serviceRows;
                }
            });
        }
        render();
    });

    return model;
`;
// Carefully replace the end
content = content.replace(/    const model = \{[\s\S]*?render\(\);\n    return model;\n/m, initAndRender);

fs.writeFileSync(targetFilePath, content, 'utf8');
console.log('Migrated frontend wizard v2.');
