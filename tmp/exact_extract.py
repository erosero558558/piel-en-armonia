import sys

def exact_extract():
    with open('controllers/OpenclawController.php', 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    # Python slices are [start:end] (end exclusive)
    # lines 1362 to 1596 (inclusive) => indices 1361:1596
    part1 = lines[1361:1596]
    # lines 1971 to 2075 (inclusive) => indices 1970:2075
    part2 = lines[1970:2075]

    extracted_content = "".join(part1) + "\n" + "".join(part2)

    # Now remove them from lines. Must remove back to front to preserve indices.
    del lines[1970:2075]
    del lines[1361:1596]

    with open('controllers/OpenclawController.php', 'w', encoding='utf-8') as f:
        f.writelines(lines)

    target_file = 'controllers/OpenclawTelemedicineFacade.php'
    try:
        with open(target_file, 'r', encoding='utf-8') as f:
            target = f.read()
    except Exception:
        target = "<?php\n\nclass OpenclawTelemedicineFacade\n{\n}\n"

    insertion_point = target.rfind('}')
    if insertion_point != -1:
        target = target[:insertion_point].rstrip() + "\n\n" + extracted_content + "\n" + target[insertion_point:]
    else:
        target += "\n\n" + extracted_content + "\n"

    with open(target_file, 'w', encoding='utf-8') as f:
        f.write(target)

    print("Exact extraction done!")

exact_extract()
