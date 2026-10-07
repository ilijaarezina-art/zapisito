-- ========================================================
-- LIVE BAZA: bookmymurs_zapisi_to
-- KORISNIK: bookmymurs_ilija
-- ========================================================

USE `bookmymurs_zapisi_to`;

-- 1. Tabela: role
CREATE TABLE IF NOT EXISTS `role` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `naziv` VARCHAR(50) NOT NULL UNIQUE,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `role` (`id`, `naziv`) VALUES
(1, 'admin'),
(2, 'korisnik')
ON DUPLICATE KEY UPDATE `naziv`=VALUES(`naziv`);

-- 2. Tabela: korisnici
CREATE TABLE IF NOT EXISTS `korisnici` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `role_id` INT UNSIGNED NOT NULL DEFAULT 2,
  `korisnicko_ime` VARCHAR(100) NOT NULL UNIQUE,
  `lozinka` VARCHAR(255) NOT NULL COMMENT 'BCrypt hash lozinke',
  `ime` VARCHAR(100) NULL,
  `prezime` VARCHAR(100) NULL,
  `broj_telefona` VARCHAR(50) NULL,
  `email` VARCHAR(150) NULL,
  `token_active` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0 = Nema pretplatu (10 besplatnih), 1 = Aktivna pretplata',
  `besplatni_unosi_iskorisceno` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Broji do 10 besplatnih unosa',
  `token_expires_at` DATETIME NULL COMMENT 'Datum i vreme do kada važi mesečna pretplata',
  `token_updated_at` DATETIME NULL COMMENT 'Kada je admin poslednji put ažurirao pretplatu',
  `poslednja_sinhronizacija` DATETIME NULL COMMENT 'Poslednji kontakt telefona sa serverom',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = Aktivan nalog, 0 = Blokiran',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_korisnici_role` FOREIGN KEY (`role_id`) REFERENCES `role` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ubacivanje Super Admin korisnika: ilija / Ilija1976 (BCrypt hash)
INSERT INTO `korisnici` (
  `id`, 
  `role_id`, 
  `korisnicko_ime`, 
  `lozinka`, 
  `ime`, 
  `token_active`, 
  `token_expires_at`, 
  `created_at`
) VALUES (
  1, 
  1, 
  'ilija', 
  '$2b$10$U2K8X1q1V87oZ76D.gNf/ez.6vP8j14mY9gU90Pj9W2G7oB2J/9Oq', -- Heš za Ilija1976
  'Ilija (Super Admin)', 
  1, 
  '2099-12-31 23:59:59', 
  NOW()
) ON DUPLICATE KEY UPDATE `korisnicko_ime`=VALUES(`korisnicko_ime`);

-- 3. Tabela: podsetnici
CREATE TABLE IF NOT EXISTS `podsetnici` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `uuid_lokalni` VARCHAR(64) NOT NULL UNIQUE COMMENT 'UUID generisan na telefonu pre slanja',
  `korisnik_id` INT UNSIGNED NOT NULL,
  `sirovi_tekst` TEXT NOT NULL,
  `klijent_ime` VARCHAR(150) NULL,
  `lokacija` VARCHAR(150) NULL,
  `iznos` DECIMAL(10, 2) NULL DEFAULT 0.00,
  `valuta` ENUM('RSD', 'EUR') NOT NULL DEFAULT 'RSD',
  `je_kapara` TINYINT(1) NOT NULL DEFAULT 0,
  `rok_datum` DATETIME NULL,
  `opis_zadatka` TEXT NULL,
  `je_zavrseno` TINYINT(1) NOT NULL DEFAULT 0,
  `kreirano_na_uredjaju` DATETIME NOT NULL,
  `sinhronizovano_u` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_podsetnici_korisnik` FOREIGN KEY (`korisnik_id`) REFERENCES `korisnici` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabela: pretplate_istorija
CREATE TABLE IF NOT EXISTS `pretplate_istorija` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `korisnik_id` INT UNSIGNED NOT NULL,
  `admin_id` INT UNSIGNED NOT NULL,
  `dodeljeno_dana` INT NOT NULL DEFAULT 30,
  `novi_rok` DATETIME NOT NULL,
  `napomena` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_istorija_korisnik` FOREIGN KEY (`korisnik_id`) REFERENCES `korisnici` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_istorija_admin` FOREIGN KEY (`admin_id`) REFERENCES `korisnici` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
