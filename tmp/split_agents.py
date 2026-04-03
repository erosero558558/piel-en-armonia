import re
import sys

def split_agents_md(input_file, output_active, output_archive):
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # We want to extract S1 to S30 completed.
    # The structure has sections like "### S" or "## Sprint" or "### Sprint"
    
    # Let's find the split point. We want to keep active sprints S35, S36, UI5-restantes, and S42 etc.
    # The active backlog effectively starts at S31 or maybe S35?
    # According to the task: S1-S30 completados -> BACKLOG_ARCHIVE.md
    # So we split at "## Sprint 31" or "## 31." or "Sprint 31".
    
    match = re.search(r'^(##+ |###+ |## \d+\. )?(Sprint 31 —)', content, re.MULTILINE)
    
    if not match:
        print("Could not find Sprint 31 boundary.")
        sys.exit(1)
        
    split_index = match.start()
    
    # We should keep the header/intro of AGENTS.md in the active file as well.
    # Let's find the first sprint header to extract the preamble.
    first_sprint_match = re.search(r'^(##+ |###+ |## \d+\. )?(Sprint 1 |S1|🎨 Sprint UI|⚙️ Sprint 8)', content, re.MULTILINE)
    preamble_index = first_sprint_match.start() if first_sprint_match else 0
    
    preamble = content[:preamble_index]
    archived_sprints = content[preamble_index:split_index]
    active_sprints = content[split_index:]
    
    with open(output_archive, 'w', encoding='utf-8') as f:
        f.write("# Archivo de Backlog (S1 - S30)\n\n")
        f.write(archived_sprints)
        
    with open(output_active, 'w', encoding='utf-8') as f:
        f.write(preamble)
        f.write(active_sprints)

if __name__ == "__main__":
    split_agents_md(
        "AGENTS.md", 
        "AGENTS.md", 
        "docs/BACKLOG_ARCHIVE.md"
    )
    print("Successfully split AGENTS.md")
