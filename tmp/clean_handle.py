import re

with open('controllers/ClinicalHistoryController.php', 'r', encoding='utf-8') as f:
    text = f.read()

methods_to_remove = [
    'receiveLabResult', 'receiveImagingResult', 'receiveInterconsultReport', 'uploadClinicalLabPdf', 'reportAdverseReaction', 'adminLabShare',
    'saveVitals', 'vitalsHistory',
    'uploadMedia', 'getClinicalPhotos', 'uploadClinicalPhoto'
]

count = 0
for m in methods_to_remove:
    # Match standard case blocks like:
    # case 'POST:receive-lab-result':
    #     self::receiveLabResult($context);
    #     return;
    pattern = rf"[ \t]*case '[^']+':[ \t]*\n[ \t]*self::{m}\(.*?\);[ \t]*\n[ \t]*return;[ \t]*\n"
    res = re.subn(pattern, '', text, count=0)
    text = res[0]
    count += res[1]

with open('controllers/ClinicalHistoryController.php', 'w', encoding='utf-8') as f:
    f.write(text)

print(f"Removed {count} handler cases successfully.")
