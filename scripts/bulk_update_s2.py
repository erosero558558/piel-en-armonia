import os
import glob
import re

directories = glob.glob('es/servicios/*/index.html')
for filepath in directories:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # S2-07 Contextualize WA link
    # Find the service name from the folder
    folder_name = os.path.basename(os.path.dirname(filepath))
    service_name = folder_name.replace('-', ' ').capitalize()
    
    # Replace wa.me/593982453672 or wa.me/593982453672?text=... if existing
    wa_url = f'https://wa.me/593982453672?text=Hola,%20deseo%20agendar%20una%20consulta%20para%20{service_name.replace(" ", "%20")}'
    content = re.sub(r'https://wa\.me/593982453672[^"\'<]*', wa_url, content)

    # S2-18 Footer Disclaimer
    disclaimer = '<p style="text-align:center; font-size:0.8rem; color:var(--text-tertiary, #9ca3af); padding:1rem 0;">Los resultados varían. Consulte a nuestro especialista.</p>'
    if 'Los resultados varían. Consulte a nuestro especialista.' not in content:
        # Insert before </body> or </footer>
        if '</footer>' in content:
            content = content.replace('</footer>', f'{disclaimer}\n</footer>')
        elif '</body>' in content:
            content = content.replace('</body>', f'{disclaimer}\n</body>')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print(f"Updated {len(directories)} service pages.")
