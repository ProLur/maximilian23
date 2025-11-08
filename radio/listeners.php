<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

$file = 'listeners.json';
$timeout = 30 * 24 * 60 * 60; // 30 días en segundos

// Cargar datos
function load() {
    global $file;
    if (!file_exists($file)) return [];
    $json = file_get_contents($file);
    return json_decode($json, true) ?: [];
}

// Guardar datos
function save($data) {
    global $file;
    file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT));
}

// Limpiar inactivos
function cleanInactive($users) {
    global $timeout;
    $now = time();
    foreach ($users as $id => $lastSeen) {
        if ($now - $lastSeen > $timeout) {
            unset($users[$id]);
        }
    }
    return $users;
}

// === POST: Registrar usuario ===
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = $input['id'] ?? 'unknown_' . time();
    $users = load();
    $users[$id] = time();
    $users = cleanInactive($users);
    save($users);
    echo json_encode(['count' => count($users)]);
    exit;
}

// === GET: Obtener contador ===
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $users = load();
    $users = cleanInactive($users);
    save($users);
    echo json_encode(['count' => count($users)]);
    exit;
}
?>
