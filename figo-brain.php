<?php
declare(strict_types=1);

/**
 * FigoBrain: Local Intelligence for Piel en Armonía Chatbot.
 * "El alma de la página web": Professional, Empathetic, Precise, and Aware.
 */

class FigoBrain
{
    private const INTENTS = [
        'greeting' => [
            'hola', 'buenos dias', 'buenas tardes', 'buenas noches', 'hey', 'hi', 'hello', 'saludos',
            'que tal', 'como estas', 'buen dia', 'buenas'
        ],
        'identity' => [
            'quien eres', 'eres un bot', 'eres ia', 'como te llamas', 'tu nombre', 'quien me atiende',
            'hablo con una persona', 'eres real', 'sos real'
        ],
        'pricing' => [
            'precio', 'cuanto cuesta', 'valor', 'tarifa', 'costo', 'presupuesto', 'cotizacion',
            'cuanto vale', 'precios', 'honorarios', 'me cobra', 'cuanto sale', 'a como', 'cobran'
        ],
        'services' => [
            'servicios', 'tratamientos', 'que hacen', 'que ofrecen', 'procedimientos', 'especialidades',
            'que atienden', 'catalogo', 'portafolio', 'hacen'
        ],
        'booking' => [
            'cita', 'agendar', 'reservar', 'turno', 'hora', 'quiero una consulta', 'sacar turno',
            'pedir hora', 'consulta medica', 'quiero ir', 'disponibilidad', 'agenda', 'cuando hay turno'
        ],
        'payment' => [
            'pago', 'pagar', 'tarjeta', 'transferencia', 'efectivo', 'deposito', 'factura', 'comprobante',
            'metodos de pago', 'aceptan', 'forma de pago', 'visa', 'mastercard', 'banco'
        ],
        'location' => [
            'donde', 'ubicacion', 'direccion', 'lugar', 'mapa', 'como llegar', 'quito', 'sector',
            'calle', 'edificio', 'donde quedan', 'donde estan', 'local', 'consultorio'
        ],
        'hours' => [
            'horario', 'hora atencion', 'cuando atienden', 'abierto', 'cerrado', 'dias', 'feriado',
            'sabado', 'domingo', 'fin de semana', 'que hora', 'atendiendo'
        ],
        'doctors' => [
            'doctor', 'medico', 'especialista', 'rosero', 'narvaez', 'quien atiende', 'dermatologo',
            'profesional', 'experiencia', 'curriculum', 'javier', 'carolina'
        ],
        // Medical Topics
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
        'rosacea' => [
            'rosacea', 'cara roja', 'rubor', 'venitas', 'ardor cara', 'piel sensible', 'cuperosis'
        ],
        'melasma' => [
            'melasma', 'paño', 'manchas oscuras', 'manchas sol', 'pigmentacion', 'manchas embarazo'
        ],
        'hair_loss' => [
            'caida cabello', 'alopecia', 'calvicie', 'se me cae el pelo', 'pelo fino', 'entradas',
            'se me cae', 'caida de pelo', 'cabello'
        ],
        'warts' => [
            'verrugas', 'mezquinos', 'lunares carne', 'papilomas', 'fibromas'
        ],
        'telemedicine' => [
            'online', 'virtual', 'video', 'remota', 'telemedicina', 'whatsapp', 'llamada',
            'distancia', 'internet', 'videollamada', 'zoom'
        ],
        'cancellation' => [
            'cancelar', 'anular', 'no puedo ir', 'suspender', 'dar de baja', 'borrar cita'
        ],
        'rescheduling' => [
            'reprogramar', 'cambiar fecha', 'mover cita', 'postergar', 'otra fecha', 'cambiar hora', 'atrasar', 'adelantar'
        ],
        'contact' => [
            'telefono', 'celular', 'whatsapp', 'correo', 'email', 'contacto', 'llamar', 'escribir',
            'numero', 'mail', 'info'
        ],
        'thanks' => [
            'gracias', 'ok', 'listo', 'perfecto', 'excelente', 'muy amable', 'chevere', 'grac', 'thanks', 'thank you'
        ],
        // Sentiment - Escalation
        'escalation' => [
            'queja', 'reclamo', 'mal servicio', 'pesimo', 'enojado', 'molesto', 'nadie contesta',
            'ayuda humana', 'quiero hablar con alguien', 'persona real', 'no entiendo', 'basura', 'estafa'
        ]
    ];

    public static function process(array $messages): array
    {
        $history = array_reverse($messages);
        $lastUserMessage = '';
        $previousUserMessage = '';
        $lastAssistantMessage = '';

        foreach ($history as $msg) {
            $role = $msg['role'] ?? '';
            $content = (string) ($msg['content'] ?? '');

            if ($role === 'user') {
                if ($lastUserMessage === '') {
                    $lastUserMessage = $content;
                } elseif ($previousUserMessage === '') {
                    $previousUserMessage = $content;
                }
            } elseif ($role === 'assistant' && $lastAssistantMessage === '') {
                $lastAssistantMessage = $content;
            }
        }

        if ($lastUserMessage === '') {
            return self::buildResponse('Hola, soy el asistente virtual de Piel en Armonía. ¿En qué puedo ayudarte hoy?');
        }

        $intent = self::detectIntent($lastUserMessage);

        // Context Awareness
        if (in_array($intent, ['acne', 'laser', 'rejuvenation', 'rosacea', 'melasma', 'hair_loss', 'warts', 'telemedicine', 'services'])) {
            $previousIntent = self::detectIntent($previousUserMessage);
            if ($previousIntent === 'pricing') {
                $intent = 'pricing_specific';
            } elseif ($previousIntent === 'booking') {
                $intent = 'booking';
            }
        }

        $response = self::generateResponse($intent, $lastUserMessage);

        return self::buildResponse($response);
    }

    private static function detectIntent(string $message): string
    {
        $normalized = self::normalize($message);
        $scores = [];

        foreach (self::INTENTS as $intent => $keywords) {
            $scores[$intent] = 0;
            foreach ($keywords as $keyword) {
                // 1. Exact/Boundary Match
                if (preg_match('/\b' . preg_quote($keyword, '/') . '\b/', $normalized)) {
                    $score = 3;
                    // Boost multi-word matches (phrase is more specific than word)
                    if (str_word_count($keyword) > 1) {
                        $score += 2;
                    }
                    $scores[$intent] += $score;
                }
                // 2. Fuzzy Match (Levenshtein) for typos
                // Only for keywords > 4 chars to avoid false positives on short words
                elseif (strlen($keyword) > 4) {
                    $dist = levenshtein($keyword, $normalized); // Naive whole-string check? No, need word check.
                    // Let's check against words in the message
                    $words = explode(' ', $normalized);
                    foreach ($words as $word) {
                        if (abs(strlen($word) - strlen($keyword)) > 2) continue; // Skip if length diff is big

                        $dist = levenshtein($keyword, $word);
                        if ($dist <= 1) { // 1 char diff allowed
                            $scores[$intent] += 2;
                            break; // Match found for this keyword
                        }
                    }
                }
            }
        }

        // Semantic Boosters
        if (preg_match('/\b(cuanto|que)\s+(cuesta|sale|vale)\b/', $normalized)) {
            $scores['pricing'] += 3;
        }
        if (preg_match('/\b(quiero|necesito)\s+(una\s+)?(cita|consulta|turno)\b/', $normalized)) {
            $scores['booking'] += 3;
        }
        // Boost Escalation for strong negative keywords
        if (preg_match('/\b(nadie|no)\s+(contesta|responde)\b/', $normalized)) {
            $scores['escalation'] += 5;
        }
        // Temporal Booster
        if (preg_match('/\b(hoy|ahora|mañana|abierto|atienden)\b/', $normalized) && $scores['hours'] > 0) {
            $scores['hours'] += 2;
        }

        arsort($scores);
        $bestIntent = key($scores);

        return $scores[$bestIntent] > 0 ? $bestIntent : 'unknown';
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
            $day = (int) $now->format('N'); // 1 (Mon) - 7 (Sun)
            $hour = (int) $now->format('G'); // 0-23
        } catch (Throwable $e) {
            // Fallback if timezone invalid
            $day = (int) date('N');
            $hour = (int) date('G');
        }

        if ($day === 7) {
            return "Hoy domingo estamos cerrados. Atendemos de lunes a sábado.";
        }

        $isOpen = false;
        $closeTime = '';

        if ($day >= 1 && $day <= 5) { // Mon-Fri
            if ($hour >= 9 && $hour < 18) {
                $isOpen = true;
                $closeTime = '18:00';
            }
        } elseif ($day === 6) { // Sat
            if ($hour >= 9 && $hour < 13) {
                $isOpen = true;
                $closeTime = '13:00';
            }
        }

        if ($isOpen) {
            return "✅ **Sí, estamos atendiendo ahora.** Cerramos a las {$closeTime}.";
        } else {
            return "🔴 **En este momento estamos cerrados.**";
        }
    }

    private static function generateResponse(string $intent, string $message): string
    {
        // Safe Dynamic Pricing Helpers
        $pConsult = self::getPrice('consulta', '$44.80');
        $pOnline = self::getPrice('video', '$33.60');
        $pPhone = self::getPrice('telefono', '$28.00');
        $pAcne = self::getPrice('acne', '$89.60 (aprox)');
        $pLaser = self::getPrice('laser', '$168.00 (aprox)');
        $pRejuv = self::getPrice('rejuvenecimiento', '$134.40 (aprox)');

        switch ($intent) {
            case 'greeting':
                return "¡Hola! Bienvenido a **Piel en Armonía**. 🌿\n\n" .
                       "Soy Figo, tu asistente dermatológico. ¿En qué te puedo ayudar hoy?\n\n" .
                       "1. 📅 **Agendar Cita**\n" .
                       "2. 💰 **Precios y Servicios**\n" .
                       "3. 📍 **Ubicación**\n" .
                       "4. 🧴 **Tratamientos (Acné, Manchas, Caída de Cabello)**";

            case 'identity':
                return "Soy **Figo**, la inteligencia artificial de Piel en Armonía. 🤖\n\n" .
                       "Estoy diseñado para ayudarte a agendar citas y resolver dudas rápidamente. Si prefieres hablar con una persona, escribe 'Contacto' y te paso el WhatsApp.";

            case 'escalation':
                return "Lamento mucho que tengas inconvenientes. 🙏\n\n" .
                       "Por favor, escríbenos directamente a nuestro **WhatsApp de Gerencia/Atención al Cliente** para resolverlo de inmediato:\n\n" .
                       "👉 **[Clic aquí para hablar con un humano (+593 98 245 3672)](https://wa.me/593982453672)**\n\n" .
                       "Tu satisfacción es nuestra prioridad.";

            case 'pricing':
            case 'pricing_specific':
                return "Aquí tienes nuestros valores referenciales (incluyen IVA): 🏷️\n\n" .
                       "📋 **Consultas:**\n" .
                       "- Presencial: **{$pConsult}**\n" .
                       "- Online: **{$pOnline}**\n\n" .
                       "💉 **Tratamientos (desde):**\n" .
                       "- Acné: **{$pAcne}**\n" .
                       "- Láser CO2: **{$pLaser}**\n" .
                       "- Rejuvenecimiento: **{$pRejuv}**\n\n" .
                       "¿Te gustaría agendar para que el doctor evalúe tu caso exacto?";

            case 'services':
                return "**Nuestros Servicios Dermatológicos:** ✨\n\n" .
                       "🔸 **Clínica:** Acné, Rosácea, Manchas, Verrugas, Caída de Cabello, Alergias.\n" .
                       "🔸 **Estética:** Rejuvenecimiento, Botox, Rellenos, Láser CO2.\n" .
                       "🔸 **Prevención:** Chequeo de lunares y cáncer de piel.\n\n" .
                       "¿Sobre cuál te gustaría más información?";

            case 'booking':
                return "¡Perfecto! Vamos a cuidar tu piel. 💆‍♀️\n\n" .
                       "Agenda tu cita en línea de forma segura:\n" .
                       "👉 **[Reservar Cita Ahora](https://pielarmonia.com/#citas)**\n\n" .
                       "Eliges servicio, doctor y horario al instante. ¿Necesitas ayuda?";

            case 'location':
                return "📍 **Ubicación:**\n\n" .
                       "Edificio Citimed, Consultorio 312.\n" .
                       "Av. Mariana de Jesús y Nuño de Valderrama (Quito).\n" .
                       "🗺️ **[Abrir Mapa](https://goo.gl/maps/pielarmonia)**\n\n" .
                       "Contamos con parqueadero.";

            case 'hours':
                $status = self::getOpeningStatus();
                return "⏰ **Horarios de Atención:**\n\n" .
                       "🔹 Lunes a Viernes: 09:00 - 18:00\n" .
                       "🔹 Sábados: 09:00 - 13:00\n\n" .
                       "{$status}\n\n" .
                       "Recuerda que atendemos previa cita.";

            case 'doctors':
                return "Nuestro equipo médico: 👨‍⚕️👩‍⚕️\n\n" .
                       "**Dr. Javier Rosero:** Dermatólogo Clínico y Cirujano. Experto en enfermedades de la piel.\n" .
                       "**Dra. Carolina Narváez:** Dermatóloga Estética. Experta en láser y rejuvenecimiento.\n\n" .
                       "Ambos son excelentes profesionales.";

            // --- Medical Topics ---

            case 'acne':
                return "El **Acné** es nuestra especialidad. 🌟\n\n" .
                       "Ofrecemos un tratamiento integral que combina medicación, limpiezas y tecnología para eliminar brotes y secuelas.\n\n" .
                       "Precio base del programa: **{$pAcne}**.\n" .
                       "¿Te gustaría agendar una evaluación?";

            case 'rosacea':
                return "Para la **Rosácea** (cara roja/sensible), usamos tecnología láser vascular y tratamientos calmantes para reducir el enrojecimiento y fortalecer tu piel.\n\n" .
                       "Es importante evitar el sol y el calor. ¿Deseas agendar una cita?";

            case 'melasma':
                return "El **Melasma** (manchas) requiere constancia. Combinamos peelings, láser y cremas despigmentantes médicas para unificar tu tono de forma segura.\n\n" .
                       "El uso de protector solar es vital. Agenda tu valoración para ver qué tipo de mancha tienes.";

            case 'hair_loss':
                return "La **Caída de Cabello** (Alopecia) debe tratarse a tiempo. Realizamos tricoscopia digital para ver la raíz y aplicamos mesoterapia o plasma para fortalecerlo.\n\n" .
                       "Consulta Presencial: **{$pConsult}**.";

            case 'warts':
                return "Eliminamos **Verrugas y Lunares** de forma rápida y segura con láser o electrocirugía, con mínima molestia y excelente cicatrización.\n\n" .
                       "El costo depende del número y tamaño de las lesiones. Te sugiero agendar una consulta.";

            case 'laser':
                return "Nuestro **Láser CO2** es ideal para:\n" .
                       "- Rejuvenecimiento facial.\n" .
                       "- Cicatrices de acné profundas.\n" .
                       "- Estrías y marcas.\n\n" .
                       "Precio sesión: **{$pLaser}** (aprox). Requiere valoración previa.";

            case 'rejuvenation':
                return "Rejuvenecimiento Natural: 🌸\n" .
                       "- **Botox:** Adiós arrugas de expresión.\n" .
                       "- **Hialurónico:** Volumen e hidratación.\n" .
                       "- **Bioestimuladores:** Firmeza a largo plazo.\n\n" .
                       "Precio desde: **{$pRejuv}**.";

            case 'telemedicine':
                return "💻 **Videoconsulta Dermatológica:**\n" .
                       "Diagnóstico y receta digital sin salir de casa. Ideal para revisiones, acné o consultas rápidas.\n" .
                       "Valor: **{$pOnline}**.";

            case 'contact':
                return "Contáctanos: 📱\n" .
                       "WhatsApp: [+593 98 245 3672](https://wa.me/593982453672)\n" .
                       "Teléfono: 098 245 3672\n" .
                       "Email: info@pielarmonia.com";

            case 'cancellation':
            case 'rescheduling':
                return "Para cambios o cancelaciones, por favor usa el enlace en tu correo de confirmación o escríbenos al WhatsApp +593 98 245 3672.";

            case 'thanks':
                return "¡A ti! 😊 Estamos para servirte. ¡Que tengas un excelente día!";

            default:
                return "Entiendo. Para ayudarte mejor, elige una opción:\n\n" .
                       "1. **[Ver Servicios](https://pielarmonia.com/#servicios)**\n" .
                       "2. **[Agendar Cita](https://pielarmonia.com/#citas)**\n" .
                       "3. **[WhatsApp](https://wa.me/593982453672)**\n\n" .
                       "¿Sobre qué tema necesitas información?";
        }
    }

    private static function normalize(string $text): string
    {
        $text = strtolower($text);
        $text = str_replace(
            ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü'],
            ['a', 'e', 'i', 'o', 'u', 'n', 'u'],
            $text
        );
        // Remove special chars but keep spaces and alphanumeric
        return preg_replace('/[^a-z0-9\s]/', '', $text);
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
            'model' => 'figo-brain-ultimate',
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
