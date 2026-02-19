<?php
declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

function email_config(): array
{
    return [
        'host' => (string) (getenv('PIELARMONIA_SMTP_HOST') ?: 'smtp.gmail.com'),
        'port' => (int) (getenv('PIELARMONIA_SMTP_PORT') ?: 587),
        'user' => (string) (getenv('PIELARMONIA_SMTP_USER') ?: ''),
        'pass' => (string) (getenv('PIELARMONIA_SMTP_PASS') ?: ''),
        'from' => (string) (getenv('PIELARMONIA_EMAIL_FROM') ?: ''),
        'from_name' => 'Piel en Armonía',
    ];
}

function email_enabled(): bool
{
    $cfg = email_config();
    return $cfg['user'] !== '' && $cfg['pass'] !== '';
}

function email_send(string $to, string $subject, string $body): bool
{
    if (!email_enabled()) {
        $from = getenv('PIELARMONIA_EMAIL_FROM') ?: 'no-reply@pielarmonia.com';
        $headers = "From: Piel en Armonía <{$from}>\r\nContent-Type: text/plain; charset=UTF-8";
        return mail($to, $subject, $body, $headers);
    }

    $cfg = email_config();
    $mail = new PHPMailer(true);

    try {
        $mail->isSMTP();
        $mail->Host = $cfg['host'];
        $mail->SMTPAuth = true;
        $mail->Username = $cfg['user'];
        $mail->Password = $cfg['pass'];
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port = $cfg['port'];
        $mail->CharSet = 'UTF-8';

        $from = $cfg['from'] ?: $cfg['user'];
        $mail->setFrom($from, $cfg['from_name']);
        $mail->addAddress($to);

        $mail->Subject = $subject;
        $mail->Body = $body;

        $mail->send();
        return true;
    } catch (Exception $e) {
        error_log('Piel en Armonía PHPMailer error: ' . $mail->ErrorInfo);
        return false;
    }
}
