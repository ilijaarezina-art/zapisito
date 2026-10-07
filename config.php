<?php
// ========================================================
// CONFIG.PHP — LIVE CPANEL MYSQL BAZA ZA ZapišiTo
// ========================================================

define('DB_HOST', 'localhost');
define('DB_NAME', 'bookmymurs_zapisi_to');
define('DB_USER', 'bookmymurs_ilija');
define('DB_PASS', 'Stefan5656!');

// CORS zaglavlja za komunikaciju sa mobilnom i web aplikacijom
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Neuspešna konekcija na bazu: " . $e->getMessage()]);
    exit();
}
