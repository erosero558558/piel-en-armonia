const fs = require('fs');
let code = fs.readFileSync('src/apps/admin-v3/sections/clinical-history/render/index.js.new', 'utf8');

const funcs = [...code.matchAll(/^function (.*?)\(/gm)].map(m => m[1]);
console.log("Found " + funcs.length + " functions in index.js to export.");

code = code.replace(/^function (.+?)\(/gm, 'export function $1(');

let finalExports = `
import * as photos from './render-photos.js';
import * as timeline from './render-timeline.js';
import * as documents from './render-documents.js';

export { photos, timeline, documents };
// Merge back main exports manually so it acts as barrel
Object.assign(window, {
  renderClinicalHistorySection,
  filterClinicalReviewQueue,
  normalizeClinicalHistoryWorkspace
});
`;

fs.writeFileSync('src/apps/admin-v3/sections/clinical-history/render/index.js.new', code + finalExports);
