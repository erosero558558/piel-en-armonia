import { toArray, toText } from './turnero-release-control-center.js';
import { formatDateTime } from '../admin-v3/shared/ui/render.js';

function formatCasefileRow(row) {
    return `${toText(row.key, row.label || 'Item')} · ${toText(
        row.state,
        'open'
    )} · ${toText(row.consensusVerdict, 'pending')} · ${Number(
        row.blockerCount || 0
    )} blockers`;
}

function formatRiskRow(row) {
    return `${toText(row.kind, 'Risk')} · ${toText(row.severity, 'medium')} · ${toText(
        row.state,
        'low'
    )} · ${Number(row.residual || 0)}`;
}

function formatDisagreementRow(row) {
    return `${toText(row.reviewer, 'reviewer')} · ${toText(row.key, 'n/a')} · ${toText(
        row.severity,
        'medium'
    )} · ${toText(row.status, 'open')}`;
}

export function buildTurneroReleaseFinalVerdictDossier(pack = {}) {
    const casefileRows = toArray(pack.casefile?.rows || pack.casefileRows);
    const riskRows = toArray(pack.riskResidual?.rows || pack.riskRows);
    const consensusRows = toArray(pack.consensus || pack.consensusRows);
    const disagreements = toArray(pack.disagreements || pack.disagreementRows);
    const openDisagreements = disagreements.filter((item) => {
        const status = toText(item.status || item.state, 'open')
            .trim()
            .toLowerCase();
        return status !== 'closed';
    });
    const generatedAt = pack.generatedAt || new Date().toISOString();

    const lines = [
        '# Repo Diagnosis Verdict Dossier',
        '',
        `Scope: ${toText(pack.scope, 'global')}`,
        `Region: ${toText(pack.region, 'regional')}`,
        `Clinic: ${toText(
            pack.clinicLabel || pack.clinicShortName || pack.clinicId,
            'n/a'
        )}`,
        `Dossier score: ${pack.dossierScore?.score ?? 0} (${
            pack.dossierScore?.band || 'n/a'
        })`,
        `Decision: ${pack.dossierScore?.decision || 'review'}`,
        `Casefile closed: ${pack.casefile?.summary?.closed ?? 0}/${
            pack.casefile?.summary?.all ?? 0
        }`,
        `Consensus entries: ${consensusRows.length}`,
        `Residual elevated risks: ${pack.riskResidual?.summary?.elevated ?? 0}`,
        `Open disagreements: ${openDisagreements.length}`,
    ];

    if (casefileRows.length > 0) {
        lines.push('', '## Casefile');
        lines.push(
            ...casefileRows
                .slice(0, 4)
                .map((row) => `- ${formatCasefileRow(row)}`)
        );
    }

    if (riskRows.length > 0) {
        lines.push('', '## Residual risk');
        lines.push(
            ...riskRows.slice(0, 4).map((row) => `- ${formatRiskRow(row)}`)
        );
    }

    lines.push('', '## Disagreements');
    if (openDisagreements.length > 0) {
        lines.push(
            ...openDisagreements
                .slice(0, 4)
                .map((row) => `- ${formatDisagreementRow(row)}`)
        );
    } else {
        lines.push('- No open disagreements.');
    }

    lines.push('', `Generated at: ${formatDateTime(generatedAt)}`);

    return {
        markdown: lines.join('\n'),
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroReleaseFinalVerdictDossier;
