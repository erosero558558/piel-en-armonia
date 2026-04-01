const fs = require('fs');
const content = fs.readFileSync('js/public-v6-shell.js', 'utf8');
const patched = content
  .replace('function openDrawer() {', 'function openDrawer() { console.log("DEBUG: openDrawer called");')
  .replace('function closeDrawer(returnFocus) {', 'function closeDrawer(returnFocus) { console.log("DEBUG: closeDrawer called. Focus=", returnFocus);');
fs.writeFileSync('js/public-v6-shell.js', patched);
