-- =========================================================================
-- AURORA DERM - Base de Datos Relacional Normalizada
-- Motor: MySQL / MariaDB (InnoDB, UTF-8 MB4)
-- Versión Arquitectura: 2.0 (API / Relacional)
-- =========================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------
-- Tabla: patients
-- -----------------------------------------------------
DROP TABLE IF EXISTS `patients`;
CREATE TABLE `patients` (
  `id` VARCHAR(36) NOT NULL COMMENT 'UUID primario del paciente',
  `document_number` VARCHAR(50) NOT NULL COMMENT 'DNI / CI / Pasaporte',
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) DEFAULT NULL,
  `phone` VARCHAR(30) DEFAULT NULL,
  `date_of_birth` DATE DEFAULT NULL,
  `gender` ENUM('M', 'F', 'O', 'PREFIERE_NO_DECIR') DEFAULT 'O',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_patient_document` (`document_number`),
  KEY `idx_patient_email` (`email`),
  KEY `idx_patient_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------
-- Tabla: patient_cases
-- -----------------------------------------------------
-- Un caso médico asocia múltiples citas, fotos, y evoluciones de 
-- un paciente bajo el mismo perfil patológico o diagnóstico.
DROP TABLE IF EXISTS `patient_cases`;
CREATE TABLE `patient_cases` (
  `id` VARCHAR(36) NOT NULL COMMENT 'UUID primario del caso',
  `patient_id` VARCHAR(36) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `status` ENUM('open', 'closed', 'on_hold') DEFAULT 'open',
  `open_date` DATE NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_case_patient_id` (`patient_id`),
  CONSTRAINT `fk_case_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------
-- Tabla: appointments
-- -----------------------------------------------------
DROP TABLE IF EXISTS `appointments`;
CREATE TABLE `appointments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `case_id` VARCHAR(36) DEFAULT NULL COMMENT 'Opcional si es primeriza sin caso abierto',
  `patient_id` VARCHAR(36) NOT NULL,
  `appointment_date` DATE NOT NULL,
  `appointment_time` TIME NOT NULL,
  `doctor_id` VARCHAR(36) DEFAULT NULL,
  `service_type` VARCHAR(50) NOT NULL,
  `status` VARCHAR(30) DEFAULT 'confirmed' COMMENT 'confirmed, cancelled, completed, no_show',
  `reschedule_token` VARCHAR(64) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_appointments_date` (`appointment_date`),
  KEY `idx_appointments_patient` (`patient_id`),
  KEY `idx_appointments_case` (`case_id`),
  KEY `idx_appointments_token` (`reschedule_token`),
  CONSTRAINT `fk_appointment_case` FOREIGN KEY (`case_id`) REFERENCES `patient_cases` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_appointment_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------
-- Tabla: evolutions (Notas Clínicas SOAP)
-- -----------------------------------------------------
DROP TABLE IF EXISTS `evolutions`;
CREATE TABLE `evolutions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `case_id` VARCHAR(36) NOT NULL,
  `appointment_id` BIGINT UNSIGNED DEFAULT NULL COMMENT 'Puede haber notas fuera de cita',
  `doctor_id` VARCHAR(36) NOT NULL,
  `subjective_note` TEXT,
  `objective_note` TEXT,
  `assessment` TEXT,
  `plan` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_evolutions_case` (`case_id`),
  KEY `idx_evolutions_appointment` (`appointment_id`),
  CONSTRAINT `fk_evolution_case` FOREIGN KEY (`case_id`) REFERENCES `patient_cases` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_evolution_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------
-- Tabla: presets / catalogs (Servicios, Doctores, etc)
-- -----------------------------------------------------
DROP TABLE IF EXISTS `services_catalog`;
CREATE TABLE `services_catalog` (
  `id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `duration_minutes` INT NOT NULL DEFAULT 30,
  `is_active` BOOLEAN DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


SET FOREIGN_KEY_CHECKS = 1;
-- Fin de esquema relacional.
