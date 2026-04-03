-- --------------------------------------------------------
-- Aurora Derm - Estructura de Base de Datos Base (Migración desde JSON)
-- Motor: InnoDB
-- Charset: utf8mb4
-- --------------------------------------------------------

CREATE DATABASE IF NOT EXISTS auroraderm DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE auroraderm;

-- --------------------------------------------------------
-- 1. Pacientes (Sustituye auth y metadata dispersa)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS patients (
    id VARCHAR(64) PRIMARY KEY,
    cedula VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(150),
    phone VARCHAR(50),
    birth_date DATE,
    gender ENUM('M', 'F', 'OTROS'),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_cedula (cedula),
    INDEX idx_email (email)
);

-- --------------------------------------------------------
-- 2. Casos Clínicos (Cases)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS cases (
    id VARCHAR(64) PRIMARY KEY,
    patient_id VARCHAR(64) NOT NULL,
    status ENUM('active', 'closed') DEFAULT 'active',
    primary_diagnosis_cie10 VARCHAR(10),
    initial_consultation_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- --------------------------------------------------------
-- 3. Citas / Agenda (Appointments)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointments (
    id VARCHAR(64) PRIMARY KEY,
    patient_id VARCHAR(64) NOT NULL,
    case_id VARCHAR(64),
    doctor_id VARCHAR(64) NOT NULL, -- Reemplaza array hardcodeado
    appointment_date DATETIME NOT NULL,
    status ENUM('pending', 'confirmed', 'completed', 'cancelled', 'no_show') DEFAULT 'pending',
    type ENUM('first_time', 'control', 'procedure', 'telemedicine') DEFAULT 'control',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL,
    INDEX idx_date (appointment_date),
    INDEX idx_status (status)
);

-- --------------------------------------------------------
-- 4. Notas Evolutivas Clínicas (SOAP) - El núcleo de HCE
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS evolutions (
    id VARCHAR(64) PRIMARY KEY,
    case_id VARCHAR(64) NOT NULL,
    appointment_id VARCHAR(64),
    doctor_id VARCHAR(64) NOT NULL,
    
    -- SOAP Estructurado
    note_subjective TEXT,
    note_objective TEXT,
    note_assessment TEXT,
    note_plan TEXT,
    
    -- Metadatos y Seguridad
    integrity_hash VARCHAR(64), -- SHA256 de los datos para evitar manipulación (Legal)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
);

-- --------------------------------------------------------
-- 5. Prescripciones / Recetas (Subdocumento de la visita)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS prescriptions (
    id VARCHAR(64) PRIMARY KEY,
    evolution_id VARCHAR(64) NOT NULL,
    medication_name VARCHAR(200) NOT NULL,
    dose_amount DECIMAL(8,2),
    dose_unit VARCHAR(20),
    route VARCHAR(50),
    frequency_hours INT,
    duration_days INT,
    special_instructions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (evolution_id) REFERENCES evolutions(id) ON DELETE CASCADE
);

-- --------------------------------------------------------
-- 6. Resultados de Laboratorio
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS lab_results (
    id VARCHAR(64) PRIMARY KEY,
    case_id VARCHAR(64) NOT NULL,
    test_name VARCHAR(200) NOT NULL,
    test_date DATE,
    result_value VARCHAR(100),
    unit VARCHAR(50),
    reference_range VARCHAR(100),
    status ENUM('normal', 'elevated', 'critical', 'pending') DEFAULT 'pending',
    shared_with_patient BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);
