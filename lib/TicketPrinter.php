<?php

declare(strict_types=1);

require_once __DIR__ . '/validation.php';
require_once __DIR__ . '/common.php';
require_once __DIR__ . '/models.php';

class TicketPrinter
{
    private const PUBLIC_QUEUE_STATUS_BASE_URL = 'https://pielarmonia.com/es/software/turnero-clinicas/estado-turno/';

    private bool $enabled;
    private string $host;
    private int $port;
    private int $timeoutMs;

    public function __construct(bool $enabled, string $host, int $port, int $timeoutMs)
    {
        $this->enabled = $enabled;
        $this->host = trim($host);
        $this->port = max(1, $port);
        $this->timeoutMs = max(200, $timeoutMs);
    }

    public static function fromEnv(): self
    {
        $enabledRaw = getenv('PIELARMONIA_TICKET_PRINTER_ENABLED');
        $hostRaw = getenv('PIELARMONIA_TICKET_PRINTER_HOST');
        $portRaw = getenv('PIELARMONIA_TICKET_PRINTER_PORT');
        $timeoutRaw = getenv('PIELARMONIA_TICKET_PRINTER_TIMEOUT_MS');

        $enabled = parse_bool(is_string($enabledRaw) ? $enabledRaw : false);
        $host = is_string($hostRaw) ? trim($hostRaw) : '';
        $port = is_string($portRaw) && preg_match('/^\d+$/', $portRaw) ? (int) $portRaw : 9100;
        $timeoutMs = is_string($timeoutRaw) && preg_match('/^\d+$/', $timeoutRaw) ? (int) $timeoutRaw : 1500;

        return new self($enabled, $host, $port, $timeoutMs);
    }

    /**
     * @return array{ok:bool,printed:bool,errorCode:string,message:string}
     */
    public function printQueueTicket(array $ticket): array
    {
        if (!$this->enabled) {
            return [
                'ok' => true,
                'printed' => false,
                'errorCode' => 'printer_disabled',
                'message' => 'Impresora deshabilitada por configuracion',
            ];
        }

        if ($this->host === '') {
            return [
                'ok' => true,
                'printed' => false,
                'errorCode' => 'printer_host_missing',
                'message' => 'Impresora no configurada (host vacio)',
            ];
        }

        $errno = 0;
        $errstr = '';
        $timeoutSec = max(0.2, $this->timeoutMs / 1000);
        $socket = @fsockopen($this->host, $this->port, $errno, $errstr, $timeoutSec);
        if (!is_resource($socket)) {
            return [
                'ok' => false,
                'printed' => false,
                'errorCode' => 'printer_connect_failed',
                'message' => 'No se pudo conectar a la impresora: ' . trim($errstr !== '' ? $errstr : (string) $errno),
            ];
        }

        stream_set_timeout($socket, (int) ceil($timeoutSec));
        $payload = $this->buildEscPosPayload($ticket);
        $written = @fwrite($socket, $payload);
        @fflush($socket);
        @fclose($socket);

        if ($written === false || $written <= 0) {
            return [
                'ok' => false,
                'printed' => false,
                'errorCode' => 'printer_write_failed',
                'message' => 'No se pudo enviar el ticket a la impresora',
            ];
        }

        return [
            'ok' => true,
            'printed' => true,
            'errorCode' => '',
            'message' => 'Ticket impreso',
        ];
    }

    private function buildEscPosPayload(array $ticket): string
    {
        $ticketCode = strtoupper(trim((string) ($ticket['ticketCode'] ?? 'A-000')));
        $initials = strtoupper(trim((string) ($ticket['patientInitials'] ?? 'PA')));
        $queueType = (string) ($ticket['queueType'] ?? 'walk_in');
        $createdAt = (string) ($ticket['createdAt'] ?? local_date('c'));
        $priority = (string) ($ticket['priorityClass'] ?? 'walk_in');
        $visitReasonLabel = (string) (
            $ticket['visitReasonLabel']
            ?? queue_ticket_visit_reason_label((string) ($ticket['visitReason'] ?? ''))
        );
        $consultorio = $ticket['assignedConsultorio'] ?? null;
        $statusUrl = $this->buildPublicQueueStatusUrl($ticketCode);

        $lines = [
            'PIEL EN ARMONIA',
            'Turnero sala de espera',
            str_repeat('-', 32),
            'Turno: ' . ($ticketCode !== '' ? $ticketCode : 'A-000'),
            'Iniciales: ' . ($initials !== '' ? $initials : 'PA'),
            'Tipo: ' . ($queueType === 'appointment' ? 'Cita' : 'Walk-in'),
            'Motivo: ' . ($queueType === 'walk_in' && $visitReasonLabel !== '' ? $visitReasonLabel : '-'),
            'Prioridad: ' . $this->priorityLabel($priority),
            'Hora: ' . $this->printableDateTime($createdAt),
            'Consultorio: ' . ($consultorio === null ? '-' : (string) $consultorio),
            str_repeat('-', 32),
            'Espere su llamado en pantalla',
            'TV: ticket + iniciales',
        ];

        $esc = chr(27);
        $gs = chr(29);

        $payload = '';
        $payload .= $esc . '@'; // init
        $payload .= $esc . 'a' . chr(1); // center
        $payload .= $esc . '!' . chr(16); // double height
        $payload .= $this->line($lines[0]);
        $payload .= $esc . '!' . chr(0); // normal text
        $payload .= $this->line($lines[1]);
        $payload .= $esc . 'a' . chr(0); // left

        for ($i = 2, $total = count($lines); $i < $total; $i++) {
            $payload .= $this->line($lines[$i]);
        }

        $payload .= $esc . 'a' . chr(1); // center
        $payload .= $this->line('Escanea QR para ver tu posicion');
        $payload .= $this->line('desde tu telefono');
        $payload .= $this->buildQrCodePayload($statusUrl);
        $payload .= $this->line('');
        $payload .= $this->line('Estado turno: ' . ($ticketCode !== '' ? $ticketCode : 'A-000'));
        $payload .= $esc . 'a' . chr(0); // left
        $payload .= $this->line('');
        $payload .= $this->line('');
        $payload .= $gs . 'V' . chr(66) . chr(0); // full cut
        return $payload;
    }

    private function buildPublicQueueStatusUrl(string $ticketCode): string
    {
        $safeCode = strtoupper(trim($ticketCode));
        if ($safeCode === '') {
            $safeCode = 'A-000';
        }

        return self::PUBLIC_QUEUE_STATUS_BASE_URL . '?ticket=' . rawurlencode($safeCode);
    }

    private function buildQrCodePayload(string $data): string
    {
        $gs = chr(29);
        $length = strlen($data) + 3;
        $pL = chr($length % 256);
        $pH = chr((int) floor($length / 256));

        return ''
            . $gs . '(k' . chr(4) . chr(0) . chr(49) . chr(65) . chr(50) . chr(0)
            . $gs . '(k' . chr(3) . chr(0) . chr(49) . chr(67) . chr(6)
            . $gs . '(k' . chr(3) . chr(0) . chr(49) . chr(69) . chr(48)
            . $gs . '(k' . $pL . $pH . chr(49) . chr(80) . chr(48) . $data
            . $gs . '(k' . chr(3) . chr(0) . chr(49) . chr(81) . chr(48);
    }

    private function line(string $text): string
    {
        $text = preg_replace('/[^\x20-\x7E]/', '', $text);
        if (!is_string($text)) {
            $text = '';
        }
        return $text . "\n";
    }

    private function printableDateTime(string $isoDate): string
    {
        $ts = strtotime($isoDate);
        if ($ts === false) {
            return local_date('Y-m-d H:i');
        }
        return date('Y-m-d H:i', $ts);
    }

    private function priorityLabel(string $priorityClass): string
    {
        if ($priorityClass === 'appt_overdue') {
            return 'Cita vencida';
        }
        if ($priorityClass === 'appt_current') {
            return 'Cita vigente';
        }
        return 'Walk-in';
    }
}
