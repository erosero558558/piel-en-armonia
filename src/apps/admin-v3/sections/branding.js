/**
 * S6-06: Motor de Temas SaaS (Theme Engine)
 * Lógica para la previsualización en tiempo real del Branding de las Clínicas
 */

export function bootBrandingSection() {
    const section = document.getElementById('branding');
    if (!section) return;

    const colorPicker = document.getElementById('brand-color-picker');
    const colorText = document.getElementById('brand-color-text');
    const logoUrl = document.getElementById('brand-logo-url');
    const logoFile = document.getElementById('brand-logo-file');
    
    const previewContainer = document.getElementById('preview-kiosk-container');
    const previewLogoImg = document.getElementById('preview-logo-img');
    const previewLogoText = document.getElementById('preview-logo-text');
    const btnSave = document.getElementById('btnSaveBranding');

    // 1. Manejo de Selección de Color
    function updateColor(hexCode) {
        // Actualiza preview CSS variable dinámicamente
        previewContainer.style.setProperty('--preview-primary', hexCode);
        colorPicker.value = hexCode;
        colorText.value = hexCode;
    }

    colorPicker.addEventListener('input', (e) => updateColor(e.target.value));
    
    colorText.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        // Validar regex pseudo HEX
        if (/^#[0-9A-F]{6}$/i.test(val)) {
            updateColor(val);
        }
    });

    // 2. Manejo del Logo (URL)
    logoUrl.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        if (url) {
            previewLogoImg.src = url;
            previewLogoImg.style.display = 'block';
            previewLogoText.style.display = 'none';
        } else {
            previewLogoImg.src = '';
            previewLogoImg.style.display = 'none';
            previewLogoText.style.display = 'block';
        }
    });

    // 3. Manejo de Subida Archivo Local (FileReader Mocking)
    logoFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const base64 = evt.target.result;
                previewLogoImg.src = base64;
                previewLogoImg.style.display = 'block';
                previewLogoText.style.display = 'none';
                
                // Clear URL to signify file usage priority
                logoUrl.value = '';
            };
            reader.readAsDataURL(file);
        }
    });

    // 4. Submit Mock
    btnSave.addEventListener('click', () => {
        const selectedColor = colorPicker.value;
        const uploadType = logoFile.files.length > 0 ? 'Archivo local' : (logoUrl.value ? 'URL' : 'Predeterminado');

        btnSave.disabled = true;
        btnSave.textContent = 'Aplicando Cambios...';

        // Simula latencia API
        setTimeout(() => {
            btnSave.disabled = false;
            btnSave.textContent = 'Publicar Tema en Kioscos';

            document.body.dispatchEvent(new CustomEvent('admin-toast', {
                detail: { 
                    message: `Identidad gráfica salvada exitosamente. (Color: ${selectedColor}, Logo: ${uploadType})`, 
                    type: 'success' 
                }
            }));
        }, 800);
    });
}
