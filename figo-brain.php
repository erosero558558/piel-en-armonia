<?php
declare(strict_types=1);

/**
 * FigoBrain: Local Intelligence for Piel en Armonía Chatbot.
 * "El alma de la página web": Professional, Empathetic, and Precise.
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
            'sabado', 'domingo', 'fin de semana', 'que hora'
        ],
        'doctors' => [
            'doctor', 'medico', 'especialista', 'rosero', 'narvaez', 'quien atiende', 'dermatologo',
            'profesional', 'experiencia', 'curriculum', 'javier', 'carolina'
        ],
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

        // Context Awareness: If intent is weak or generic (like just a service name), check history.
        if (in_array($intent, ['acne', 'laser', 'rejuvenation', 'telemedicine', 'services'])) {
            $previousIntent = self::detectIntent($previousUserMessage);
            if ($previousIntent === 'pricing') {
                $intent = 'pricing_specific'; // Synthesize a combined intent
            } elseif ($previousIntent === 'booking') {
                $intent = 'booking'; // Assume they want to book this specific service
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
                // Word boundary matching for precision (no 'hi' in 'hialuronico')
                // Use \b to ensure we match whole words
                if (preg_match('/\b' . preg_quote($keyword, '/') . '\b/', $normalized)) {
                    $scores[$intent] += 1;
                    // Boost exact matches or start-of-string matches slightly
                    if ($normalized === $keyword || strpos($normalized, $keyword . ' ') === 0) {
                        $scores[$intent] += 2;
                    }
                }
            }
        }

        // Semantic Boosters - Specific Phrasing Overrides
        if (preg_match('/\b(cuanto|que)\s+(cuesta|sale|vale)\b/', $normalized)) {
            $scores['pricing'] += 3;
        }
        if (preg_match('/\b(quiero|necesito)\s+(una\s+)?(cita|consulta|turno)\b/', $normalized)) {
            $scores['booking'] += 3;
        }

        arsort($scores);
        $bestIntent = key($scores);

        return $scores[$bestIntent] > 0 ? $bestIntent : 'unknown';
    }

    private static function getPrice(string $service, string $default): string
    {
        if (function_exists('get_service_total_price')) {
            $price = get_service_total_price($service);
            // Handle edge case where function returns "$0.00" for unknown or base price logic
            if ($price !== '$0.00' && $price !== '$0') {
                return $price;
            }
        }
        return $default;
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
                       "Soy Figo, tu asistente dermatológico virtual. Estoy aquí para ayudarte con:\n\n" .
                       "📅 **Agendar Citas:** Presenciales y online.\n" .
                       "💰 **Precios:** Consultas y tratamientos.\n" .
                       "📍 **Ubicación:** Estamos en el sector La Carolina.\n" .
                       "✨ **Información:** Acné, Láser, Rejuvenecimiento.\n\n" .
                       "¿En qué puedo servirte hoy?";

            case 'identity':
                return "Soy **Figo**, la inteligencia artificial de Piel en Armonía. 🤖\n\n" .
                       "Aunque soy un asistente virtual, mi objetivo es brindarte la misma calidez y profesionalismo que nuestro equipo médico.\n\n" .
                       "Puedo ayudarte a agendar, darte precios o resolver dudas sobre nuestros servicios. ¿Qué necesitas?";

            case 'pricing':
            case 'pricing_specific':
                return "Con gusto te informo nuestros valores referenciales (incluyen IVA): 🏷️\n\n" .
                       "📋 **Consultas Médicas:**\n" .
                       "- Presencial: **{$pConsult}**\n" .
                       "- Videoconsulta: **{$pOnline}**\n" .
                       "- Telefónica: **{$pPhone}**\n\n" .
                       "💉 **Tratamientos (desde):**\n" .
                       "- Programa de Acné: **{$pAcne}**\n" .
                       "- Láser CO2 / Cicatrices: **{$pLaser}**\n" .
                       "- Rejuvenecimiento Facial: **{$pRejuv}**\n\n" .
                       "💡 *Nota: Para tratamientos específicos, el valor exacto se determina previa valoración médica.*\n\n" .
                       "¿Te gustaría agendar una cita de evaluación?";

            case 'services':
                return "En **Piel en Armonía**, cuidamos la salud y belleza de tu piel con tecnología de punta. ✨\n\n" .
                       "**Nuestras Especialidades:**\n" .
                       "✅ **Dermatología Clínica:** Control de acné, manchas, rosácea, alergias y lunares.\n" .
                       "✅ **Dermatología Estética:** Rejuvenecimiento, Toxina Botulínica (Botox), Ácido Hialurónico.\n" .
                       "✅ **Láser Avanzado:** Tratamiento de cicatrices, rejuvenecimiento y lesiones vasculares.\n\n" .
                       "¿Hay algún tratamiento en particular que te interese?";

            case 'booking':
                return "¡Excelente decisión! Cuidar tu piel es invertir en ti. 💆‍♀️\n\n" .
                       "Agendar es muy sencillo y seguro a través de nuestra web:\n\n" .
                       "👉 **[Haz clic aquí para Reservar tu Cita](https://pielarmonia.com/#citas)**\n\n" .
                       "El sistema te permitirá elegir:\n" .
                       "1. El servicio (Presencial u Online).\n" .
                       "2. El especialista de tu preferencia.\n" .
                       "3. El día y la hora que mejor se adapte a ti.\n\n" .
                       "¿Necesitas ayuda con el proceso?";

            case 'payment':
                return "Para tu facilidad, contamos con múltiples formas de pago seguras: 💳\n\n" .
                       "🔹 **En la Web:** Puedes pagar al momento de reservar con Tarjeta de Crédito/Débito (Visa/Mastercard) o Transferencia Bancaria.\n" .
                       "🔹 **En Consultorio:** Aceptamos efectivo y tarjetas.\n\n" .
                       "Todo el proceso es transparente y recibirás tu comprobante automáticamente. ¿Deseas reservar ahora?";

            case 'location':
                return "📍 **Nuestra Ubicación:**\n\n" .
                       "Nos encontramos en el corazón financiero de Quito:\n" .
                       "**Edificio Citimed, Consultorio 312**\n" .
                       "Av. Mariana de Jesús y Nuño de Valderrama (Frente al Hospital Metropolitano).\n\n" .
                       "🚗 **Parqueadero:** El edificio cuenta con parqueadero público seguro para pacientes.\n\n" .
                       "🗺️ **[Ver en Google Maps](https://goo.gl/maps/pielarmonia)**";

            case 'hours':
                return "⏰ **Horarios de Atención:**\n\n" .
                       "Estamos disponibles para ti en los siguientes horarios:\n" .
                       "🔹 **Lunes a Viernes:** 09:00 - 18:00\n" .
                       "🔹 **Sábados:** 09:00 - 13:00\n\n" .
                       "Recuerda que atendemos **previa cita** para brindarte una atención personalizada y sin esperas.";

            case 'doctors':
                return "Estás en las mejores manos. Nuestros especialistas son reconocidos por su experiencia y calidez humana: 👨‍⚕️👩‍⚕️\n\n" .
                       "**Dr. Javier Rosero**\n" .
                       "Dermatólogo Clínico y Cirujano Dermatólogo. Experto en patologías complejas, cáncer de piel y acné severo.\n\n" .
                       "**Dra. Carolina Narváez**\n" .
                       "Dermatóloga Estética. Especialista en armonización facial, láser y técnicas de rejuvenecimiento mínimamente invasivas.\n\n" .
                       "Ambos están listos para escucharte.";

            case 'acne':
                return "El acné tiene solución y nosotros sabemos cómo ayudarte. 🌟\n\n" .
                       "Nuestro **Programa de Acné** es integral:\n" .
                       "1. **Diagnóstico:** Identificamos la causa raíz (hormonal, bacteriana, etc.).\n" .
                       "2. **Tratamiento:** Combinamos medicación dermatológica con limpiezas profundas.\n" .
                       "3. **Tecnología:** Usamos láser para desinflamar y tratar secuelas.\n\n" .
                       "Precio referencial desde: **{$pAcne}**.\n\n" .
                       "¿Te gustaría agendar una valoración para iniciar tu cambio?";

            case 'laser':
                return "Nuestra tecnología láser transforma tu piel. ✨\n\n" .
                       "Es ideal para:\n" .
                       "🔹 **Cicatrices de Acné:** Mejora la textura y profundidad.\n" .
                       "🔹 **Rejuvenecimiento:** Estimula colágeno y tensa la piel.\n" .
                       "🔹 **Manchas:** Unifica el tono de forma segura.\n\n" .
                       "Precio referencial sesión láser: **{$pLaser}**.\n\n" .
                       "Es necesario una evaluación previa para determinar el tipo de láser ideal para ti.";

            case 'rejuvenation':
                return "El rejuvenecimiento en Piel en Armonía busca resultados **naturales y elegantes**. 🌸\n\n" .
                       "Opciones personalizadas:\n" .
                       "- **Toxina Botulínica (Botox):** Para suavizar líneas de expresión.\n" .
                       "- **Ácido Hialurónico:** Para reposición de volumen e hidratación.\n" .
                       "- **Bioestimuladores:** Para combatir la flacidez a largo plazo.\n\n" .
                       "Precio referencial desde: **{$pRejuv}**.\n" .
                       "La valoración médica es clave para indicarte el mejor tratamiento.";

            case 'telemedicine':
                return "¡La dermatología experta, donde estés! 🌍\n\n" .
                       "Si no puedes venir al consultorio, agenda una **Videoconsulta**.\n" .
                       "✅ Diagnóstico médico completo.\n" .
                       "✅ Receta electrónica válida.\n" .
                       "✅ Seguimiento por WhatsApp.\n\n" .
                       "Precio: **{$pOnline}**.\n" .
                       "Puedes agendarla directamente en nuestra web seleccionando 'Videoconsulta'.";

            case 'contact':
                return "Estamos siempre conectados contigo. 📱\n\n" .
                       "💬 **WhatsApp Directo:** [+593 98 245 3672](https://wa.me/593982453672)\n" .
                       "📞 **Teléfono:** 098 245 3672\n" .
                       "📧 **Email:** info@pielarmonia.com\n\n" .
                       "Si tienes una duda urgente, escríbenos por WhatsApp para una respuesta más rápida.";

            case 'cancellation':
            case 'rescheduling':
                return "Entendemos que pueden surgir imprevistos. 🗓️\n\n" .
                       "Para **reprogramar o cancelar**, revisa el correo de confirmación de tu cita; allí encontrarás un enlace directo para hacerlo en un clic.\n\n" .
                       "Si tienes dificultades, por favor escríbenos por WhatsApp al +593 98 245 3672 y nuestro equipo te ayudará manualmente.";

            case 'thanks':
                return "¡Gracias a ti por confiar en Piel en Armonía! 😊\n\n" .
                       "Ha sido un placer asistirte. Si surge cualquier otra duda, aquí estaré. ¡Que tengas un día maravilloso! ✨";

            default:
                // Fallback for unknown intent - Professional Guidance
                return "Entiendo. Para poder brindarte la información más precisa sobre ese tema, lo mejor es que te conecte con nuestras opciones principales:\n\n" .
                       "1. **[Ver Servicios y Precios](https://pielarmonia.com/#servicios)**\n" .
                       "2. **[Agendar una Cita](https://pielarmonia.com/#citas)**\n" .
                       "3. **[Hablar por WhatsApp](https://wa.me/593982453672)** para atención personalizada.\n\n" .
                       "¿Te gustaría que te ayude con alguna de estas opciones? (Ej: 'Precios', 'Ubicación')";
        }
    }

    private static function normalize(string $text): string
    {
        // Remove accents and lowercase
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
            'model' => 'figo-brain-v2-pro',
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
