import re

with open('controllers/ClinicalHistoryController.php', 'r', encoding='utf-8') as f:
    text = f.read()

def find_method(name):
    match = re.search(r'(?:[ \t]*(?:\/\*\*(?:(?!\*\/).)*?\*\/\n)?)?[ \t]*public static function ' + name + r'\s*\(', text, re.DOTALL)
    if not match:
        return None
    start_pos = match.start()
    
    open_brace_idx = text.find('{', start_pos)
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
    
    # Also grab the next newline if available
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

for facade, m_list in methods.items():
    bodies = []
    for m in m_list:
        body = find_method(m)
        if body:
            body = body.replace('self::', 'ClinicalHistoryController::')
            bodies.append(body)
        else:
            print(f"FAILED to find {m}")
    
    if bodies:
        with open(f'controllers/{facade}.php', 'w', encoding='utf-8') as f:
            f.write(f"<?php\n\ndeclare(strict_types=1);\n\nclass {facade}\n{{\n")
            f.write("\n\n".join(bodies))
            f.write("\n}\n")
        print(f"Wrote {facade}.php")

