<?php

declare(strict_types=1);

namespace App\GraphQL;

use GraphQL\Type\Definition\Type;
use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\InputObjectType;

class Types
{
    private static $appointment;
    private static $review;
    private static $callback;
    private static $availabilitySlot;
    private static $monitoringConfig;
    private static $featureFlag;
    private static $paymentConfig;
    private static $prediction;
    private static $figoConfig;
    private static $adminData;

    // Inputs
    private static $appointmentInput;
    private static $reviewInput;
    private static $callbackInput;
    private static $figoConfigInput;

    public static function appointment(): ObjectType
    {
        return self::$appointment ?: (self::$appointment = new ObjectType([
            'name' => 'Appointment',
            'fields' => [
                'id' => Type::nonNull(Type::id()),
                'service' => Type::string(),
                'doctor' => Type::string(),
                'date' => Type::string(),
                'time' => Type::string(),
                'name' => Type::string(),
                'email' => Type::string(),
                'phone' => Type::string(),
                'reason' => Type::string(),
                'affectedArea' => Type::string(),
                'evolutionTime' => Type::string(),
                'privacyConsent' => Type::boolean(),
                'privacyConsentAt' => Type::string(),
                'casePhotoCount' => Type::int(),
                'casePhotoNames' => Type::listOf(Type::string()),
                'casePhotoUrls' => Type::listOf(Type::string()),
                'casePhotoPaths' => Type::listOf(Type::string()),
                'price' => Type::float(),
                'status' => Type::string(),
                'paymentMethod' => Type::string(),
                'paymentStatus' => Type::string(),
                'paymentProvider' => Type::string(),
                'paymentIntentId' => Type::string(),
                'paymentPaidAt' => Type::string(),
                'transferReference' => Type::string(),
                'transferProofPath' => Type::string(),
                'transferProofUrl' => Type::string(),
                'transferProofName' => Type::string(),
                'transferProofMime' => Type::string(),
                'dateBooked' => Type::string(),
                'rescheduleToken' => Type::string(),
                'reminderSentAt' => Type::string(),
            ]
        ]));
    }

    public static function availabilitySlotInput(): InputObjectType
    {
        return new InputObjectType([
             'name' => 'AvailabilitySlotInput',
             'fields' => [
                 'date' => Type::string(),
                 'slots' => Type::listOf(Type::string())
             ]
        ]);
    }

    public static function transferProofInput(): InputObjectType
    {
        return new InputObjectType([
            'name' => 'TransferProofInput',
            'fields' => [
                'filename' => Type::nonNull(Type::string()),
                'mimetype' => Type::nonNull(Type::string()),
                'base64' => Type::nonNull(Type::string())
            ]
        ]);
    }

    public static function review(): ObjectType
    {
        return self::$review ?: (self::$review = new ObjectType([
            'name' => 'Review',
            'fields' => [
                'id' => Type::nonNull(Type::id()),
                'name' => Type::string(),
                'rating' => Type::int(),
                'text' => Type::string(),
                'date' => Type::string(),
                'verified' => Type::boolean(),
            ]
        ]));
    }

    public static function callback(): ObjectType
    {
        return self::$callback ?: (self::$callback = new ObjectType([
            'name' => 'Callback',
            'fields' => [
                'id' => Type::nonNull(Type::id()),
                'telefono' => Type::string(),
                'preferencia' => Type::string(),
                'fecha' => Type::string(),
                'status' => Type::string(),
            ]
        ]));
    }

    public static function availabilitySlot(): ObjectType
    {
        return self::$availabilitySlot ?: (self::$availabilitySlot = new ObjectType([
            'name' => 'AvailabilitySlot',
            'fields' => [
                'date' => Type::string(),
                'slots' => Type::listOf(Type::string())
            ]
        ]));
    }

    public static function monitoringConfig(): ObjectType
    {
        return self::$monitoringConfig ?: (self::$monitoringConfig = new ObjectType([
            'name' => 'MonitoringConfig',
            'fields' => [
                'sentryDsn' => Type::string(),
                'environment' => Type::string(),
                'sampleRate' => Type::float(),
                'debug' => Type::boolean(),
            ]
        ]));
    }

    public static function featureFlag(): ObjectType
    {
        return self::$featureFlag ?: (self::$featureFlag = new ObjectType([
           'name' => 'FeatureFlag',
           'fields' => [
               'name' => Type::string(),
               'enabled' => Type::boolean(),
           ]
        ]));
    }

    public static function paymentConfig(): ObjectType
    {
        return self::$paymentConfig ?: (self::$paymentConfig = new ObjectType([
            'name' => 'PaymentConfig',
            'fields' => [
                'stripePublicKey' => Type::string(),
                'currency' => Type::string(),
                'enabled' => Type::boolean(),
                'vatRate' => Type::float(),
            ]
        ]));
    }

    public static function prediction(): ObjectType
    {
        return self::$prediction ?: (self::$prediction = new ObjectType([
            'name' => 'Prediction',
            'fields' => [
                'score' => Type::float(),
                'risk' => Type::string(), // low, medium, high
                'factors' => Type::listOf(Type::string()),
            ]
        ]));
    }

    public static function figoConfig(): ObjectType
    {
        return self::$figoConfig ?: (self::$figoConfig = new ObjectType([
            'name' => 'FigoConfig',
            'fields' => [
                'endpoint' => Type::string(),
                'token' => Type::string(),
                'apiKey' => Type::string(),
                'apiKeyHeader' => Type::string(),
                'timeout' => Type::int(),
                'allowLocalFallback' => Type::boolean(),
                'ai' => new ObjectType([
                    'name' => 'FigoAIConfig',
                    'fields' => [
                        'endpoint' => Type::string(),
                        'apiKey' => Type::string(),
                        'model' => Type::string(),
                        'timeoutSeconds' => Type::int(),
                        'allowLocalFallback' => Type::boolean()
                    ]
                ]),
                'exists' => Type::boolean(),
                'path' => Type::string(),
                'activePath' => Type::string(),
                'writePath' => Type::string(),
                'figoEndpointConfigured' => Type::boolean(),
                'aiConfigured' => Type::boolean(),
                'timestamp' => Type::string(),
            ]
        ]));
    }

    public static function adminData(): ObjectType
    {
        return self::$adminData ?: (self::$adminData = new ObjectType([
            'name' => 'AdminData',
            'fields' => [
                'appointments' => Type::listOf(self::appointment()),
                'reviews' => Type::listOf(self::review()),
                'callbacks' => Type::listOf(self::callback()),
                'availability' => Type::listOf(self::availabilitySlot()),
            ]
        ]));
    }

    // Inputs

    public static function appointmentInput(): InputObjectType
    {
        return self::$appointmentInput ?: (self::$appointmentInput = new InputObjectType([
            'name' => 'AppointmentInput',
            'fields' => [
                'service' => Type::string(),
                'doctor' => Type::string(),
                'date' => Type::string(),
                'time' => Type::string(),
                'name' => Type::string(),
                'email' => Type::string(),
                'phone' => Type::string(),
                'reason' => Type::string(),
                'affectedArea' => Type::string(),
                'evolutionTime' => Type::string(),
                'privacyConsent' => Type::boolean(),
                'paymentMethod' => Type::string(),
                'paymentIntentId' => Type::string(),
                'transferReference' => Type::string(),
                'transferProofPath' => Type::string(),
                'transferProofUrl' => Type::string(),
                'transferProofName' => Type::string(),
                'transferProofMime' => Type::string(),
                'casePhotoUrls' => Type::listOf(Type::string()),
                'casePhotoNames' => Type::listOf(Type::string()),
                'recaptcha' => Type::string(),
            ]
        ]));
    }

    public static function reviewInput(): InputObjectType
    {
        return self::$reviewInput ?: (self::$reviewInput = new InputObjectType([
            'name' => 'ReviewInput',
            'fields' => [
                'name' => Type::string(),
                'rating' => Type::int(),
                'text' => Type::string(),
                'token' => Type::string(), // For verification if needed, or recaptcha
                'recaptcha' => Type::string(),
            ]
        ]));
    }

    public static function callbackInput(): InputObjectType
    {
        return self::$callbackInput ?: (self::$callbackInput = new InputObjectType([
            'name' => 'CallbackInput',
            'fields' => [
                'telefono' => Type::string(),
                'preferencia' => Type::string(),
                'recaptcha' => Type::string(),
            ]
        ]));
    }

    public static function figoConfigInput(): InputObjectType
    {
        return self::$figoConfigInput ?: (self::$figoConfigInput = new InputObjectType([
            'name' => 'FigoConfigInput',
            'fields' => [
                'endpoint' => Type::string(),
                'token' => Type::string(),
                'apiKey' => Type::string(),
                'apiKeyHeader' => Type::string(),
                'timeout' => Type::int(),
                'allowLocalFallback' => Type::boolean(),
                'ai' => new InputObjectType([
                    'name' => 'FigoAIConfigInput',
                    'fields' => [
                         'endpoint' => Type::string(),
                         'apiKey' => Type::string(),
                         'model' => Type::string(),
                         'timeoutSeconds' => Type::int(),
                         'allowLocalFallback' => Type::boolean()
                    ]
                ])
            ]
        ]));
    }
}
