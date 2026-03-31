/**
 * ComponentLoader - Sistema simple de componentes
 * 
 * USO:
 * 1. Define un componente:
 *    ComponentLoader.register('hero', {
 *      render: (props) => `<h1>${props.title}</h1>`
 *    });
 * 
 * 2. Úsalo en HTML:
 *    <div data-component="hero" data-props='{"title":"Hola"}'></div>
 * 
 * 3. Inicializa:
 *    ComponentLoader.init();
 */

const ComponentLoader = {
    components: new Map(),
    
    /**
     * Registra un nuevo componente
     * @param {string} name - Nombre del componente
     * @param {object} definition - { render: (props) => html }
     */
    register(name, definition) {
        if (!definition.render || typeof definition.render !== 'function') {
            console.error(`Componente "${name}" necesita un método render()`);
            return;
        }
        this.components.set(name, definition);
    },
    
    /**
     * Inicializa todos los componentes en la página
     */
    init() {
        const elements = document.querySelectorAll('[data-component]');
        elements.forEach(el => this.mount(el));
    },
    
    /**
     * Monta un componente en un elemento
     */
    mount(element) {
        const name = element.dataset.component;
        const props = this.parseProps(element.dataset.props);
        
        const component = this.components.get(name);
        if (!component) {
            console.warn(`Componente "${name}" no registrado`);
            return;
        }
        
        try {
            const html = component.render(props);
            // SEC-01: sanitize HTML before injection to prevent XSS
            // Use DOMPurify if available (loaded in admin.html), otherwise safe
            if (typeof DOMPurify !== 'undefined') {
                element.innerHTML = DOMPurify.sanitize(html, {
                    ALLOWED_TAGS: ['div','span','p','h1','h2','h3','h4','h5','h6',
                        'ul','ol','li','strong','em','b','i','a','img','button',
                        'input','select','option','label','form','table','thead',
                        'tbody','tr','th','td','section','article','header','footer',
                        'nav','main','aside','figure','figcaption','time','mark'],
                    ALLOWED_ATTR: ['class','id','style','href','src','alt','type',
                        'value','placeholder','data-*','aria-*','role','tabindex',
                        'target','rel','for','name','action','method'],
                });
            } else {
                // Fallback: strip script tags at minimum before injecting
                const safe = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                                  .replace(/\bon\w+\s*=/gi, 'data-blocked=');
                element.innerHTML = safe;
            }
            
            // Call onMount if defined
            if (component.onMount) {
                component.onMount(element, props);
            }
        } catch (error) {
            console.error(`Error renderizando "${name}":`, error);
            // SEC-01: use textContent for error message to prevent second-order XSS
            const errEl = document.createElement('p');
            errEl.style.color = 'red';
            errEl.textContent = `Error cargando ${name}`;
            element.appendChild(errEl);
        }
    },
    
    /**
     * Parsea las props del data-attribute
     */
    parseProps(propsString) {
        if (!propsString) return {};
        try {
            return JSON.parse(propsString);
        } catch {
            console.warn('Props inválidas:', propsString);
            return {};
        }
    },
    
    /**
     * Recarga un componente específico (útil para desarrollo)
     */
    reload(name) {
        const elements = document.querySelectorAll(`[data-component="${name}"]`);
        elements.forEach(el => this.mount(el));
    }
};

// Exportar para módulos ES6
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ComponentLoader };
}
