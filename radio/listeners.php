<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

$file = 'listeners.json';
$timeout = 30 * 24 * 60 * 60; // 30 días

function load() {
    global $file;
    if (!file_exists($file)) file_put_contents($file, '{}');
    return json_decode(file_get_contents($file), true) ?: [];
}

function save($data) {
    global $file;
    file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT));
}

function clean($users) {
    global $timeout;
    $now = time();
    foreach ($users as $ip => $time) {
        if ($now - $time > $timeout) unset($users[$ip]);
    }
    return $users;
}

// === POST: Registrar IP al pulsar "Iniciar Emisión"
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $users = clean(load());
    $wasNew = !isset($users[$ip]);
    $users[$ip] = time();
    save($users);
    echo json_encode(['count' => count($users), 'new' => $wasNew]);
    exit;
}

// === GET: Devolver conteo total
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $users = clean(load());
    echo json_encode(['count' => count($users)]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
?>
