# OpenClaw Custom GPT Schema Pack
> **Version:** 2026-03-31-0160650b
> **Generado:** 2026-03-31T04:40:30.421Z

Este documento consolida el esquema y las instrucciones necesarias para actualizar el Custom GPT Médico de Aurora Derm ("OpenClaw").

## Instrucciones de Importación

1. En ChatGPT, ve a la configuración de tu Custom GPT.
2. Abre la pestaña **Configure**.
3. En la caja de **Instructions**, pega el contenido de *System Instructions* de abajo.
4. Baja a la sección **Actions** y haz clic en *Edit*.
5. Pega el contenido de *OpenAPI Schema* en la caja.
6. Pulsa **Update** en la esquina superior derecha para publicar los cambios de forma privada al Workspace de la clínica.

---

## 1. System Instructions

```markdown
# Configuración de Custom GPT: Aurora Derm OpenClaw

Este documento contiene los parámetros exactos requeridos para configurar el **Copiloto Clínico de Aurora Derm** dentro de la plataforma de OpenAI (`platform.openai.com` / Creador de GPTs).

El propósito de este Custom GPT es asistir al equipo médico (Dra. Rosero y especialistas) interactuando en tiempo real con la historia clínica electrónica mediante llamadas seguras a los endpoints de la API documentados en el esquema `openapi-openclaw.yaml`.

---

## 1. Perfil Básico del GPT

- **Name:** `Aurora Derm OpenClaw`
- **Description:** `Copiloto clínico experto en dermatología. Interacciona con la historia clínica de Aurora Derm (HCE) y apoya al especialista en diagnóstico, evolución, prescripción y certificados de manera encriptada y segura.`
- **Profile Picture:** *(Subir el logo o la cruz de Aurora Derm provista por diseño).*

---

## 2. Instrucciones del Sistema (System Prompt)

*Copia y pega el siguiente texto en la caja "Instructions":*

```text
Eres "OpenClaw", el Copiloto Clínico oficial de Aurora Derm, diseñado específicamente para asistir a los especialistas en dermatología de la clínica (Dra. Rosero y Dr. Narváez). Tienes acceso directo a la Historia Clínica Electrónica (HCE) del paciente activo mediante los Custom Actions vinculados.

TOMA EN CUENTA:
- Idioma estricto: Todo análisis, explicación y resúmenes deben estar en español (Ecuador), usando nomenclatura médica y dermatológica profesional y precisa, apegada al CIE-10 y a las guías de práctica clínica (diagnóstico integral, láser fraccionado, bioestimuladores, tamizaje oncológico).
- Tono: Profesional, directo, de apoyo clínico, siempre respetando la decisión final del médico tratante.
- Flujo de Trabajo (Siempre requiere permisos): No asumas datos; tu primer paso ante un nuevo caso siempre es llamar a `getPatientContext` (`/patient/{patient_id}`) para obtener los detalles activos.
  
CÓMO USAR LOS ACTIONS:
1. Autocompletado/Sugerencia: Si el médico solicita sugerencias de diagnósticos, invoca a `suggestCIE10` indicando los síntomas o descripciones dadas por el doctor.
2. Protocolo: Provee guías invocando a `getTreatmentProtocol` enviando el código CIE-10 seleccionado.
3. Evaluación & Evolución: Si el médico discute hallazgos durante el turno, asiste en la redacción estructural y envíala a `saveEvolution` cuando el doctor te pida "Guardar evolución".
4. Recetas: Analiza las prescripciones. Usa `checkDrugInteractions` primero. Tras constatar seguridad, envía datos a `savePrescription`.
5. Documentos Adicionales: Tienes capacidad para estructurar y emitir certificados invocando `generateCertificate`. Provee siempre al médico de los reportes.
6. Cierre Automático: Invoca `summarizeSession` al final del acto médico si se te requiere, así formularás instrucciones para el paciente a enviarse a través de Flow OS.

REGLA CLÍNICA DE ORO:
No inventes información, no asumas antecedentes si no constan en el "patientContext", no derives a medicina casera. Todas las evoluciones enviadas por API a la HCE deben ser fidedignas e impersonales (tercera persona). Todas intervenciones deben ser seguras según los protocolos integrados de Aurora Derm.
```

---

## 3. Acciones (Actions)

Debes importar las definiciones técnicas para que el GPT sepa cómo hablar con el servidor.

1. Navega hacia **"Actions"** al configurar el GPT → **Create new action**.
2. **Authentication:** Selecciona **OAuth** (la clínica proporcionará un *Client ID*, *Client Secret*, *Authorization URL* y *Token URL* requeridos de acuerdo al estándar OAuth 2 implementado en el control de acceso del operador; si se usa un API Key por diseño preliminar, escoge "API Key / Bearer").
3. **Schema:** Copia en su totalidad el contenido del archivo de nuestro repositorio `openapi-openclaw.yaml` y pégalo en el editor YAML.
4. Asegúrate que en la sección **Servers** de la Action la URL figure correctamente: `url: https://pielarmonia.com/api/openclaw` (este link mapea el ambiente de producción).

---

## 4. Capacidades adicionales (Capabilities)

Asegúrate de configurar lo siguiente en las opciones misceláneas:
- **Code Interpreter:** Activado (Útil para analizar PDFs o laboratorios que el médico le arroje en la ventana local).
- **Web Browsing:** Desactivado (Para prevenir que busque literatura no indexada clínicamente y se apegue a protocolos).
- **DALL-E Image Generation:** Desactivado.

```

---

## 2. OpenAPI Schema (Actions)

```yaml
openapi: 3.1.0
info:
  title: OpenClaw — Aurora Derm Clinical Actions API
  description: |
    API que permite a OpenClaw (Custom GPT) acceder a la historia clínica del
    paciente en tiempo real durante la consulta médica.

    El GPT llama a estos endpoints con el token OAuth del médico autenticado.
    Todos los datos pertenecen a la clínica. ChatGPT no los almacena.

    Uso: este archivo se sube en la sección "Actions" del Custom GPT en ChatGPT.
  version: 1.0.0
  x-schema-version: 2026-03-31-0160650b
  contact:
    name: Aurora Derm — Flow OS
    url: https://pielarmonia.com

servers:
  - url: https://pielarmonia.com/api/openclaw
    description: Producción

security:
  - bearerAuth: []

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: Token JWT obtenido del OAuth de Aurora Derm

  schemas:
    PatientContext:
      type: object
      description: Contexto completo del paciente para alimentar la IA
      properties:
        patient_id:
          type: string
        name:
          type: string
          example: "María García"
        age:
          type: integer
          example: 34
        sex:
          type: string
          enum: [M, F, O]
        phone:
          type: string
          example: "0991234567"
        allergies:
          type: array
          items:
            type: string
          example: ["Penicilina", "Ibuprofeno"]
        medications_active:
          type: array
          items:
            type: object
            properties:
              name: { type: string }
              dose: { type: string }
              since: { type: string }
        diagnoses_history:
          type: array
          items:
            type: object
            properties:
              cie10_code: { type: string }
              cie10_description: { type: string }
              date: { type: string }
              doctor: { type: string }
        last_evolution:
          type: string
          description: Nota de evolución de la última consulta
        last_visit_date:
          type: string
        visit_count:
          type: integer
        photos_available:
          type: boolean
          description: Si tiene fotos clínicas previas en el sistema
        ai_summary:
          type: string
          description: Resumen generado por IA de las últimas 3 consultas

    CIE10Suggestion:
      type: object
      properties:
        code:
          type: string
          example: "L20.0"
        description:
          type: string
          example: "Dermatitis atópica de la cara"
        category:
          type: string
          example: "Dermatitis y eczema"
        confidence:
          type: number
          format: float

    Evolution:
      type: object
      required: [case_id, text]
      properties:
        case_id:
          type: string
        text:
          type: string
          description: Nota de evolución clínica redactada por el médico o generada por la IA
        cie10_code:
          type: string
        cie10_description:
          type: string
        doctor_id:
          type: string

    Prescription:
      type: object
      required: [case_id, medications]
      properties:
        case_id:
          type: string
        medications:
          type: array
          items:
            type: object
            required: [name, dose, frequency, duration]
            properties:
              name:
                type: string
                example: "Hidrocortisona 1%"
              dose:
                type: string
                example: "5g"
              frequency:
                type: string
                example: "2 veces al día"
              duration:
                type: string
                example: "14 días"
              instructions:
                type: string
                example: "Aplicar en área afectada con movimientos circulares"
        notes:
          type: string
          description: Indicaciones adicionales para el paciente

    Certificate:
      type: object
      required: [case_id, type]
      properties:
        case_id:
          type: string
        type:
          type: string
          enum: [reposo_laboral, aptitud_medica, constancia_tratamiento, control_salud]
        rest_days:
          type: integer
          description: Días de reposo (solo para reposo_laboral)
        diagnosis_text:
          type: string
          description: Diagnóstico para el certificado (redactado para el paciente)
        cie10_code:
          type: string
        restrictions:
          type: string
          description: Restricciones o indicaciones específicas
        observations:
          type: string

paths:

  /patient/{patient_id}:
    get:
      operationId: patient
      summary: Obtener contexto completo del paciente
      description: |
        Carga toda la información relevante del paciente para incluirla en el
        contexto de la consulta con IA. Llamar al inicio de cada consulta.
      parameters:
        - name: patient_id
          in: path
          required: true
          schema:
            type: string
        - name: case_id
          in: query
          required: false
          schema:
            type: string
          description: Si se proporciona, incluye datos del caso activo
      responses:
        '200':
          description: Contexto del paciente
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PatientContext'
        '404':
          description: Paciente no encontrado

  /cie10/suggest:
    get:
      operationId: cie10Suggest
      summary: Sugerir códigos CIE-10 basados en descripción clínica
      description: |
        Dado un texto clínico (síntoma, diagnóstico probable), devuelve los
        códigos CIE-10 más relevantes ordenados por probabilidad.
        Útil para que la IA proponga el código correcto al médico.
      parameters:
        - name: q
          in: query
          required: true
          schema:
            type: string
          description: Descripción clínica o diagnóstico probable
          example: "dermatitis atópica cara"
        - name: specialty
          in: query
          required: false
          schema:
            type: string
            default: "dermatology"
      responses:
        '200':
          description: Lista de sugerencias CIE-10
          content:
            application/json:
              schema:
                type: object
                properties:
                  suggestions:
                    type: array
                    items:
                      $ref: '#/components/schemas/CIE10Suggestion'

  /protocol/{cie10_code}:
    get:
      operationId: protocol
      summary: Obtener protocolo de tratamiento para un diagnóstico CIE-10
      description: |
        Devuelve el protocolo de tratamiento estándar de Aurora Derm para el
        diagnóstico dado. Incluye primera línea, alternativas, y seguimiento.
        El médico puede aceptar, modificar, o ignorar.
      parameters:
        - name: cie10_code
          in: path
          required: true
          schema:
            type: string
          example: "L20.0"
      responses:
        '200':
          description: Protocolo de tratamiento
          content:
            application/json:
              schema:
                type: object
                properties:
                  cie10_code:
                    type: string
                  cie10_description:
                    type: string
                  first_line:
                    type: array
                    items:
                      type: object
                      properties:
                        medication: { type: string }
                        dose: { type: string }
                        duration: { type: string }
                  alternatives:
                    type: array
                    items:
                      type: string
                  follow_up:
                    type: string
                  referral_criteria:
                    type: string
                  patient_instructions:
                    type: string
        '404':
          description: Sin protocolo para este código

  /save/evolution:
    post:
      operationId: saveEvolution
      summary: Guardar nota de evolución clínica en la HCE
      description: |
        Guarda la nota de evolución de la consulta actual en la historia clínica
        electrónica del paciente. El texto puede ser redactado por el médico
        o generado/resumido por la IA con aprobación del médico.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Evolution'
      responses:
        '201':
          description: Evolución guardada
          content:
            application/json:
              schema:
                type: object
                properties:
                  id: { type: string }
                  saved_at: { type: string }

  /save/diagnosis:
    post:
      operationId: saveDiagnosis
      summary: Aplicar diagnóstico CIE-10 al caso activo
      description: |
        Guarda el diagnóstico confirmado en el caso del paciente.
        La IA propone, el médico confirma, este endpoint lo aplica.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [case_id, cie10_code, cie10_description]
              properties:
                case_id: { type: string }
                cie10_code: { type: string }
                cie10_description: { type: string }
                notes: { type: string }
      responses:
        '200':
          description: Diagnóstico aplicado

  /save/prescription:
    post:
      operationId: savePrescription
      summary: Crear receta digital para el paciente
      description: |
        Genera y guarda la receta médica con los medicamentos indicados.
        El sistema verifica interacciones con medicamentos activos del paciente.
        Devuelve URL del PDF generado.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Prescription'
      responses:
        '201':
          description: Receta creada
          content:
            application/json:
              schema:
                type: object
                properties:
                  prescription_id: { type: string }
                  pdf_url: { type: string }
                  whatsapp_url:
                    type: string
                    description: URL para enviar la receta directamente por WhatsApp

  /generate/certificate:
    post:
      operationId: generateCertificate
      summary: Generar certificado médico en PDF
      description: |
        Genera el certificado médico con membrete oficial de Aurora Derm,
        datos del médico (especialidad, registro MSP), folio secuencial,
        y firma digital del doctor. PDF listo para imprimir o enviar.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Certificate'
      responses:
        '201':
          description: Certificado generado
          content:
            application/json:
              schema:
                type: object
                properties:
                  certificate_id: { type: string }
                  folio: { type: string }
                  pdf_url: { type: string }
                  whatsapp_url: { type: string }

  /summarize/session:
    post:
      operationId: summarizeSession
      summary: Generar resumen de cierre de consulta
      description: |
        Al finalizar la consulta, genera automáticamente:
        1. Nota de evolución clínica (para HCE)
        2. Resumen para el paciente en lenguaje simple (para WhatsApp)
        3. Lista de pendientes (estudios, próxima cita)
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [case_id, chat_summary]
              properties:
                case_id: { type: string }
                chat_summary:
                  type: string
                  description: Resumen de lo discutido en la sesión de chat
      responses:
        '200':
          description: Resumen generado
          content:
            application/json:
              schema:
                type: object
                properties:
                  evolution_text: { type: string }
                  patient_summary: { type: string }
                  whatsapp_url:
                    type: string
                    description: "Enlace generado dinámicamente para contactar al paciente por WhatsApp con el paciente_summary ya formateado"
                  pending_actions:
                    type: array
                    items:
                      type: string

  /check/interactions:
    post:
      operationId: checkInteractions
      summary: Verificar interacciones medicamentosas
      description: |
        Verifica si los medicamentos propuestos tienen interacciones conocidas
        con los medicamentos activos del paciente. Responde con alertas.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [case_id, proposed_medications]
              properties:
                case_id: { type: string }
                proposed_medications:
                  type: array
                  items:
                    type: string
      responses:
        '200':
          description: Resultado de verificación
          content:
            application/json:
              schema:
                type: object
                properties:
                  has_interactions:
                    type: boolean
                  interactions:
                    type: array
                    items:
                      type: object
                      properties:
                        drug_a: { type: string }
                        drug_b: { type: string }
                        severity:
                          type: string
                          enum: [low, medium, high]
                        description: { type: string }

  /chat:
    post:
      operationId: chat
      summary: Conversar con el Copiloto Clínico
      description: |
        Envía un mensaje o historial al AI Router (Tier 1/2/3).
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [messages]
              properties:
                messages:
                  type: array
                  items:
                    type: object
                    required: [role, content]
                    properties:
                      role: { type: string, enum: [user, assistant, system] }
                      content: { type: string }
                case_id:
                  type: string
                  description: "ID del caso activo para contexto opcional"
                stream:
                  type: boolean
                  default: false
      responses:
        '200':
          description: Respuesta generada por el router de IA
          content:
            application/json:
              schema:
                type: object
                properties:
                  choices:
                    type: array
                    items:
                      type: object
                      properties:
                        message:
                          type: object
                          properties:
                            role: { type: string }
                            content: { type: string }
                  provider: { type: string }
                  tier: { type: string }

  /router/status:
    get:
      operationId: routerStatus
      summary: Ver estado del AI Router
      description: |
        Verifica qué tiers del AI Router están disponibles (Codex, OpenRouter, Local).
      responses:
        '200':
          description: Health check del sistema de IA
          content:
            application/json:
              schema:
                type: object
                properties:
                  router:
                    type: object
                    additionalProperties: true

  /prescription/{id}:
    get:
      operationId: getPrescriptionPdf
      summary: Descargar PDF de receta
      description: Retorna el archivo binario PDF de la receta.
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
        - name: format
          in: query
          required: false
          schema:
            type: string
            default: pdf
      responses:
        '200':
          description: Archivo PDF
          content:
            application/pdf:
              schema:
                type: string
                format: binary
        '404':
          description: Receta no encontrada

  /certificate/{id}:
    get:
      operationId: getCertificatePdf
      summary: Descargar PDF de certificado
      description: Retorna el archivo binario PDF del certificado médico.
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
        - name: format
          in: query
          required: false
          schema:
            type: string
            default: pdf
      responses:
        '200':
          description: Archivo PDF
          content:
            application/pdf:
              schema:
                type: string
                format: binary
        '404':
          description: Certificado no encontrado

```
