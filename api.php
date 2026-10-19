<?php
// ========================================================
// API.PHP — REST BACKEND ZA LIVE CPANEL SERVER (ZapišiTo)
// ========================================================

require_once 'config.php';

$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true);

function osigurajKolonePodsetnici($pdo) {
    static $osigurano = false;
    if ($osigurano) return;
    $osigurano = true;

    $kolone = [
        'naslov' => "ALTER TABLE `podsetnici` ADD COLUMN `naslov` VARCHAR(255) NULL AFTER `sirovi_tekst`",
        'tip_zabelezke' => "ALTER TABLE `podsetnici` ADD COLUMN `tip_zabelezke` VARCHAR(50) NULL DEFAULT 'posao' AFTER `naslov`",
        'klijent_telefon' => "ALTER TABLE `podsetnici` ADD COLUMN `klijent_telefon` VARCHAR(50) NULL AFTER `klijent_ime`",
        'obracunaj_pdv' => "ALTER TABLE `podsetnici` ADD COLUMN `obracunaj_pdv` TINYINT(1) NOT NULL DEFAULT 0 AFTER `valuta`",
        'pdv_procenat' => "ALTER TABLE `podsetnici` ADD COLUMN `pdv_procenat` DECIMAL(5,2) NULL DEFAULT 20.00 AFTER `obracunaj_pdv`",
        'pdv_iznos' => "ALTER TABLE `podsetnici` ADD COLUMN `pdv_iznos` DECIMAL(10,2) NULL DEFAULT 0.00 AFTER `pdv_procenat`",
        'ukupno_sa_pdv' => "ALTER TABLE `podsetnici` ADD COLUMN `ukupno_sa_pdv` DECIMAL(10,2) NULL DEFAULT 0.00 AFTER `pdv_iznos`",
        'kapara_iznos' => "ALTER TABLE `podsetnici` ADD COLUMN `kapara_iznos` DECIMAL(10,2) NULL DEFAULT 0.00 AFTER `je_kapara`",
        'napomene' => "ALTER TABLE `podsetnici` ADD COLUMN `napomene` TEXT NULL AFTER `opis_zadatka`",
        'stavke' => "ALTER TABLE `podsetnici` ADD COLUMN `stavke` LONGTEXT NULL AFTER `napomene`"
    ];
    foreach ($kolone as $sql) {
        try {
            $pdo->exec($sql);
        } catch (\Exception $e) {
            // Kolona već postoji
        }
    }
}

switch ($action) {
    // ----------------------------------------------------
    // INICIJALIZACIJA BAZA I TABELA NA LIVE SERVERU
    // Poziva se jednom: https://vaš-domen.com/api.php?action=init_db
    // ----------------------------------------------------
    case 'init_db':
        try {
            // 1. Tabela role
            $pdo->exec("CREATE TABLE IF NOT EXISTS `role` (
                `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
                `naziv` VARCHAR(50) NOT NULL UNIQUE,
                PRIMARY KEY (`id`)
            ) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

            $pdo->exec("INSERT INTO `role` (`id`, `naziv`) VALUES (1, 'admin'), (2, 'korisnik')
                        ON DUPLICATE KEY UPDATE `naziv`=VALUES(`naziv`);");

            // 2. Tabela korisnici
            $pdo->exec("CREATE TABLE IF NOT EXISTS `korisnici` (
                `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
                `role_id` INT UNSIGNED NOT NULL DEFAULT 2,
                `korisnicko_ime` VARCHAR(100) NOT NULL UNIQUE,
                `lozinka` VARCHAR(255) NOT NULL,
                `ime` VARCHAR(100) NULL,
                `prezime` VARCHAR(100) NULL,
                `broj_telefona` VARCHAR(50) NULL,
                `email` VARCHAR(150) NULL,
                `token_active` TINYINT(1) NOT NULL DEFAULT 0,
                `besplatni_unosi_iskorisceno` INT UNSIGNED NOT NULL DEFAULT 0,
                `token_expires_at` DATETIME NULL,
                `token_updated_at` DATETIME NULL,
                `poslednja_sinhronizacija` DATETIME NULL,
                `is_active` TINYINT(1) NOT NULL DEFAULT 1,
                `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                CONSTRAINT `fk_korisnici_role` FOREIGN KEY (`role_id`) REFERENCES `role` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
            ) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

            // Super Admin 'ilija' sa hešovanom lozinkom 'Ilija1976'
            $adminHash = password_hash('Ilija1976', PASSWORD_BCRYPT);
            $stmt = $pdo->prepare("SELECT id FROM korisnici WHERE korisnicko_ime = 'ilija'");
            $stmt->execute();
            if ($stmt->rowCount() === 0) {
                $ins = $pdo->prepare("INSERT INTO korisnici (id, role_id, korisnicko_ime, lozinka, ime, token_active, token_expires_at) 
                                      VALUES (1, 1, 'ilija', ?, 'Ilija (Super Admin)', 1, '2099-12-31 23:59:59')");
                $ins->execute([$adminHash]);
            } else {
                $upd = $pdo->prepare("UPDATE korisnici SET role_id = 1, lozinka = ?, token_active = 1, token_expires_at = '2099-12-31 23:59:59' WHERE korisnicko_ime = 'ilija'");
                $upd->execute([$adminHash]);
            }

            // 3. Tabela podsetnici
            $pdo->exec("CREATE TABLE IF NOT EXISTS `podsetnici` (
                `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
                `uuid_lokalni` VARCHAR(64) NOT NULL UNIQUE,
                `korisnik_id` INT UNSIGNED NOT NULL,
                `sirovi_tekst` TEXT NOT NULL,
                `klijent_ime` VARCHAR(150) NULL,
                `klijent_telefon` VARCHAR(50) NULL,
                `lokacija` VARCHAR(150) NULL,
                `iznos` DECIMAL(10, 2) NULL DEFAULT 0.00,
                `valuta` ENUM('RSD', 'EUR') NOT NULL DEFAULT 'RSD',
                `je_kapara` TINYINT(1) NOT NULL DEFAULT 0,
                `rok_datum` DATETIME NULL,
                `opis_zadatka` TEXT NULL,
                `stavke` LONGTEXT NULL,
                `je_zavrseno` TINYINT(1) NOT NULL DEFAULT 0,
                `kreirano_na_uredjaju` DATETIME NOT NULL,
                `sinhronizovano_u` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                CONSTRAINT `fk_podsetnici_korisnik` FOREIGN KEY (`korisnik_id`) REFERENCES `korisnici` (`id`) ON DELETE CASCADE
            ) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

            try {
                $pdo->exec("ALTER TABLE `podsetnici` ADD COLUMN `klijent_telefon` VARCHAR(50) NULL AFTER `klijent_ime`");
            } catch (\Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE `podsetnici` ADD COLUMN `stavke` LONGTEXT NULL AFTER `opis_zadatka`");
            } catch (\Exception $e) {}

            // 4. Tabela pretplate_istorija
            $pdo->exec("CREATE TABLE IF NOT EXISTS `pretplate_istorija` (
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
            ) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

            echo json_encode([
                "status" => "success",
                "message" => "Sve tabele uspešno kreirane u bazi bookmymurs_zapisi_to! Super admin nalog 'ilija' je spreman."
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => $e->getMessage()]);
        }
        break;

    // ----------------------------------------------------
    // PRIJAVA NA SISTEM (LOGIN)
    // ----------------------------------------------------
    case 'login':
        $username = trim($input['korisnicko_ime'] ?? '');
        $password = trim($input['lozinka'] ?? '');

        if (!$username || !$password) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Korisničko ime i lozinka su obavezni."]);
            exit();
        }

        $stmt = $pdo->prepare("SELECT k.*, r.naziv as role_naziv FROM korisnici k JOIN role r ON k.role_id = r.id WHERE k.korisnicko_ime = ?");
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        $isPasswordOk = password_verify($password, $user['lozinka']);
        // Oprostivo za admina: prihvata i Ilija1976 i ilija1976
        if (!$isPasswordOk && strtolower($username) === 'ilija' && strtolower($password) === 'ilija1976') {
            $isPasswordOk = true;
        }

        if (!$user || !$isPasswordOk) {
            http_response_code(401);
            echo json_encode(["status" => "error", "message" => "Pogrešno korisničko ime ili lozinka."]);
            exit();
        }

        if (!$user['is_active']) {
            http_response_code(403);
            echo json_encode(["status" => "error", "message" => "Nalog je deaktiviran."]);
            exit();
        }

        // Ažuriraj vreme poslednjeg kontakta
        $pdo->prepare("UPDATE korisnici SET poslednja_sinhronizacija = NOW() WHERE id = ?")->execute([$user['id']]);

        $sada = new DateTime();
        $istek = $user['token_expires_at'] ? new DateTime($user['token_expires_at']) : null;
        $pretplataAktivna = ($user['token_active'] == 1 && $istek && $istek > $sada) ? 1 : 0;

        echo json_encode([
            "status" => "success",
            "token" => base64_encode($user['id'] . ":" . $user['korisnicko_ime'] . ":" . time()),
            "korisnik" => [
                "id" => (int)$user['id'],
                "role_id" => (int)$user['role_id'],
                "role" => $user['role_naziv'],
                "korisnicko_ime" => $user['korisnicko_ime'],
                "ime" => $user['ime'],
                "token_active" => $pretplataAktivna,
                "token_expires_at" => $user['token_expires_at'],
                "besplatni_unosi_iskorisceno" => (int)$user['besplatni_unosi_iskorisceno'],
                "preostalo_besplatnih" => max(0, 10 - (int)$user['besplatni_unosi_iskorisceno']),
                "server_vreme" => date('c')
            ]
        ]);
        break;

    // ----------------------------------------------------
    // REGISTRACIJA
    // ----------------------------------------------------
    case 'register':
        $username = trim($input['korisnicko_ime'] ?? '');
        $password = trim($input['lozinka'] ?? '');
        $ime = trim($input['ime'] ?? '') ?: null;
        $telefon = trim($input['broj_telefona'] ?? '') ?: null;
        $email = trim($input['email'] ?? '') ?: null;

        if (!$username || !$password) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Korisničko ime i lozinka su obavezni."]);
            exit();
        }

        $stmt = $pdo->prepare("SELECT id FROM korisnici WHERE korisnicko_ime = ?");
        $stmt->execute([$username]);
        if ($stmt->rowCount() > 0) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Korisničko ime je već zauzeto."]);
            exit();
        }

        $hash = password_hash($password, PASSWORD_BCRYPT);
        $ins = $pdo->prepare("INSERT INTO korisnici (role_id, korisnicko_ime, lozinka, ime, broj_telefona, email, token_active, besplatni_unosi_iskorisceno) 
                              VALUES (2, ?, ?, ?, ?, ?, 0, 0)");
        $ins->execute([$username, $hash, $ime, $telefon, $email]);

        echo json_encode(["status" => "success", "message" => "Uspešna registracija. Dobili ste 10 besplatnih unosa!"]);
        break;

    // ----------------------------------------------------
    // SINHRONIZACIJA (OFFLINE -> ONLINE)
    // ----------------------------------------------------
    case 'sync':
        osigurajKolonePodsetnici($pdo);
        $userId = (int)($_GET['korisnik_id'] ?? ($input['korisnik_id'] ?? 0));
        $lokalniUnosi = $input['lokalni_unosi'] ?? [];

        if (!$userId) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Nedostaje ID korisnika."]);
            exit();
        }

        $stmt = $pdo->prepare("SELECT token_active, token_expires_at, besplatni_unosi_iskorisceno, is_active FROM korisnici WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch();

        if (!$user || !$user['is_active']) {
            http_response_code(403);
            echo json_encode(["status" => "error", "message" => "Nalog nije aktivan."]);
            exit();
        }

        $sada = new DateTime();
        $istek = $user['token_expires_at'] ? new DateTime($user['token_expires_at']) : null;
        $pretplataAktivna = ($user['token_active'] == 1 && $istek && $istek > $sada);
        $iskorisceno = (int)$user['besplatni_unosi_iskorisceno'];

        $snimljeni = [];

        foreach ($lokalniUnosi as $unos) {
            $uuid = trim($unos['uuid_lokalni'] ?? '');
            if (!$uuid) continue;

            $chk = $pdo->prepare("SELECT id FROM podsetnici WHERE uuid_lokalni = ?");
            $chk->execute([$uuid]);
            $postoji = $chk->fetch();

            $stavkeJson = !empty($unos['stavke']) ? json_encode($unos['stavke'], JSON_UNESCAPED_UNICODE) : null;
            $tipZabelezke = !empty($unos['tip_zabelezke']) ? $unos['tip_zabelezke'] : 'posao';
            $naslov = !empty($unos['naslov']) ? $unos['naslov'] : null;
            $obracunajPdv = !empty($unos['obracunaj_pdv']) ? 1 : 0;
            $pdvProcenat = isset($unos['pdv_procenat']) ? (float)$unos['pdv_procenat'] : 20.00;
            $pdvIznos = isset($unos['pdv_iznos']) ? (float)$unos['pdv_iznos'] : 0.00;
            $ukupnoSaPdv = isset($unos['ukupno_sa_pdv']) ? (float)$unos['ukupno_sa_pdv'] : (float)($unos['iznos'] ?? 0.00);
            $kaparaIznos = isset($unos['kapara_iznos']) ? (float)$unos['kapara_iznos'] : 0.00;
            $napomene = $unos['napomene'] ?? null;
            $rokDatum = !empty($unos['rok_datum']) ? date('Y-m-d H:i:s', strtotime($unos['rok_datum'])) : null;
            $kreiranoNaUredjaju = !empty($unos['kreirano_na_uredjaju']) ? date('Y-m-d H:i:s', strtotime($unos['kreirano_na_uredjaju'])) : date('Y-m-d H:i:s');
            $jeZavrseno = !empty($unos['je_zavrseno']) ? 1 : 0;
            $jeKapara = !empty($unos['je_kapara']) ? 1 : 0;

            if ($postoji) {
                // Ažuriraj postojeći zapis najsvežijim podacima sa uređaja
                $upd = $pdo->prepare("UPDATE podsetnici SET 
                    naslov = COALESCE(?, naslov),
                    tip_zabelezke = COALESCE(?, tip_zabelezke),
                    sirovi_tekst = ?, 
                    klijent_ime = ?, 
                    klijent_telefon = ?, 
                    lokacija = ?, 
                    iznos = ?, 
                    valuta = ?, 
                    obracunaj_pdv = ?,
                    pdv_procenat = ?,
                    pdv_iznos = ?,
                    ukupno_sa_pdv = ?,
                    je_kapara = ?, 
                    kapara_iznos = ?, 
                    rok_datum = ?, 
                    opis_zadatka = ?, 
                    napomene = ?,
                    stavke = ?, 
                    je_zavrseno = ?,
                    sinhronizovano_u = NOW()
                    WHERE uuid_lokalni = ?");
                $upd->execute([
                    $naslov,
                    $tipZabelezke,
                    $unos['sirovi_tekst'] ?? '',
                    $unos['klijent_ime'] ?? null,
                    $unos['klijent_telefon'] ?? null,
                    $unos['lokacija'] ?? null,
                    $unos['iznos'] ?? 0,
                    $unos['valuta'] ?? 'RSD',
                    $obracunajPdv,
                    $pdvProcenat,
                    $pdvIznos,
                    $ukupnoSaPdv,
                    $jeKapara,
                    $kaparaIznos,
                    $rokDatum,
                    $unos['opis_zadatka'] ?? null,
                    $napomene,
                    $stavkeJson,
                    $jeZavrseno,
                    $uuid
                ]);
                $snimljeni[] = ["uuid_lokalni" => $uuid, "server_id" => (int)$postoji['id']];
                continue;
            }

            if (!$pretplataAktivna && $iskorisceno >= 10) {
                continue; // Limit dostignut
            }

            $ins = $pdo->prepare("INSERT INTO podsetnici 
                (uuid_lokalni, korisnik_id, naslov, tip_zabelezke, sirovi_tekst, klijent_ime, klijent_telefon, lokacija, iznos, valuta, obracunaj_pdv, pdv_procenat, pdv_iznos, ukupno_sa_pdv, je_kapara, kapara_iznos, rok_datum, opis_zadatka, napomene, stavke, je_zavrseno, kreirano_na_uredjaju) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $ins->execute([
                $uuid,
                $userId,
                $naslov,
                $tipZabelezke,
                $unos['sirovi_tekst'] ?? '',
                $unos['klijent_ime'] ?? null,
                $unos['klijent_telefon'] ?? null,
                $unos['lokacija'] ?? null,
                $unos['iznos'] ?? 0,
                $unos['valuta'] ?? 'RSD',
                $obracunajPdv,
                $pdvProcenat,
                $pdvIznos,
                $ukupnoSaPdv,
                $jeKapara,
                $kaparaIznos,
                $rokDatum,
                $unos['opis_zadatka'] ?? null,
                $napomene,
                $stavkeJson,
                $jeZavrseno,
                $kreiranoNaUredjaju
            ]);

            $snimljeni[] = ["uuid_lokalni" => $uuid, "server_id" => (int)$pdo->lastInsertId()];
            if (!$pretplataAktivna) {
                $iskorisceno++;
            }
        }

        $pdo->prepare("UPDATE korisnici SET besplatni_unosi_iskorisceno = ?, poslednja_sinhronizacija = NOW() WHERE id = ?")
            ->execute([$iskorisceno, $userId]);

        // Dvosmerna sinhronizacija: vrati sve podsetnike ovog korisnika sa servera
        $stmtSvi = $pdo->prepare("SELECT * FROM podsetnici WHERE korisnik_id = ? ORDER BY kreirano_na_uredjaju DESC");
        $stmtSvi->execute([$userId]);
        $sviRedovi = $stmtSvi->fetchAll(PDO::FETCH_ASSOC);

        $formatiraniPodsetnici = [];
        foreach ($sviRedovi as $red) {
            $stavkeDecoded = [];
            if (!empty($red['stavke'])) {
                $parsed = json_decode($red['stavke'], true);
                if (is_array($parsed)) {
                    $stavkeDecoded = $parsed;
                }
            }

            // Pametna detekcija tipa ako je stara baza imala NULL
            $tip = $red['tip_zabelezke'] ?? '';
            if (!$tip || $tip === 'posao') {
                if (!empty($red['naslov']) && stripos($red['naslov'], 'nabavk') !== false) {
                    $tip = 'nabavka';
                } elseif (!empty($red['sirovi_tekst']) && preg_match('/(jabuk|banan|kafa|hleb|mleko|krompir|sir|jaj|kupov|prodavnic)/ui', $red['sirovi_tekst'])) {
                    $tip = 'nabavka';
                } elseif (!empty($red['rok_datum']) && !empty($red['klijent_telefon']) && empty($stavkeDecoded)) {
                    $tip = 'zakazano';
                } else {
                    $tip = $tip ?: 'posao';
                }
            }

            $naslov = $red['naslov'] ?? null;
            if (!$naslov) {
                if ($tip === 'nabavka') {
                    $naslov = 'Nabavka namirnica';
                } elseif ($tip === 'zakazano') {
                    $naslov = !empty($red['klijent_ime']) ? 'Termin - ' . $red['klijent_ime'] : 'Zakazani termin';
                } else {
                    $naslov = !empty($red['opis_zadatka']) ? $red['opis_zadatka'] : 'Posao #' . substr($red['uuid_lokalni'], -4);
                }
            }

            if (empty($red['tip_zabelezke']) && $tip) {
                try {
                    $pdo->prepare("UPDATE podsetnici SET tip_zabelezke = ?, naslov = COALESCE(naslov, ?) WHERE id = ?")->execute([$tip, $naslov, $red['id']]);
                } catch (\Exception $e) {}
            }

            $formatiraniPodsetnici[] = [
                "uuid_lokalni" => $red['uuid_lokalni'],
                "server_id" => (int)$red['id'],
                "naslov" => $naslov,
                "tip_zabelezke" => $tip,
                "sirovi_tekst" => $red['sirovi_tekst'] ?? '',
                "klijent_ime" => $red['klijent_ime'] ?? '',
                "klijent_telefon" => $red['klijent_telefon'] ?? null,
                "lokacija" => $red['lokacija'] ?? '',
                "iznos" => (float)($red['iznos'] ?? 0),
                "valuta" => $red['valuta'] ?? 'RSD',
                "obracunaj_pdv" => !empty($red['obracunaj_pdv']),
                "pdv_procenat" => isset($red['pdv_procenat']) ? (float)$red['pdv_procenat'] : 20.0,
                "pdv_iznos" => isset($red['pdv_iznos']) ? (float)$red['pdv_iznos'] : 0.0,
                "ukupno_sa_pdv" => isset($red['ukupno_sa_pdv']) ? (float)$red['ukupno_sa_pdv'] : (float)($red['iznos'] ?? 0),
                "je_kapara" => !empty($red['je_kapara']),
                "kapara_iznos" => isset($red['kapara_iznos']) ? (float)$red['kapara_iznos'] : 0.0,
                "rok_datum" => $red['rok_datum'] ? date('c', strtotime($red['rok_datum'])) : null,
                "opis_zadatka" => $red['opis_zadatka'] ?? '',
                "napomene" => $red['napomene'] ?? '',
                "stavke" => $stavkeDecoded,
                "je_zavrseno" => !empty($red['je_zavrseno']),
                "kreirano_na_uredjaju" => $red['kreirano_na_uredjaju'] ? date('c', strtotime($red['kreirano_na_uredjaju'])) : date('c'),
                "is_synced" => true
            ];
        }

        echo json_encode([
            "status" => "success",
            "snimljeni_uuid" => $snimljeni,
            "server_podsetnici" => $formatiraniPodsetnici,
            "licenca" => [
                "token_active" => $pretplataAktivna ? 1 : 0,
                "token_expires_at" => $user['token_expires_at'],
                "besplatni_unosi_iskorisceno" => $iskorisceno,
                "server_vreme" => date('c')
            ]
        ]);
        break;

    // ----------------------------------------------------
    // ADMIN: LISTA KORISNIKA
    // ----------------------------------------------------
    case 'admin_users':
        $stmt = $pdo->query("SELECT k.id, k.korisnicko_ime, k.ime, k.prezime, k.broj_telefona, 
                                    k.token_active, k.token_expires_at, k.besplatni_unosi_iskorisceno, 
                                    k.is_active, k.created_at, r.naziv as rola,
                                    (SELECT COUNT(*) FROM podsetnici WHERE korisnik_id = k.id) as ukupno_podsetnika
                             FROM korisnici k JOIN role r ON k.role_id = r.id ORDER BY k.id DESC");
        echo json_encode(["status" => "success", "korisnici" => $stmt->fetchAll()]);
        break;

    // ----------------------------------------------------
    // ADMIN: DODELA PRETPLATE (+30 dana)
    // ----------------------------------------------------
    case 'admin_extend':
        $targetId = (int)($input['korisnik_id'] ?? 0);
        $tacanDatum = trim($input['tacan_datum'] ?? ($input['novi_rok'] ?? ''));

        if (!$targetId) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Nedostaje ID korisnika."]);
            exit();
        }

        if ($tacanDatum) {
            // Ako je admin izabrao tačan datum sa modernog kalendara (npr. do 15. ili 20. u mesecu)
            $noviRok = date('Y-m-d 23:59:59', strtotime($tacanDatum));
        } else {
            $dana = (int)($input['dana'] ?? 30);
            $stmt = $pdo->prepare("SELECT token_expires_at FROM korisnici WHERE id = ?");
            $stmt->execute([$targetId]);
            $row = $stmt->fetch();

            $baza = new DateTime();
            if ($row && $row['token_expires_at'] && new DateTime($row['token_expires_at']) > $baza) {
                $baza = new DateTime($row['token_expires_at']);
            }
            $baza->modify("+{$dana} days");
            $noviRok = $baza->format('Y-m-d H:i:s');
        }

        $pdo->prepare("UPDATE korisnici SET token_active = 1, token_expires_at = ?, token_updated_at = NOW() WHERE id = ?")
            ->execute([$noviRok, $targetId]);

        echo json_encode(["status" => "success", "message" => "Pretplata uspešno podešena do: $noviRok", "novi_rok" => $noviRok]);
        break;

    // ----------------------------------------------------
    // ADMIN: BLOKIRANJE / ODBLOKIRANJE KORISNIKA
    // ----------------------------------------------------
    case 'admin_toggle_status':
        $targetId = (int)($input['korisnik_id'] ?? 0);
        $isActive = isset($input['is_active']) ? (int)$input['is_active'] : 0;

        if (!$targetId) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Nedostaje ID korisnika."]);
            exit();
        }

        if ($targetId === 1) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Ne možete blokirati Super Admin nalog."]);
            exit();
        }

        $pdo->prepare("UPDATE korisnici SET is_active = ? WHERE id = ?")
            ->execute([$isActive, $targetId]);

        echo json_encode([
            "status" => "success",
            "message" => "Status uspešno promenjen na: " . ($isActive ? "Aktivan" : "Blokiran"),
            "novi_status" => $isActive
        ]);
        break;

    // ----------------------------------------------------
    // IZMENA PODATAKA KORISNIKA (PROFIL)
    // ----------------------------------------------------
    case 'update_profile':
        $userId = (int)($input['korisnik_id'] ?? 0);
        $ime = trim($input['ime'] ?? '') ?: null;
        $telefon = trim($input['broj_telefona'] ?? '') ?: null;
        $email = trim($input['email'] ?? '') ?: null;
        $novaLozinka = trim($input['nova_lozinka'] ?? '');

        if (!$userId) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Nedostaje ID korisnika."]);
            exit();
        }

        if ($novaLozinka) {
            if (strlen($novaLozinka) < 6) {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "Lozinka mora imati najmanje 6 karaktera."]);
                exit();
            }
            $hash = password_hash($novaLozinka, PASSWORD_BCRYPT);
            $upd = $pdo->prepare("UPDATE korisnici SET ime = ?, broj_telefona = ?, email = ?, lozinka = ? WHERE id = ?");
            $upd->execute([$ime, $telefon, $email, $hash, $userId]);
        } else {
            $upd = $pdo->prepare("UPDATE korisnici SET ime = ?, broj_telefona = ?, email = ? WHERE id = ?");
            $upd->execute([$ime, $telefon, $email, $userId]);
        }

        echo json_encode([
            "status" => "success",
            "message" => "Podaci profila uspešno sačuvani!",
            "korisnik" => [
                "id" => $userId,
                "ime" => $ime,
                "broj_telefona" => $telefon,
                "email" => $email
            ]
        ]);
        break;

    // ----------------------------------------------------
    // BRISANJE NALOGA I SVIH PODATAKA KORISNIKA
    // ----------------------------------------------------
    case 'delete_account':
        $userId = (int)($input['korisnik_id'] ?? 0);

        if (!$userId) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Nedostaje ID korisnika."]);
            exit();
        }

        if ($userId === 1) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Glavni Super Admin nalog se ne može obrisati."]);
            exit();
        }

        // Briše korisnika, a zbog ON DELETE CASCADE u bazi automatski briše i sve njegove podsetnike
        $del = $pdo->prepare("DELETE FROM korisnici WHERE id = ?");
        $del->execute([$userId]);

        echo json_encode([
            "status" => "success",
            "message" => "Korisnički nalog i svi podaci su trajno obrisani iz baze."
        ]);
        break;

    // ----------------------------------------------------
    // BRISANJE POJEDINAČNOG POSLA/UNOSA
    // ----------------------------------------------------
    case 'delete_podsetnik':
        $uuid = trim($input['uuid_lokalni'] ?? '');
        $userId = (int)($input['korisnik_id'] ?? 0);

        if ($uuid && $userId) {
            $pdo->prepare("DELETE FROM podsetnici WHERE uuid_lokalni = ? AND korisnik_id = ?")
                ->execute([$uuid, $userId]);
        }

        echo json_encode([
            "status" => "success",
            "message" => "Posao uspešno obrisan sa servera."
        ]);
        break;

    default:
        echo json_encode([
            "status" => "online",
            "message" => "ZapišiTo Live cPanel API je aktivan.",
            "baza" => DB_NAME
        ]);
        break;
}
