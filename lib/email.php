<?php
declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

require_once dirname(__DIR__) . '/vendor/autoload.php';

function email_send(string $to, string $subject, string $body, string $fromName = 'Piel en Armonía'): bool
{
    $mail = new PHPMailer(true);

    try {
        //Server settings
        $mail->isSMTP();
        $mail->Host       = getenv('PIELARMONIA_SMTP_HOST') ?: 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = getenv('PIELARMONIA_SMTP_USER') ?: '';
        $mail->Password   = getenv('PIELARMONIA_SMTP_PASS') ?: '';
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = (int) (getenv('PIELARMONIA_SMTP_PORT') ?: 587);

        //Recipients
        $fromEmail = getenv('PIELARMONIA_EMAIL_FROM') ?: $mail->Username;
        if (!$fromEmail) {
             error_log('Piel en Armonía: No sender email configured (PIELARMONIA_EMAIL_FROM or SMTP_USER)');
             return false;
        }

        $mail->setFrom($fromEmail, $fromName);
        $mail->addAddress($to);

        //Content
        $mail->isHTML(false);
        $mail->Subject = $subject;
        $mail->Body    = $body;

        $mail->send();
        return true;
    } catch (Exception $e) {
        error_log("Message could not be sent. Mailer Error: {$mail->ErrorInfo}");
        return false;
    }
}
