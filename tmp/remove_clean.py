import re

with open('controllers/ClinicalHistoryController.php', 'r', encoding='utf-8') as f:
    text = f.read()

def find_method(name):
    match = re.search(r'^[ \t]*public static function ' + name + r'\s*\(', text, re.MULTILINE)
    if not match:
        return None
        
    start_pos = match.start()
    
    # Check for preceding docblock
    sub = text[:start_pos]
    lastIndexOfDocStart = sub.rfind('/**')
    lastIndexOfDocEnd = sub.rfind('*/')
    
    if lastIndexOfDocStart != -1 and lastIndexOfDocEnd != -1 and lastIndexOfDocStart < lastIndexOfDocEnd:
        # Check if there is only whitespace between doc end and function
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
    'ClinicalLabResultsController': [
        'receiveLabResult', 'receiveImagingResult', 'receiveInterconsultReport', 'uploadClinicalLabPdf', 'reportAdverseReaction', 'adminLabShare'
    ],
    'ClinicalVitalsController': [
        'saveVitals', 'vitalsHistory'
    ],
    'ClinicalMediaController': [
        'uploadMedia', 'getClinicalPhotos', 'uploadClinicalPhoto'
    ]
}

modified_text = text
removed_count = 0

for facade, m_list in methods.items():
    for m in m_list:
        raw_body = find_method(m)
        if raw_body:
            modified_text = modified_text.replace(raw_body, '')
            removed_count += 1
            print(f"Removed method {m} from controller.")

# Now clean up any empty lines that might have been left
modified_text = re.sub(r'\n{3,}', '\n\n', modified_text)

with open('controllers/ClinicalHistoryController.php', 'w', encoding='utf-8') as f:
    f.write(modified_text)

print(f"Removed {removed_count} methods successfully.")
