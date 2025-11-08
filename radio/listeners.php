<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

// Habilitar errores para debug (quítalo en producción)
error_reporting(E_ALL);
ini_set('display_errors', 1);

$file = 'listeners.json';
$timeout = 30 * 24 * 60 * 60; // 30 días en segundos

// Cargar datos
function load() {
    global $file;
    if (!file_exists($file)) {
        file_put_contents($file, '{}'); // Crear si no existe
        return [];
    }
    $json = file_get_contents($file);
    $data = json_decode($json, true);
    return is_array($data) ? $data : [];
}

// Guardar datos
function save($data) {
    global $file;
    // Verificar permisos de escritura
    if (!is_writable(dirname($file))) {
        http_response_code(500);
        echo json_encode(['error' => 'No writable permissions on ' . $file]);
        exit;
    }
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
    // Verificar Content-Type para JSON
    $contentType = isset($_SERVER['CONTENT_TYPE']) ? trim($_SERVER['CONTENT_TYPE']) : '';
    if (strpos($contentType, 'application/json') === false) {
        http_response_code(400);
        echo json_encode(['error' => 'Content-Type must be application/json']);
        exit;
    }
    
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON: ' . json_last_error_msg()]);
        exit;
    }
    
    $id = $data['id'] ?? 'unknown_' . time();
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

// === Error por defecto ===
http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
?>
