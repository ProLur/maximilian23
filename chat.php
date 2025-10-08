<?php
$input = json_decode(file_get_contents("php://input"), true);
$userMessage = $input["text"] ?? "";

// 🔑 define aquí tus claves (max1 y max2)
$tokens = [
    "max1" => "gsk_xxxxxxxxxxxxxxxxxxxxxxxxx", 
    "max2" => "gsk_yyyyyyyyyyyyyyyyyyyyyyyy"
];

// 👉 puedes cambiar "max1" por "max2" según el que quieras usar
$useToken = $tokens["max1"];

// Modelo Groq que quieras usar (ejemplo: llama-3.1-70b-versatile)
$model = "llama-3.1-70b-versatile";

$url = "https://api.groq.com/openai/v1/chat/completions";

$data = [
    "model" => $model,
    "messages" => [
        ["role" => "system", "content" => "Eres Maximilian 23, asistente del colegio Juan XXIII."],
        ["role" => "user", "content" => $userMessage]
    ]
];

$options = [
    "http" => [
        "header"  => "Authorization: Bearer $useToken\r\nContent-Type: application/json\r\n",
        "method"  => "POST",
        "content" => json_encode($data),
        "timeout" => 60
    ]
];

$context  = stream_context_create($options);
$result = file_get_contents($url, false, $context);

if ($result === FALSE) {
    echo json_encode(["reply" => "Error al conectar con Groq API"]);
    exit;
}

$response = json_decode($result, true);

// La respuesta de Groq está en choices[0].message.content
$reply = $response["choices"][0]["message"]["content"] ?? "No entendí la respuesta.";

echo json_encode(["reply" => $reply]);
