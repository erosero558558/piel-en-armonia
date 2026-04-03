import glob
import re

files = glob.glob('controllers/Openclaw*Facade.php')

for file in files:
    with open(file, 'r') as f:
        content = f.read()
    
    # Remove the block matching final class OpenclawController {
    content = re.sub(r'\s*/\*\*[\s\S]*?final class OpenclawController\s*\{', '', content)
    
    with open(file, 'w') as f:
        f.write(content)

print("Cleaned up facades!")
