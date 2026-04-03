import re

with open('controllers/PatientPortalController.php', 'r', encoding='utf-8') as f:
    text = f.read()

def find_method(name):
    # Match both public and private static functions
    match = re.search(r'^[ \t]*(?:public|private) static function ' + name + r'\s*\(', text, re.MULTILINE)
    if not match:
        return None
        
    start_pos = match.start()
    
    # Check for preceding docblock
    sub = text[:start_pos]
    lastIndexOfDocStart = sub.rfind('/**')
    lastIndexOfDocEnd = sub.rfind('*/')
    
    if lastIndexOfDocStart != -1 and lastIndexOfDocEnd != -1 and lastIndexOfDocStart < lastIndexOfDocEnd:
        between = sub[lastIndexOfDocEnd+2:]
        if between.strip() == '':
            start_pos = lastIndexOfDocStart

    open_brace_idx = text.find('{', match.start())
    if open_brace_idx == -1: return None
    
    depth = 1
    i = open_brace_idx + 1
    in_str = False
    str_char = ''
    in_line_comment = False
    in_block_comment = False
    
    while i < len(text) and depth > 0:
        c = text[i]
        
        if in_line_comment:
            if c == '\n': in_line_comment = False
            i += 1
            continue
            
        if in_block_comment:
            if c == '*' and i+1 < len(text) and text[i+1] == '/':
                in_block_comment = False
                i += 2
                continue
            i += 1
            continue

        if in_str:
            if c == '\\': i += 2; continue
            elif c == str_char: in_str = False
        else:
            if c in ('"', "'"):
                in_str = True
                str_char = c
            elif c == '/' and i+1 < len(text) and text[i+1] == '/':
                in_line_comment = True
                i += 2
                continue
            elif c == '/' and i+1 < len(text) and text[i+1] == '*':
                in_block_comment = True
                i += 2
                continue
            elif c == '{': depth += 1
            elif c == '}': depth -= 1
            
        i += 1
    
    if i < len(text) and text[i] == '\n':
        i += 1
        
    return text[start_pos:i]

methods = {
    'PatientPortalConsentController': [
        'consent', 'signConsent', 'buildPortalConsentSummary', 'resolvePortalConsentContext', 'buildPortalConsentPayloadFromContext',
        'resolvePortalConsentSession', 'findPortalActiveConsentPacket', 'findLatestAcceptedConsentSnapshot',
        'preparePortalConsentPacketForSignature', 'attachPortalConsentPdfArtifacts', 'findSignedConsentSnapshotForPacket',
        'findPortalConsentSnapshotById', 'isPortalSignatureDataUrl', 'buildConsentFileName', 'generateConsentPdfBytes', 'buildConsentHtml'
    ],
    'PatientPortalDocumentController': [
        'document', 'documentVerify', 'historyPdf', 'prescription', 'buildDocumentVerificationPayload', 'resolveDocumentDoctor',
        'buildPortalDocumentPayload', 'defaultDocumentState', 'buildHistoryExportSummary', 'buildHistoryExportId',
        'buildHistoryExportFileName', 'generateHistoryExportPdfBytes', 'buildHistoryExportHtml', 'buildHistoryExportConsultationHtml',
        'generateCertificatePdfBytes', 'buildCertificateHtml', 'buildCertificateFileName', 'buildPrescriptionFileName',
        'findPrescriptionById', 'findCertificateById'
    ]
}

# Methods may call each other within their new facades or call PatientPortalController methods.
# For simplicity, we rewrite "self::" to "PatientPortalController::" for everything.
# Then inside the facade, they just use "PatientPortalController::localMethod".
# Wait, "self::" referring to a method now belonging to the same facade will be broken? No, "PatientPortalController::consent" works since we will leave the facade calling the old class. Except we are removing them!
# Ah! If the method is REMOVED from PatientPortalController, "PatientPortalController::buildConsentHtml" will throw Method Not Found.
# So I should ONLY replace `self::` to `PatientPortalController::` for methods that remain in PatientPortalController.
# For methods that go to the SAME facade, it should remain `self::`. For methods that go to the OTHER facade, it should be `FacadeThis::`.
# Actually, the simplest approach is: before doing global replacements, we replace self::method with PatientPortalConsentController::method globally in the extracted block if it's moving there.

all_consent_methods = methods['PatientPortalConsentController']
all_document_methods = methods['PatientPortalDocumentController']

for facade, m_list in methods.items():
    bodies = []
    for m in m_list:
        body = find_method(m)
        if body:
            # Change "private static" to "public static" if needed (all cross-controller methods must be public)
            body = re.sub(r'^[ \t]*private static function', '    public static function', body, flags=re.MULTILINE)
            
            # For each method call, if the target is in the same class, use self:: (which is default).
            # If target is in another facade, rewrite it. If it remains in PatientPortalController, rewrite it to PatientPortalController::.
            # To do this safely, we first replace ALL `self::` with `PatientPortalController::`.
            body = body.replace('self::', 'PatientPortalController::')
            
            # Then we "un-replace" methods that moved to PatientPortalConsentController:
            for cm in all_consent_methods:
                body = re.sub(r'PatientPortalController::' + cm + r'\(', f'PatientPortalConsentController::{cm}(', body)
            
            # And "un-replace" for PatientPortalDocumentController:
            for dm in all_document_methods:
                body = re.sub(r'PatientPortalController::' + dm + r'\(', f'PatientPortalDocumentController::{dm}(', body)
            
            # And if we are currently building 'PatientPortalConsentController', we can change 'PatientPortalConsentController::' back to 'self::'.
            body = re.sub(r'' + facade + r'::', 'self::', body)

            bodies.append(body)
            print(f"Extracted {m} ({len(body)} chars)")
        else:
            print(f"FAILED to find {m}")
    
    if bodies:
        with open(f'controllers/{facade}.php', 'w', encoding='utf-8') as f:
            f.write(f"<?php\n\ndeclare(strict_types=1);\n\nclass {facade}\n{{\n")
            f.write("\n\n".join(bodies))
            f.write("\n}\n")
        print(f"Wrote {facade}.php with {len(bodies)} methods")

# Also generate a removal script
modified_text = text
removed_count = 0

for facade, m_list in methods.items():
    for m in m_list:
        raw_body = find_method(m)
        if raw_body:
            modified_text = modified_text.replace(raw_body, '')
            removed_count += 1
            print(f"Removed method {m} from original controller.")

modified_text = re.sub(r'\n{3,}', '\n\n', modified_text)

# Also remove references in handle()
for m in methods['PatientPortalConsentController'] + methods['PatientPortalDocumentController']:
    # Clean up the dispatch inside the switch
    pattern = rf"[ \t]*case '[^']+':[ \t]*\n[ \t]*self::{m}\(.*?\);[ \t]*\n[ \t]*return;[ \t]*\n"
    res = re.subn(pattern, '', modified_text)
    modified_text = res[0]
    
    pattern2 = rf"[ \t]*case '{m}':[ \t]*\n[ \t]*self::{m}\(.*?\);[ \t]*\n[ \t]*return;[ \t]*\n"
    res2 = re.subn(pattern2, '', modified_text)
    modified_text = res2[0]

# Furthermore, inside PatientPortalController, there might be calls to self::buildPortalConsentSummary, etc.
# We must replace those with PatientPortalConsentController::buildPortalConsentSummary in the entire remaining file!
for cm in all_consent_methods:
    modified_text = re.sub(r'self::' + cm + r'\(', f'PatientPortalConsentController::{cm}(', modified_text)

for dm in all_document_methods:
    modified_text = re.sub(r'self::' + dm + r'\(', f'PatientPortalDocumentController::{dm}(', modified_text)

with open('controllers/PatientPortalController.php', 'w', encoding='utf-8') as f:
    f.write(modified_text)

print(f"Removed {removed_count} methods successfully and updated PatientPortalController!")
