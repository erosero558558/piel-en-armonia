<?php

class ClinicConfig {
    public static function getWhatsappNumber() {
        $path = __DIR__ . '/../data/clinic-config.json';
        if (file_exists($path)) {
            $data = json_decode(file_get_contents($path), true);
            if (isset($data['whatsapp'])) {
                return str_replace('+', '', $data['whatsapp']);
            }
        }
        return '593982453672';
    }
}
