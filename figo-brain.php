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
            return self::buildResponse("👋 **¡Hola!** Soy el **Dr. Virtual** de Piel en Armonía.\n\nEstoy aquí para ayudarte a agendar tu cita, resolver dudas sobre tratamientos o precios.\n\n¿En qué puedo ayudarte hoy?");
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
                return "👋 **¡Hola!** Soy el **Dr. Virtual** de Piel en Armonía.\n\nPuedo ayudarte con:\n🗓️ **Agendar citas**\n💰 **Precios y servicios**\n📍 **Ubicación y horarios**\n🧪 **Información sobre tratamientos** (Acné, Láser, Rejuvenecimiento)\n\n¿En qué puedo ayudarte hoy?";

            case 'pricing':
                $priceConsult = get_service_total_price('consulta');
                $priceOnline = get_service_total_price('video');
                $priceAcne = get_service_total_price('acne');
                if ($priceAcne === '$0.00') $priceAcne = '$89.60'; // Estimate fallback

                return "💰 **Nuestros Precios (IVA incluido):**\n\n" .
                       "**Consultas:**\n" .
                       "• Presencial: **{$priceConsult}**\n" .
                       "• Online (Video): **{$priceOnline}**\n" .
                       "• Telefónica: **" . get_service_total_price('telefono') . "**\n\n" .
                       "**Tratamientos (desde):**\n" .
                       "• Acné: **{$priceAcne}**\n" .
                       "• Láser: **" . get_service_total_price('laser') . "**\n" .
                       "• Rejuvenecimiento: **" . get_service_total_price('rejuvenecimiento') . "**\n\n" .
                       "⚠️ *Los precios de tratamientos son referenciales y requieren evaluación médica.*";

            case 'services':
                return "🌟 **Nuestros Servicios:**\n\n" .
                       "👨‍⚕️ **Dermatología Clínica:**\nControl de acné, rosácea, manchas, alergias y detección de cáncer de piel.\n\n" .
                       "✨ **Dermatología Estética:**\nRejuvenecimiento, toxina botulínica (Botox), rellenos, y láser CO2.\n\n" .
                       "💻 **Telemedicina:**\nConsultas desde casa por videollamada o teléfono.\n\n" .
                       "¿Te gustaría agendar una cita para alguno de estos servicios?";

            case 'booking':
                return "🗓️ **¡Agendar es muy fácil!**\n\n" .
                       "Puedes reservar tu cita ahora mismo eligiendo tu horario preferido:\n\n" .
                       "👉 **[Click aquí para Reservar Cita Online](https://pielarmonia.com/#citas)**\n\n" .
                       "Solo selecciona el servicio, el doctor y la hora. ¡Te esperamos!";

            case 'payment':
                return "💳 **Métodos de Pago Aceptados:**\n\n" .
                       "✅ **Tarjeta de Crédito/Débito** (Visa/Mastercard)\n" .
                       "✅ **Transferencia Bancaria**\n" .
                       "✅ **Efectivo** (Reserva online y paga en consultorio)\n\n" .
                       "Todo el proceso es seguro. Puedes reservar aquí: [Agendar Cita](https://pielarmonia.com/#citas)";

            case 'location':
                return "📍 **Nuestra Ubicación:**\n\n" .
                       "**Piel en Armonía**\n" .
                       "Calle Valparaíso y Sodiro\n" .
                       "Consultorio del Dr. Cecilio Caiza\n" .
                       "Quito, Ecuador\n\n" .
                       "🚗 **Referencia:** Frente al Colegio de las Mercedarias, cerca de la Maternidad Isidro Ayora.\n\n" .
                       "🗺️ **[Ver en Google Maps](https://www.google.com/maps/search/Valparaiso+13-183+y+Sodiro,+Quito,+Ecuador)**";

            case 'hours':
                return "⏰ **Horarios de Atención:**\n\n" .
                       "• **Lunes a Viernes:** 09:00 - 18:00\n" .
                       "• **Sábados:** 09:00 - 13:00\n\n" .
                       "Recuerda que atendemos previa cita. ¡Reserva tu turno [aquí](https://pielarmonia.com/#citas)!";

            case 'doctors':
                return "🩺 **Nuestro Equipo Médico:**\n\n" .
                       "👨‍⚕️ **Dr. Javier Rosero**\n*Dermatólogo Clínico*\nEspecialista en cáncer de piel, cirugía y acné.\n\n" .
                       "👩‍⚕️ **Dra. Carolina Narváez**\n*Dermatóloga Estética*\nEspecialista en láser, rejuvenecimiento y armonización facial.\n\n" .
                       "Ambos son excelentes profesionales listos para cuidarte.";

            case 'acne':
                return "🧬 **Tratamiento de Acné**\n\n" .
                       "El acné es nuestra especialidad. Ofrecemos un abordaje integral:\n" .
                       "• Medicación personalizada\n" .
                       "• Limpiezas profundas\n" .
                       "• Tecnología láser para secuelas\n\n" .
                       "Recupera la confianza en tu piel. Te sugiero agendar una **Consulta de Acné** hoy mismo.";

            case 'laser':
                return "⚡ **Tecnología Láser CO2**\n\n" .
                       "Ideal para renovar tu piel:\n" .
                       "✅ Rejuvenecimiento facial profundo\n" .
                       "✅ Eliminación de cicatrices de acné\n" .
                       "✅ Tratamiento de manchas y lunares\n\n" .
                       "Es un procedimiento seguro con resultados visibles. ¿Te gustaría conocer los costos?";

            case 'rejuvenation':
                return "✨ **Rejuvenecimiento Facial**\n\n" .
                       "Diseñamos un plan único para ti:\n" .
                       "• **Toxina Botulínica (Botox):** Suaviza líneas de expresión.\n" .
                       "• **Ácido Hialurónico:** Repone volumen e hidrata.\n" .
                       "• **Bioestimuladores:** Activan tu propio colágeno.\n\n" .
                       "Agenda una valoración para indicarte el mejor tratamiento para tu rostro.";

            case 'telemedicine':
                return "💻 **Consulta Online**\n\n" .
                       "Si no puedes venir, te atendemos donde estés:\n\n" .
                       "📱 **Videoconsulta ($30):** Diagnóstico completo y receta digital por videollamada.\n" .
                       "📞 **Consulta Telefónica ($25):** Ideal para seguimientos rápidos.\n\n" .
                       "Agenda seleccionando la opción **'Telemedicina'** en nuestro formulario.";

            case 'contact':
                return "📞 **Contáctanos:**\n\n" .
                       "📱 **WhatsApp:** [+593 98 245 3672](https://wa.me/593982453672)\n" .
                       "📧 **Email:** info@pielarmonia.com\n\n" .
                       "Estamos atentos para responder tus dudas. Si es urgente, te recomendamos llamar.";

            case 'cancellation':
            case 'rescheduling':
                return "🔄 **Cambios en tu Cita**\n\n" .
                       "Para cancelar o reprogramar, revisa el enlace en tu correo de confirmación.\n\n" .
                       "Si no lo encuentras, escríbenos por WhatsApp al **+593 98 245 3672** y te ayudaremos con gusto.";

            case 'thanks':
                return "😊 **¡De nada!**\n\nHa sido un placer ayudarte. Si tienes más preguntas, aquí estaré.\n\n¡Que tengas un excelente día y cuida tu piel! ✨";

            default:
                return "🤖 Entiendo. Para darte la mejor información, te sugiero:\n\n" .
                       "1️⃣ Ver nuestros **[Servicios](https://pielarmonia.com/#servicios)**\n" .
                       "2️⃣ Agendar una **[Cita de Valoración](https://pielarmonia.com/#citas)**\n" .
                       "3️⃣ Escribirnos por **[WhatsApp](https://wa.me/593982453672)** para atención personalizada.\n\n" .
                       "¿Te gustaría saber sobre precios o ubicación?";
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
