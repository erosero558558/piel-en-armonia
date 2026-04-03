<?php

declare(strict_types=1);

/**
 * FigoBrain V3: The High-End Digital Concierge for Aurora Derm.
 * Professional, Safe, Empathetic, and Authoritative.
 */
require_once __DIR__ . '/lib/ClinicConfig.php';

class FigoBrain
{
    // ==============================================================================
    // CONFIGURATION: INTENTS & KEYWORDS
    // ==============================================================================
    private const INTENTS = [
        // --- Safety & Urgency (Highest Priority) ---
        'emergency' => [
            'emergencia', 'urgencia', 'sangrado', 'dolor intenso', 'dolor insoportable', 'infeccion',
            'pus', 'fiebre', 'quemadura grave', 'herida abierta', 'me duele mucho', 'ayuda medica', 'asfixia'
        ],
        // --- Escalation / Sentiment ---
        'escalation' => [
            'queja', 'reclamo', 'mal servicio', 'pesimo', 'enojado', 'molesto', 'nadie contesta',
            'no entiendo', 'basura', 'estafa', 'fraude'
        ],
        'handoff' => [
            'ayuda humana', 'quiero hablar con alguien', 'persona real', 'hablar con un humano',
            'hablar con un doctor', 'agente', 'soporte', 'asesor', 'atencion al cliente', 'hablar con persona',
            'no eres real', 'necesito una persona', 'hablar con el doctor', 'hablar con la doctora'
        ],
        // --- Identity & Rapport ---
        'greeting' => [
            'hola', 'buenos dias', 'buenas tardes', 'buenas noches', 'hey', 'hi', 'hello', 'saludos',
            'que tal', 'como estas', 'buen dia', 'buenas', 'estimados'
        ],
        'identity' => [
            'quien eres', 'eres un bot', 'eres ia', 'como te llamas', 'tu nombre', 'quien me atiende',
            'hablo con una persona', 'eres real', 'sos real'
        ],
        // --- Trust & Authority ---
        'trust_why_us' => [
            'porque elegirlos', 'son buenos', 'referencias', 'experiencia', 'años', 'garantia',
            'seguridad', 'confiables', 'mejor dermatologo'
        ],
        'technology' => [
            'tecnologia', 'equipos', 'maquinas', 'laser fotona', 'dermatoscopio', 'moderno', 'equipamiento'
        ],
        // --- Core Business ---
        'pricing' => [
            'precio', 'cuanto cuesta', 'valor', 'tarifa', 'costo', 'presupuesto', 'cotizacion',
            'cuanto vale', 'precios', 'honorarios', 'me cobra', 'cuanto sale', 'a como', 'cobran'
        ],
        'booking' => [
            'cita', 'agendar', 'reservar', 'turno', 'hora', 'quiero una consulta', 'sacar turno',
            'pedir hora', 'consulta medica', 'quiero ir', 'disponibilidad', 'agenda', 'cuando hay turno'
        ],
        'hours' => [
            'horario', 'hora atencion', 'cuando atienden', 'abierto', 'cerrado', 'dias', 'feriado',
            'sabado', 'domingo', 'fin de semana', 'que hora', 'atendiendo'
        ],
        'location' => [
            'donde', 'ubicacion', 'direccion', 'lugar', 'mapa', 'como llegar', 'quito', 'sector',
            'calle', 'edificio', 'donde quedan', 'donde estan', 'local', 'consultorio'
        ],
        'doctors' => [
            'doctor', 'medico', 'especialista', 'rosero', 'narvaez', 'quien atiende', 'dermatologo',
            'profesional', 'experiencia', 'curriculum', 'javier', 'carolina'
        ],
        // --- Medical Topics ---
        'acne' => [
            'acne', 'granos', 'espinillas', 'barros', 'manchas de acne', 'cicatrices', 'puntos negros',
            'comedones', 'brote', 'cara grasosa', 'piel grasa'
        ],
        'laser' => [
            'laser', 'cicatrices', 'depilacion', 'manchas', 'vascular', 'co2', 'fraccionado',
            'luz pulsada', 'ipl', 'marcas', 'quemaduras', 'lunares'
        ],
        'rejuvenation' => [
            'rejuvenecimiento', 'arrugas', 'botox', 'relleno', 'antiage', 'joven', 'flacidez',
            'surcos', 'patas de gallo', 'lineas de expresion', 'hialuronico', 'toxina', 'bioestimuladores'
        ],
        'rosacea' => ['rosacea', 'cara roja', 'rubor', 'venitas', 'ardor cara', 'piel sensible', 'cuperosis'],
        'melasma' => ['melasma', 'paño', 'manchas oscuras', 'manchas sol', 'pigmentacion', 'manchas embarazo'],
        'hair_loss' => ['caida cabello', 'alopecia', 'calvicie', 'se me cae el pelo', 'pelo fino', 'entradas', 'se me cae', 'cabello'],
        'warts' => ['verrugas', 'mezquinos', 'lunares carne', 'papilomas', 'fibromas'],
        'telemedicine' => ['online', 'virtual', 'video', 'remota', 'telemedicina', 'whatsapp', 'llamada', 'distancia', 'zoom'],

        // --- Logistics ---
        'payment' => ['pago', 'pagar', 'tarjeta', 'transferencia', 'efectivo', 'deposito', 'factura', 'metodos', 'visa'],
        'cancellation' => ['cancelar', 'anular', 'no puedo ir', 'suspender', 'dar de baja', 'borrar cita'],
        'rescheduling' => ['reprogramar', 'cambiar fecha', 'mover cita', 'postergar', 'otra fecha'],
        'contact' => ['telefono', 'celular', 'whatsapp', 'correo', 'email', 'contacto', 'llamar'],
        'out_of_scope' => [
            'capital', 'presidente', 'noticia', 'deporte', 'futbol', 'bitcoin', 'politica',
            'gobierno', 'elecciones', 'mundial', 'messi', 'ronaldo', 'cripto', 'ethereum',
            'religion', 'dios', 'jesus', 'biblia',
            'receta de cocina', 'como cocinar', 'restaurante', 'comida',
            'peliculas', 'cine', 'netflix', 'series', 'musica', 'cancion'
        ],
        'thanks' => ['gracias', 'ok', 'listo', 'perfecto', 'excelente', 'muy amable', 'chevere']
    ];

    // ==============================================================================
    // CORE PROCESSING
    // ==============================================================================

    public static function process(array $messages): array
    {
        $history = array_reverse($messages);
        $lastUserMessage = '';
        $previousUserMessage = '';

        // Simple Context Extraction
        foreach ($history as $msg) {
            if (($msg['role'] ?? '') === 'user') {
                if ($lastUserMessage === '') {
                    $lastUserMessage = (string) ($msg['content'] ?? '');
                } elseif ($previousUserMessage === '') {
                    $previousUserMessage = (string) ($msg['content'] ?? '');
                    break;
                }
            }
        }

        if ($lastUserMessage === '') {
            return self::buildResponse(self::getGreeting());
        }

        $intent = self::detectIntent($lastUserMessage);

        // Contextual Intent Refinement
        if (in_array($intent, ['acne', 'laser', 'rejuvenation', 'rosacea', 'melasma', 'hair_loss', 'warts', 'telemedicine', 'services'])) {
            $prevIntent = self::detectIntent($previousUserMessage);
            if ($prevIntent === 'pricing') {
                $intent = 'pricing_specific';
            } elseif ($prevIntent === 'booking') {
                $intent = 'booking'; // Stick to booking if they were in that flow
            }
        }

        $response = self::generateResponse($intent, $lastUserMessage);
        return self::buildResponse($response);
    }

    // ==============================================================================
    // INTELLIGENCE: INTENT DETECTION
    // ==============================================================================

    private static function detectIntent(string $message): string
    {
        $normalized = self::normalize($message);
        $scores = [];

        foreach (self::INTENTS as $intent => $keywords) {
            $scores[$intent] = 0;
            foreach ($keywords as $keyword) {
                // Strategy 1: Exact Phrase / Word Boundary Match (Highest Precision)
                // Use \b to ensure "hi" doesn't match "hialuronico"
                if (preg_match('/\b' . preg_quote($keyword, '/') . '\b/', $normalized)) {
                    $baseScore = 3;
                    // Boost multi-word specific phrases (e.g., "dolor intenso" > "dolor")
                    if (str_word_count($keyword) > 1) {
                        $baseScore += 2;
                    }
                    $scores[$intent] += $baseScore;
                }
                // Strategy 2: Fuzzy Logic for Typos (Levenshtein)
                // Only triggers for longer words to avoid noise
                elseif (strlen($keyword) > 4) {
                    $words = explode(' ', $normalized);
                    foreach ($words as $word) {
                        if (abs(strlen($word) - strlen($keyword)) > 2) {
                            continue;
                        }
                        $dist = levenshtein($keyword, $word);
                        if ($dist <= 1) { // 1 char error allowed
                            $scores[$intent] += 2;
                            break;
                        }
                    }
                }
            }
        }

        // Strategy 3: Semantic & Contextual Boosters
        if (preg_match('/\b(cuanto|que)\s+(cuesta|sale|vale)\b/', $normalized)) {
            $scores['pricing'] += 4;
        }
        if (preg_match('/\b(quiero|necesito|sacar)\s+(una\s+)?(cita|consulta|turno)\b/', $normalized)) {
            $scores['booking'] += 4;
        }
        if (preg_match('/\b(hoy|ahora|mañana|abierto|atienden)\b/', $normalized) && ($scores['hours'] ?? 0) > 0) {
            $scores['hours'] += 3;
        }
        // Emergency Override
        if (($scores['emergency'] ?? 0) > 0) {
            return 'emergency'; // Immediate exit for safety
        }

        arsort($scores);
        $bestIntent = key($scores);

        return ($scores[$bestIntent] > 0) ? $bestIntent : 'unknown';
    }

    // ==============================================================================
    // CONTENT GENERATION
    // ==============================================================================

    private static function generateResponse(string $intent, string $message): string
    {
        // Dynamic Data
        $pConsult = self::getPrice('consulta', '$40.00');
        $pOnline = self::getPrice('video', '$30.00');
        $pPhone = self::getPrice('telefono', '$25.00');
        $pAcne = self::getPrice('acne', '$80.00 (aprox)');
        $pLaser = self::getPrice('laser', '$172.50 (aprox)');
        $pRejuv = self::getPrice('rejuvenecimiento', '$138.00 (aprox)');

        switch ($intent) {
            case 'emergency':
                return "🚨 **IMPORTANTE: Mensaje de Seguridad**\n\n" .
                       "Si estás experimentando una emergencia médica, dolor insoportable, sangrado profuso o dificultad para respirar, por favor **acude inmediatamente a urgencias** o llama al 911.\n\n" .
                       "Soy una inteligencia artificial y no puedo brindar asistencia en emergencias vitales.\n\n" .
                       "Si es una urgencia dermatológica menor, por favor contáctanos directo al WhatsApp: [+593 98 245 3672](https://wa.me/" . ClinicConfig::getWhatsappNumber() . ").";

            case 'greeting':
                return self::getGreeting();

            case 'identity':
                return "Soy **Figo**, el Concierge Digital de Aurora Derm. 🤖✨\n\n" .
                       "Mi misión es brindarte la misma calidez y excelencia que encontrarás en nuestra clínica.\n" .
                       "Puedo asistirte con citas, precios, dudas médicas básicas y ubicación.\n\n" .
                       "¿Cómo puedo hacer tu día mejor hoy?";

            case 'escalation':
                return "Siento mucho que estés pasando por esta situación. En Aurora Derm, tu satisfacción es absoluta prioridad. 🙏\n\n" .
                       "He marcado este tema como prioritario. Por favor, contacta directamente a nuestra **Gerencia de Atención al Paciente**:\n\n" .
                       "👉 **[WhatsApp Directo de Soporte](https://wa.me/" . ClinicConfig::getWhatsappNumber() . ")**\n\n" .
                       "Un miembro humano de nuestro equipo resolverá esto de inmediato.";

            case 'handoff':
                return "Entiendo que prefieres hablar con una persona. 👩‍💻\n\n" .
                       "Puedes chatear directamente con nuestro equipo humano por WhatsApp aquí:\n\n" .
                       "👉 **[Abrir Chat de WhatsApp](https://wa.me/" . ClinicConfig::getWhatsappNumber() . ")**\n\n" .
                       "O si prefieres, déjanos tu número y te llamamos en breve.";

                // --- Trust & Authority ---
            case 'trust_why_us':
                return "Elegir **Aurora Derm** es elegir excelencia médica y calidez humana. 💎\n\n" .
                       "✨ **Experiencia:** Más de 15 años cuidando la salud de la piel.\n" .
                       "✨ **Tecnología:** Contamos con láseres de última generación (Fotona, CO2) y diagnóstico digital.\n" .
                       "✨ **Enfoque Integral:** No solo tratamos síntomas, buscamos la causa raíz para resultados duraderos.\n\n" .
                       "¿Te gustaría agendar una cita y vivir la experiencia?";

            case 'technology':
                return "Nuestra clínica está equipada con tecnología de vanguardia mundial: 🔬\n\n" .
                       "🔹 **Láser CO2 Fraccionado:** El estándar de oro para rejuvenecimiento y cicatrices.\n" .
                       "🔹 **Dermatoscopia Digital:** Para la detección temprana y precisa de lunares y cáncer de piel.\n" .
                       "🔹 **Cabinas de Fototerapia:** Para vitíligo y psoriasis.\n\n" .
                       "Invertimos en lo mejor porque tu piel merece lo mejor.";

                // --- Core Business ---
            case 'pricing':
            case 'pricing_specific':
                return "La transparencia es parte de nuestro servicio. Aquí tienes nuestros valores referenciales (incluyen IVA): 🏷️\n\n" .
                       "📋 **Consultas Especializadas:**\n" .
                       "- Presencial: **{$pConsult}**\n" .
                       "- Videoconsulta: **{$pOnline}**\n\n" .
                       "💉 **Programas y Tratamientos (desde):**\n" .
                       "- Acné Integral: **{$pAcne}**\n" .
                       "- Láser CO2: **{$pLaser}**\n" .
                       "- Rejuvenecimiento: **{$pRejuv}**\n\n" .
                       "💡 *Cada piel es única. El valor exacto del tratamiento se define tras la valoración médica.*\n\n" .
                       "¿Deseas reservar tu cita de evaluación ahora?";

            case 'services':
                return "En **Aurora Derm**, fusionamos ciencia y estética. Nuestros pilares son: ✨\n\n" .
                       "🔹 **Dermatología Clínica:** Acné, Rosácea, Alergias, Caída de Cabello, Lunares.\n" .
                       "🔹 **Dermatología Estética:** Rejuvenecimiento Natural, Botox, Ácido Hialurónico.\n" .
                       "🔹 **Láser y Tecnología:** Cicatrices, Manchas, Lesiones Vasculares.\n\n" .
                       "¿Hay alguna condición específica que te preocupe?";

            case 'booking':
                return "¡Maravillosa elección! Estás a un paso de la mejor versión de tu piel. 🌟\n\n" .
                       "Nuestra agenda online está abierta 24/7 para ti:\n\n" .
                       "👉 **[Solicitar disponibilidad]( " . app_api_absolute_url('appointments') . " )**\n\n" .
                       "El proceso es simple: Eliges servicio, doctor y tu hora ideal. ¡Te esperamos!";

            case 'payment':
                return "Facilitamos tu experiencia con múltiples opciones de pago seguras: 💳\n\n" .
                       "✅ **Online:** Tarjeta de Crédito/Débito o Transferencia (al reservar).\n" .
                       "✅ **Presencial:** Efectivo y todas las tarjetas.\n\n" .
                       "Emitimos factura electrónica automáticamente. ¿Te ayudo a reservar?";

            case 'hours':
                $status = self::getOpeningStatus();
                return "⏰ **Horarios de Atención Exclusiva:**\n\n" .
                       "🔹 Lunes a Viernes: 09:00 - 18:00\n" .
                       "🔹 Sábados: 09:00 - 13:00\n\n" .
                       "{$status}\n\n" .
                       "Te recomendamos agendar con anticipación para asegurar tu espacio.";

            case 'location':
                return "📍 **Nuestra Sede:**\n\n" .
                       "Estamos ubicados en el centro médico más moderno de Quito:\n" .
                       "**Edificio Citimed, Consultorio 312**\n" .
                       "Av. Mariana de Jesús y Nuño de Valderrama.\n\n" .
                       "🚗 Contamos con parqueadero privado y seguridad 24h.\n" .
                       "🗺️ **[Ver en Google Maps](https://goo.gl/maps/pielarmonia)**";

            case 'doctors':
                return "Tu piel estará en manos de expertos reconocidos: 👨‍⚕️👩‍⚕️\n\n" .
                       "**Dr. Javier Rosero**\n" .
                       "Especialista en Dermatología Clínica y Quirúrgica. Experto en casos complejos y cáncer de piel.\n\n" .
                       "**Dra. Carolina Narváez**\n" .
                       "Especialista en Dermatología Estética y Láser. Su enfoque es la elegancia y naturalidad.\n\n" .
                       "Ambos comparten una filosofía de ética y excelencia.";

                // --- Medical Topics (Expanded) ---
            case 'acne':
                return "El **Acné** no es solo estético, es salud. 🌿\n\n" .
                       "Nuestro enfoque es 360°: tratamos la inflamación, prevenimos cicatrices y restauramos la textura de tu piel con medicación + tecnología.\n\n" .
                       "Inversión referencial: **{$pAcne}**.\n" .
                       "¿Empezamos tu cambio hoy?";

            case 'rosacea':
                return "Entendemos lo molesto de la **Rosácea** (piel sensible/roja). 🌸\n\n" .
                       "Utilizamos láser vascular específico para cerrar las venitas y calmar la inflamación de forma duradera.\n\n" .
                       "Es vital usar protector solar. ¿Te gustaría que un especialista evalúe tu grado de rosácea?";

            case 'melasma':
                return "El **Melasma** (manchas) requiere un manejo experto y constante. ☀️\n\n" .
                       "Combinamos peelings suaves, láser y despigmentantes para unificar tu tono sin agredir tu piel.\n\n" .
                       "Agenda tu valoración para diseñar tu protocolo personalizado.";

            case 'hair_loss':
                return "La **Caída de Cabello** tiene solución si se trata a tiempo. 💇‍♂️\n\n" .
                       "Realizamos **Tricoscopia Digital** (análisis de la raíz) para definir si necesitas mesoterapia, plasma o tratamiento oral.\n\n" .
                       "Consulta de valoración: **{$pConsult}**.";

            case 'warts':
                return "Eliminamos **Verrugas y Lunares** con precisión milimétrica usando láser o electrocirugía. ✨\n\n" .
                       "El procedimiento es rápido, seguro y con excelente resultado estético.\n\n" .
                       "El costo depende de la cantidad. ¿Deseas una cita de evaluación?";

            case 'laser':
                return "La magia de la luz en tu piel. Nuestro **Láser CO2** es tecnología premium para: ✨\n\n" .
                       "- Rejuvenecimiento profundo.\n" .
                       "- Borrar cicatrices de acné.\n" .
                       "- Eliminar estrías.\n\n" .
                       "Sesión referencial: **{$pLaser}**.\n" .
                       "Requiere evaluación previa para garantizar seguridad.";

            case 'rejuvenation':
                return "Rejuvenecimiento con el sello **Aurora Derm**: Natural y Elegante. 🌟\n\n" .
                       "Diseñamos un plan según tu rostro:\n" .
                       "- **Botox:** Relaja la mirada.\n" .
                       "- **Hialurónico:** Restaura volumen.\n" .
                       "- **Bioestimuladores:** Firmeza real.\n\n" .
                       "Desde: **{$pRejuv}**.";

            case 'telemedicine':
                return "💻 **Dermatología Online:** Calidad médica sin salir de casa.\n\n" .
                       "Ideal para segundas opiniones, acné o revisiones. Recibes tu diagnóstico y receta digital válida.\n" .
                       "Valor: **{$pOnline}**.\n\n" .
                       "Puedes agendar seleccionando 'Videoconsulta' en la web.";

            case 'contact':
                return "Estamos a un mensaje de distancia. 📱\n\n" .
                       "💬 **WhatsApp:** [+593 98 245 3672](https://wa.me/" . ClinicConfig::getWhatsappNumber() . ")\n" .
                       "📞 **Llamadas:** 098 245 3672\n" .
                       "📧 **Email:** info@pielarmonia.com\n\n" .
                       "Escríbenos, nos encantará atenderte.";

            case 'out_of_scope':
                return "Soy un asistente especializado en dermatología y servicios de **Aurora Derm**. 🩺\n\n" .
                       "Aunque me encantaría conversar sobre otros temas, mi función es ayudarte con:\n" .
                       "- Citas y Horarios\n" .
                       "- Precios de Tratamientos\n" .
                       "- Dudas sobre el cuidado de tu piel\n\n" .
                       "¿En qué puedo asistirte respecto a nuestra clínica?";

            case 'cancellation':
            case 'rescheduling':
                return "Entendemos los cambios de planes. 🗓️\n\n" .
                       "Para reprogramar, usa el enlace en tu correo de confirmación. Si necesitas ayuda manual, escríbenos al WhatsApp +593 98 245 3672.";

            case 'thanks':
                return "¡Gracias a ti por confiar en Aurora Derm! 💖\n\n" .
                       "Estamos aquí para cuidarte. ¡Que tengas un día radiante!";

            default:
                return "Entiendo. Para guiarte con la precisión que mereces, te sugiero:\n\n" .
                       "1. **[Estado del servicio](" . app_api_absolute_url('health') . ")**\n" .
                       "2. **[Ver disponibilidad](" . app_api_absolute_url('appointments') . ")**\n" .
                       "3. **[Contactar por WhatsApp](https://wa.me/" . ClinicConfig::getWhatsappNumber() . ")**\n\n" .
                       "¿Te gustaría información sobre precios o ubicación?";
        }
    }

    // ==============================================================================
    // UTILITIES
    // ==============================================================================

    private static function getGreeting(): string
    {
        $hour = (int) date('G');
        $timeGreeting = 'Hola';
        if ($hour >= 5 && $hour < 12) {
            $timeGreeting = 'Buenos días';
        } elseif ($hour >= 12 && $hour < 19) {
            $timeGreeting = 'Buenas tardes';
        } else {
            $timeGreeting = 'Buenas noches';
        }

        return "¡{$timeGreeting}! Bienvenido a **Aurora Derm**. 🌿\n\n" .
               "Soy Figo, tu Concierge Dermatológico. Estoy aquí para ayudarte a agendar, consultar precios o resolver dudas sobre tu piel.\n\n" .
               "¿En qué puedo servirte hoy?";
    }

    private static function normalize(string $text): string
    {
        $text = strtolower($text);
        $text = str_replace(
            ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü'],
            ['a', 'e', 'i', 'o', 'u', 'n', 'u'],
            $text
        );
        return preg_replace('/[^a-z0-9\s]/', '', $text);
    }

    private static function getPrice(string $service, string $default): string
    {
        if (function_exists('get_service_total_price')) {
            $price = get_service_total_price($service);
            if ($price !== '$0.00' && $price !== '$0') {
                return $price;
            }
        }
        return $default;
    }

    private static function getOpeningStatus(): string
    {
        try {
            $tz = new DateTimeZone('America/Guayaquil');
            $now = new DateTime('now', $tz);
            $day = (int) $now->format('N');
            $hour = (int) $now->format('G');
        } catch (Throwable $e) {
            $day = (int) date('N');
            $hour = (int) date('G');
        }

        if ($day === 7) {
            return "🔴 Hoy domingo descansamos. Te esperamos mañana.";
        }

        $isOpen = false;
        if ($day >= 1 && $day <= 5 && $hour >= 9 && $hour < 18) {
            $isOpen = true;
        }
        if ($day === 6 && $hour >= 9 && $hour < 13) {
            $isOpen = true;
        }

        return $isOpen
            ? "✅ **Estamos abiertos ahora.**"
            : "🔴 **Ahora estamos cerrados.**";
    }

    private static function buildResponse(string $content): array
    {
        try {
            $id = 'figo-local-' . bin2hex(random_bytes(8));
        } catch (Throwable $e) {
            $id = 'figo-local-' . substr(md5((string) microtime(true)), 0, 16);
        }

        return [
            'id' => $id,
            'object' => 'chat.completion',
            'created' => time(),
            'model' => 'figo-brain-v3-concierge',
            'choices' => [[
                'index' => 0,
                'message' => [
                    'role' => 'assistant',
                    'content' => $content
                ],
                'finish_reason' => 'stop'
            ]]
        ];
    }
}
