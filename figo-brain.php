<?php
declare(strict_types=1);

/**
 * FigoBrain: Local Intelligence for Piel en Armonía Chatbot.
 * Provides smart, context-aware responses without external AI.
 */

class FigoBrain
{
    private const INTENTS = [
        'greeting' => ['hola', 'buenos dias', 'buenas tardes', 'buenas noches', 'hey', 'hi', 'hello', 'saludos'],
        'pricing' => ['precio', 'cuanto cuesta', 'valor', 'tarifa', 'costo', 'presupuesto'],
        'services' => ['servicios', 'tratamientos', 'que hacen', 'que ofrecen', 'procedimientos'],
        'booking' => ['cita', 'agendar', 'reservar', 'turno', 'hora', 'quiero una consulta'],
        'payment' => ['pago', 'pagar', 'tarjeta', 'transferencia', 'efectivo', 'deposito', 'factura', 'comprobante'],
        'location' => ['donde', 'ubicacion', 'direccion', 'lugar', 'mapa', 'como llegar', 'quito'],
        'hours' => ['horario', 'hora atencion', 'cuando atienden', 'abierto', 'cerrado'],
        'doctors' => ['doctor', 'medico', 'especialista', 'rosero', 'narvaez', 'quien atiende'],
        'acne' => ['acne', 'granos', 'espinillas', 'barros', 'manchas de acne', 'cicatrices'],
        'laser' => ['laser', 'cicatrices', 'depilacion', 'manchas', 'vascular'],
        'rejuvenation' => ['rejuvenecimiento', 'arrugas', 'botox', 'relleno', 'antiage', 'joven'],
        'telemedicine' => ['online', 'virtual', 'video', 'remota', 'telemedicina', 'whatsapp', 'llamada'],
        'cancellation' => ['cancelar', 'anular', 'no puedo ir'],
        'rescheduling' => ['reprogramar', 'cambiar fecha', 'mover cita'],
        'contact' => ['telefono', 'celular', 'whatsapp', 'correo', 'email', 'contacto'],
        'thanks' => ['gracias', 'ok', 'listo', 'perfecto', 'excelente', 'muy amable']
    ];

    public static function process(array $messages): array
    {
        $lastUserMessage = '';
        foreach (array_reverse($messages) as $msg) {
            if (($msg['role'] ?? '') === 'user') {
                $lastUserMessage = (string) ($msg['content'] ?? '');
                break;
            }
        }

        if ($lastUserMessage === '') {
            return self::buildResponse('Hola, soy el asistente virtual de Piel en Armonía. ¿En qué puedo ayudarte hoy?');
        }

        $intent = self::detectIntent($lastUserMessage);
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
                if (strpos($normalized, $keyword) !== false) {
                    $scores[$intent]++;
                }
            }
        }

        // Specific overrides for stronger intent signals
        if (preg_match('/(agendar|reservar|cita)/', $normalized)) {
            $scores['booking'] += 5;
        }
        if (preg_match('/(precio|costo|cuanto)/', $normalized)) {
            $scores['pricing'] += 3;
        }
        if (strpos($normalized, 'horario') !== false) {
            $scores['hours'] += 5;
        }

        arsort($scores);
        $bestIntent = key($scores);

        return $scores[$bestIntent] > 0 ? $bestIntent : 'unknown';
    }

    private static function generateResponse(string $intent, string $message): string
    {
        switch ($intent) {
            case 'greeting':
                return "¡Hola! Soy Figo, tu asistente en Piel en Armonía. 😊\n\nPuedo ayudarte con:\n- Agendar citas\n- Consultar precios y servicios\n- Información de tratamientos (Acné, Láser, Rejuvenecimiento)\n- Ubicación y horarios\n\n¿Qué necesitas saber?";

            case 'pricing':
                $priceConsult = get_service_total_price('consulta');
                $priceOnline = get_service_total_price('video');
                $priceAcne = get_service_total_price('acne'); // Base price logic
                // Fallback manually if function returns 0 or default
                if ($priceAcne === '$0.00') $priceAcne = '$89.60'; // Estimate with VAT

                return "Nuestros precios referenciales (incluyen IVA):\n\n" .
                       "📋 **Consultas:**\n" .
                       "- Presencial: {$priceConsult}\n" .
                       "- Online (Video): {$priceOnline}\n" .
                       "- Telefónica: " . get_service_total_price('telefono') . "\n\n" .
                       "💉 **Tratamientos (desde):**\n" .
                       "- Acné: {$priceAcne}\n" .
                       "- Láser: " . get_service_total_price('laser') . "\n" .
                       "- Rejuvenecimiento: " . get_service_total_price('rejuvenecimiento') . "\n\n" .
                       "Para un presupuesto exacto, es necesaria una valoración médica. ¿Te gustaría agendar una cita?";

            case 'services':
                return "En Piel en Armonía ofrecemos una amplia gama de servicios dermatológicos:\n\n" .
                       "✅ **Dermatología Clínica:** Acné, rosácea, manchas, alergias, detección de cáncer de piel.\n" .
                       "✨ **Dermatología Estética:** Rejuvenecimiento, toxina botulínica, rellenos, láser CO2.\n" .
                       "💻 **Telemedicina:** Consultas por videollamada o teléfono.\n\n" .
                       "¿Te interesa algún tratamiento en específico?";

            case 'booking':
                return "¡Claro! Agendar tu cita es muy fácil y rápido.\n\n" .
                       "Puedes hacerlo directamente aquí:\n" .
                       "👉 [Reservar Cita Online](https://pielarmonia.com/#citas)\n\n" .
                       "Solo elige el servicio, el doctor y el horario que prefieras. El sistema te guiará para realizar el pago y confirmar tu reserva al instante.";

            case 'payment':
                return "Para tu comodidad, aceptamos los siguientes métodos de pago en nuestra web:\n\n" .
                       "💳 **Tarjeta de Crédito/Débito:** Visa o Mastercard.\n" .
                       "🏦 **Transferencia Bancaria:** Te daremos los datos al finalizar la reserva.\n" .
                       "💵 **Efectivo:** Puedes reservar y pagar el día de tu consulta (sujeto a confirmación).\n\n" .
                       "Todo el proceso es seguro y rápido desde nuestra sección de [Reservar Cita](https://pielarmonia.com/#citas).";

            case 'location':
                return "📍 **Ubicación:**\n" .
                       "Estamos en Quito, Ecuador. Sector La Carolina.\n" .
                       "Edificio Citimed, Consultorio 312.\n\n" .
                       "🗺️ **Ver en Mapa:** [Google Maps](https://goo.gl/maps/pielarmonia)\n\n" .
                       "Contamos con parqueadero para pacientes.";

            case 'hours':
                return "⏰ **Horarios de Atención:**\n\n" .
                       "Lunes a Viernes: 09:00 - 18:00\n" .
                       "Sábados: 09:00 - 13:00\n\n" .
                       "Recuerda que atendemos previa cita. Puedes agendar la tuya [aquí](https://pielarmonia.com/#citas).";

            case 'doctors':
                return "Contamos con especialistas de primer nivel:\n\n" .
                       "👨‍⚕️ **Dr. Javier Rosero:** Dermatólogo Clínico, experto en cáncer de piel, cirugía dermatológica y acné.\n\n" .
                       "👩‍⚕️ **Dra. Carolina Narváez:** Dermatóloga Estética, especialista en láser, rejuvenecimiento y armonización facial.\n\n" .
                       "Ambos están listos para cuidar la salud de tu piel.";

            case 'acne':
                return "El acné es una de nuestras especialidades. Tratamos desde acné activo hasta cicatrices y secuelas.\n\n" .
                       "🔹 **Tratamiento Integral:** Combinamos medicación, limpiezas y tecnología láser según tu caso.\n" .
                       "🔹 **Resultados:** Buscamos controlar el brote y mejorar la textura de tu piel.\n\n" .
                       "Te recomiendo agendar una **Consulta de Acné** para evaluar tu tipo de piel y diseñar tu plan.";

            case 'laser':
                return "Nuestra tecnología láser es ideal para:\n" .
                       "- Rejuvenecimiento facial (Láser CO2)\n" .
                       "- Eliminación de cicatrices de acné\n" .
                       "- Manchas y lesiones vasculares\n" .
                       "- Eliminación de lunares benignos\n\n" .
                       "Es un procedimiento seguro y con excelentes resultados. ¿Quisieras más información sobre precios?";

            case 'rejuvenation':
                return "Para rejuvenecimiento facial ofrecemos tratamientos personalizados:\n" .
                       "- Toxina Botulínica (Botox) para líneas de expresión.\n" .
                       "- Ácido Hialurónico para reposición de volumen.\n" .
                       "- Bioestimuladores de colágeno.\n" .
                       "- Láser CO2 Fraccionado.\n\n" .
                       "Lo ideal es una valoración para indicarte qué tratamiento te dará los resultados más naturales y armónicos.";

            case 'telemedicine':
                return "Si no puedes venir presencialmente, ¡te atendemos online!\n\n" .
                       "📱 **Videoconsulta:** A través de WhatsApp o Zoom. Incluye evaluación, diagnóstico y receta digital. Precio: " . get_service_total_price('video') . "\n\n" .
                       "📞 **Consulta Telefónica:** Para seguimientos o dudas puntuales. Precio: " . get_service_total_price('telefono') . "\n\n" .
                       "Agenda tu cita online seleccionando la opción 'Videoconsulta'.";

            case 'contact':
                return "Puedes contactarnos directamente por:\n" .
                       "📱 **WhatsApp:** [+593 98 245 3672](https://wa.me/593982453672)\n" .
                       "📧 **Email:** info@pielarmonia.com\n\n" .
                       "Estamos atentos para responder tus dudas.";

            case 'cancellation':
            case 'rescheduling':
                return "Para cancelar o reprogramar tu cita, por favor revisa el correo de confirmación que recibiste.\n\n" .
                       "Allí encontrarás un enlace directo para gestionar tu reserva. También puedes escribirnos por WhatsApp al +593 98 245 3672 para ayudarte manualmente.";

            case 'thanks':
                return "¡De nada! Ha sido un gusto ayudarte. Si tienes más preguntas, aquí estaré. ¡Que tengas un lindo día! ✨";

            default:
                // Fallback for unknown intent
                return "Entiendo. Para darte la mejor información sobre ese tema, te sugiero que:\n\n" .
                       "1. Mires nuestros [Servicios](https://pielarmonia.com/#servicios)\n" .
                       "2. Agendes una [Cita de Valoración](https://pielarmonia.com/#citas)\n" .
                       "3. Nos escribas por [WhatsApp](https://wa.me/593982453672) para atención personalizada.\n\n" .
                       "¿Hay algo más puntual en lo que pueda guiarte? (Precios, Ubicación, Citas)";
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
            'model' => 'figo-brain-v1',
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
