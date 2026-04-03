import sys
import re

def extract_method(content, method_name):
    pattern = r"((?: *(?:\/\*\*.*?\*\/[\n\r]+ *)*)? *(?:public|private|protected) +static +function +" + method_name + r"\s*\([^)]*\)(?:\s*:\s*[A-Za-z0-9_?|]+)?\s*\{)"
    match = re.search(pattern, content, flags=re.DOTALL | re.MULTILINE)
    
    if not match:
        print(f"Method {method_name} not found!")
        return None, content
        
    start_idx = match.start()
    brace_start = match.end() - 1
    
    bracket_count = 1
    i = brace_start + 1
    
    in_string = False
    string_char = ''
    in_line_comment = False
    in_block_comment = False
    
    while i < len(content) and bracket_count > 0:
        c = content[i]
        
        if in_line_comment:
            if c == '\n':
                in_line_comment = False
            i += 1
            continue
            
        if in_block_comment:
            if c == '*' and i + 1 < len(content) and content[i+1] == '/':
                in_block_comment = False
                i += 2
                continue
            i += 1
            continue
            
        if in_string:
            if c == '\\':
                i += 2
                continue
            elif c == string_char:
                in_string = False
            i += 1
            continue
            
        if c in ("'", '"'):
            in_string = True
            string_char = c
        elif c == '/' and i + 1 < len(content) and content[i+1] == '/':
            in_line_comment = True
            i += 1
        elif c == '/' and i + 1 < len(content) and content[i+1] == '*':
            in_block_comment = True
            i += 1
        elif c == '{':
            bracket_count += 1
        elif c == '}':
            bracket_count -= 1
            
        i += 1
        
    end_idx = i
    
    extracted = content[start_idx:end_idx]
    new_content = content[:start_idx].rstrip() + "\n\n    " + content[end_idx:].lstrip()
    
    return extracted, new_content

def do_extraction(source_file, target_file, methods):
    try:
        with open(source_file, 'r', encoding='utf-8') as f:
            source = f.read()
    except Exception as e:
        print(f"Error reading {source_file}: {e}")
        return

    extracted_blocks = {}
    
    for method in methods:
        extracted, source = extract_method(source, method)
        if extracted:
            extracted_blocks[method] = extracted
            print(f"Successfully extracted: {method}")
        else:
            print(f"Failed to extract: {method}")

    try:
        with open(target_file, 'r', encoding='utf-8') as f:
            target = f.read()
    except Exception as e:
        target = "<?php\n\n"
        
    # Inject each extracted method
    for method, code in extracted_blocks.items():
        existing_match = re.search(r"(?:public|private|protected) static function " + method + r"\s*\(", target)
        if existing_match:
            _, target_cleaned = extract_method(target, method)
            insertion_point = target_cleaned.rfind('}')
            if insertion_point != -1:
                target = target_cleaned[:insertion_point].rstrip() + "\n\n    " + code + "\n}\n"
        else:
            insertion_point = target.rfind('}')
            if insertion_point != -1:
                target = target[:insertion_point].rstrip() + "\n\n    " + code + "\n" + target[insertion_point:]
            else:
                target += "\n\n" + code + "\n"

    with open(source_file, 'w', encoding='utf-8') as f:
        f.write(source)
        
    with open(target_file, 'w', encoding='utf-8') as f:
        f.write(target)
        
    print("Done")

if __name__ == '__main__':
    source = sys.argv[1]
    target = sys.argv[2]
    methods = sys.argv[3].split(',')
    do_extraction(source, target, methods)
