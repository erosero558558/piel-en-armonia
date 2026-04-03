import os
import re

def clean_controller(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    if "ClinicalMediaController" in file_path:
        # Remove hollow photos() and upload()
        content = re.sub(r'/\*\*.*?photos\([^)]*\)\s*:\s*void\s*\{.*?(?:self::emit|json_response).*?\}\n', '', content, flags=re.DOTALL)
        content = re.sub(r'public static function photos\([^)]*\)\s*:\s*void\s*\{.*?(?:self::emit|json_response).*?\}\n', '', content, flags=re.DOTALL)
        
        content = re.sub(r'/\*\*.*?upload\([^)]*\)\s*:\s*void\s*\{.*?(?:self::emit|json_response).*?\}\n', '', content, flags=re.DOTALL)
        content = re.sub(r'public static function upload\([^)]*\)\s*:\s*void\s*\{.*?(?:self::emit|json_response).*?\}\n', '', content, flags=re.DOTALL)

        # Remove handle()
        content = re.sub(r'/\*\* Route dispatcher \(internal\) \*/.*?public static function handle\([^)]*\)\s*:\s*void\s*\{.*?\}\n', '', content, flags=re.DOTALL)
        
    elif "ClinicalLabResultsController" in file_path:
        methods = ['receiveLabResult', 'receiveImagingResult', 'receiveInterconsultReport', 'uploadLabPdf', 'reportAdverseReaction']
        for m in methods:
            content = re.sub(r'/\*\*.*?' + m + '\([^)]*\)\s*:\s*void\s*\{.*?(?:self::emit|json_response).*?\}\n', '', content, flags=re.DOTALL)
            content = re.sub(r'public static function ' + m + '\([^)]*\)\s*:\s*void\s*\{.*?(?:self::emit|json_response).*?\}\n', '', content, flags=re.DOTALL)
        content = re.sub(r'/\*\* Route dispatcher \(internal\) \*/.*?public static function handle\([^)]*\)\s*:\s*void\s*\{.*?\}\n', '', content, flags=re.DOTALL)

    elif "ClinicalVitalsController" in file_path:
        methods = ['store', 'history']
        for m in methods:
            content = re.sub(r'/\*\*.*?' + m + '\([^)]*\)\s*:\s*void\s*\{.*?(?:self::emit|json_response).*?\}\n', '', content, flags=re.DOTALL)
            content = re.sub(r'public static function ' + m + '\([^)]*\)\s*:\s*void\s*\{.*?(?:self::emit|json_response).*?\}\n', '', content, flags=re.DOTALL)
        content = re.sub(r'/\*\* Route dispatcher \(internal\) \*/.*?public static function handle\([^)]*\)\s*:\s*void\s*\{.*?\}\n', '', content, flags=re.DOTALL)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

base = 'controllers/'
clean_controller(base + 'ClinicalMediaController.php')
clean_controller(base + 'ClinicalLabResultsController.php')
clean_controller(base + 'ClinicalVitalsController.php')
