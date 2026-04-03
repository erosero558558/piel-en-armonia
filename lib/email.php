<?php

require_once __DIR__ . '/email/EmailSenderService.php';
require_once __DIR__ . '/email/EmailTemplateService.php';

function smtp_config()
{
    return EmailSenderService::smtp_config();
}

function smtp_enabled()
{
    return EmailSenderService::smtp_enabled();
}

function smtp_send_mail(...$args)
{
    return EmailSenderService::smtp_send_mail(...$args);
}

function send_mail(...$args)
{
    return EmailSenderService::send_mail(...$args);
}

function generate_ics_content(...$args)
{
    return EmailTemplateService::generate_ics_content(...$args);
}

function get_email_template(...$args)
{
    return EmailTemplateService::get_email_template(...$args);
}

function email_recipient_or_empty(...$args)
{
    return EmailTemplateService::email_recipient_or_empty(...$args);
}

function build_email_subject(...$args)
{
    return EmailTemplateService::build_email_subject(...$args);
}

function send_mail_to_recipient(...$args)
{
    return EmailSenderService::send_mail_to_recipient(...$args);
}

function build_appointment_email_context(...$args)
{
    return EmailTemplateService::build_appointment_email_context(...$args);
}

function build_email_detail_rows(...$args)
{
    return EmailTemplateService::build_email_detail_rows(...$args);
}

function build_appointment_detail_rows(...$args)
{
    return EmailTemplateService::build_appointment_detail_rows(...$args);
}

function build_appointment_detail_table(...$args)
{
    return EmailTemplateService::build_appointment_detail_table(...$args);
}

function build_email_cta_button(...$args)
{
    return EmailTemplateService::build_email_cta_button(...$args);
}

function build_appointment_detail_text(...$args)
{
    return EmailTemplateService::build_appointment_detail_text(...$args);
}

function build_text_rows(...$args)
{
    return EmailTemplateService::build_text_rows(...$args);
}

function build_notification_body(...$args)
{
    return EmailTemplateService::build_notification_body(...$args);
}

function build_admin_appointment_notification_rows(...$args)
{
    return EmailTemplateService::build_admin_appointment_notification_rows(...$args);
}

function build_reschedule_notification_rows(...$args)
{
    return EmailTemplateService::build_reschedule_notification_rows(...$args);
}

function build_reschedule_notification_footer(...$args)
{
    return EmailTemplateService::build_reschedule_notification_footer(...$args);
}

function build_reschedule_email_text(...$args)
{
    return EmailTemplateService::build_reschedule_email_text(...$args);
}

function build_reschedule_email_html(...$args)
{
    return EmailTemplateService::build_reschedule_email_html(...$args);
}

function split_patient_name(...$args)
{
    return EmailTemplateService::split_patient_name(...$args);
}

function resolve_case_contact_context(...$args)
{
    return EmailTemplateService::resolve_case_contact_context(...$args);
}

function normalize_prescription_email_items(...$args)
{
    return EmailTemplateService::normalize_prescription_email_items(...$args);
}

function build_post_consultation_followup_email_html(...$args)
{
    return EmailTemplateService::build_post_consultation_followup_email_html(...$args);
}

function build_post_consultation_followup_email_text(...$args)
{
    return EmailTemplateService::build_post_consultation_followup_email_text(...$args);
}

function maybe_send_post_consultation_followup_email(...$args)
{
    return EmailSenderService::maybe_send_post_consultation_followup_email(...$args);
}

function build_prescription_ready_email_html(...$args)
{
    return EmailTemplateService::build_prescription_ready_email_html(...$args);
}

function build_prescription_ready_email_text(...$args)
{
    return EmailTemplateService::build_prescription_ready_email_text(...$args);
}

function maybe_send_prescription_ready_email(...$args)
{
    return EmailSenderService::maybe_send_prescription_ready_email(...$args);
}

function build_callback_notification_rows(...$args)
{
    return EmailTemplateService::build_callback_notification_rows(...$args);
}

function build_preconsultation_notification_rows(...$args)
{
    return EmailTemplateService::build_preconsultation_notification_rows(...$args);
}

function get_service_preparation_instructions(...$args)
{
    return EmailTemplateService::get_service_preparation_instructions(...$args);
}

function build_appointment_email_html(...$args)
{
    return EmailTemplateService::build_appointment_email_html(...$args);
}

function build_appointment_email_text(...$args)
{
    return EmailTemplateService::build_appointment_email_text(...$args);
}

function build_reminder_email_html(...$args)
{
    return EmailTemplateService::build_reminder_email_html(...$args);
}

function build_reminder_email_text(...$args)
{
    return EmailTemplateService::build_reminder_email_text(...$args);
}

function build_cancellation_email_html(...$args)
{
    return EmailTemplateService::build_cancellation_email_html(...$args);
}

function build_cancellation_email_text(...$args)
{
    return EmailTemplateService::build_cancellation_email_text(...$args);
}

function maybe_send_appointment_whatsapp(...$args)
{
    return EmailSenderService::maybe_send_appointment_whatsapp(...$args);
}

function maybe_send_appointment_email(...$args)
{
    return EmailSenderService::maybe_send_appointment_email(...$args);
}

function maybe_send_admin_notification(...$args)
{
    return EmailSenderService::maybe_send_admin_notification(...$args);
}

function maybe_send_cancellation_email(...$args)
{
    return EmailSenderService::maybe_send_cancellation_email(...$args);
}

function maybe_send_callback_admin_notification(...$args)
{
    return EmailSenderService::maybe_send_callback_admin_notification(...$args);
}

function maybe_send_preconsultation_admin_notification(...$args)
{
    return EmailSenderService::maybe_send_preconsultation_admin_notification(...$args);
}

function maybe_send_reminder_email(...$args)
{
    return EmailSenderService::maybe_send_reminder_email(...$args);
}

function maybe_send_reschedule_email(...$args)
{
    return EmailSenderService::maybe_send_reschedule_email(...$args);
}

function maybe_send_gift_card_reminder_email(...$args)
{
    return EmailSenderService::maybe_send_gift_card_reminder_email(...$args);
}
