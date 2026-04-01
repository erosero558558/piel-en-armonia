const fs = require('fs');
const parser = require('@babel/parser');

const code = fs.readFileSync('src/apps/admin-v3/sections/clinical-history/render/index.js', 'utf8');

const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx']
});

const functions = {};
ast.program.body.forEach(node => {
    if (node.type === 'FunctionDeclaration') {
        functions[node.id.name] = { start: node.start, end: node.end, isExported: false };
    } else if (node.type === 'ExportNamedDeclaration' && node.declaration && node.declaration.type === 'FunctionDeclaration') {
        functions[node.declaration.id.name] = { start: node.declaration.start, end: node.declaration.end, isExported: true, nodeStart: node.start };
    }
});

const photos = [
  'hasClinicalMediaFlowCases',
  'buildClinicalHistoryPhotosSection'
];

const timeline = [
  'buildTranscript',
  'buildTranscriptMessageCard',
  'buildTranscriptMetaText',
  'buildTranscriptCountText',
  'buildClinicalEventCard',
  'buildEvents',
  'buildEventTone',
  'buildEventsMetaText',
  'highestReviewEventSeverity'
];

const documents = [
  'renderPrescriptionMedicationMirror',
  'renderPrescriptionDirectionsMirror',
  'buildPrescriptionItemEditor',
  'emptyPrescriptionItem',
  'emptyPosology',
  'normalizePosology',
  'normalizePrescriptionItem',
  'normalizePrescriptionItems',
  'prescriptionItemStarted',
  'mutatePrescriptionItems',
  'buildClinicalHistoryDocumentsSection',
  'buildCertificateHistoryMetaText',
  'buildCertificateHistoryList',
  'emptyCertificateHistoryState',
  'normalizeCertificateHistoryItem',
  'readCertificateHistorySlice',
  'consentPacketTemplate',
  'emptyConsentPacket',
  'emptyConsentFormSnapshot',
  'normalizeConsentPacket',
  'normalizeConsentPackets',
  'normalizeConsentFormSnapshot',
  'normalizeConsentFormSnapshots',
  'buildLegacyConsentFromPacket',
  'consentPacketHasSubstantiveContent',
  'evaluateConsentPacket',
  'deriveConsentPacketContext',
  'buildClinicalHistoryConsentSection',
  'emptyInterconsultation',
  'emptyLabOrder',
  'emptyImagingOrder',
  'buildInterconsultationChip',
  'buildClinicalHistoryInterconsultSection',
  'buildLabOrderChip',
  'buildClinicalHistoryLabOrderSection',
  'buildImagingOrderChip',
  'buildClinicalHistoryImagingOrderSection',
  'buildConsentPacketChip',
  'buildLabOrderStudyChecklist',
  'buildImagingStudyGroupField',
  'normalizeDocuments'
];

function generateModuleFile(filename, funcNames) {
    let out = "import { getState, updateState } from '../../../../shared/core/store.js';\n";
    out += "import { setHtml, setText, escapeHtml, createToast, formatDateTime } from '../../../../shared/ui/render.js';\n";
    out += "import * as helpers from './index.js';\n\n";

    funcNames.forEach(name => {
        if (!functions[name]) {
            console.log("Missing function: " + name);
            return;
        }
        let fnCode = code.substring(functions[name].start, functions[name].end);
        
        const helperRegex = new RegExp('\\b(' + Object.keys(functions).filter(k => !funcNames.includes(k)).join('|') + ')\\b', 'g');
        
        fnCode = fnCode.replace(helperRegex, 'helpers.$1');
        
        out += "export " + fnCode + "\n\n";
    });

    fs.writeFileSync('src/apps/admin-v3/sections/clinical-history/render/' + filename, out);
    console.log("Wrote " + filename);
}

generateModuleFile('render-photos.js', photos);
generateModuleFile('render-timeline.js', timeline);
generateModuleFile('render-documents.js', documents);

let targetNames = new Set([...photos, ...timeline, ...documents]);

let newIndexCode = code;

let offset = 0;
const toRemove = [];

Object.entries(functions).forEach(([name, meta]) => {
    if (targetNames.has(name)) {
        toRemove.push({ start: meta.isExported ? meta.nodeStart : meta.start, end: meta.end });
    }
});

toRemove.sort((a,b) => b.start - a.start).forEach(segment => {
    newIndexCode = newIndexCode.substring(0, segment.start) + newIndexCode.substring(segment.end);
});

let exportsMap = "export {\n  " + [...targetNames].join(',\n  ') + "\n} from './render-docs-timeline-photos.js'; // to fix\n";
// Actually, it's safer to just inject standard exports
console.log("Splitting finished.");

fs.writeFileSync('src/apps/admin-v3/sections/clinical-history/render/index.js.new', newIndexCode);
