<?php

declare(strict_types=1);

header('Content-Type: application/json');
header('Cache-Control: no-store');

require_once __DIR__ . '/../includes/storage.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        handle_get();
    } elseif ($method === 'POST') {
        handle_post();
    } else {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
    }
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

die();

function handle_get(): void
{
    $storage = vea_load_storage();
    $mode = $_GET['mode'] ?? 'list';

    switch ($mode) {
        case 'list':
            $data = [
                'parents' => vea_list_access($storage),
                'updated_at' => vea_current_timestamp(),
            ];
            echo json_encode($data);
            return;
        case 'parent':
            $parentId = isset($_GET['parent_id']) ? (int) $_GET['parent_id'] : 0;
            $summary = vea_parent_summary($parentId, $storage);
            echo json_encode($summary);
            return;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Unknown mode']);
            return;
    }
}

function handle_post(): void
{
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $action = $input['action'] ?? '';

    switch ($action) {
        case 'grant':
            handle_grant($input);
            return;
        case 'revoke':
            handle_revoke($input);
            return;
        case 'verifyPayment':
            handle_verify_payment($input);
            return;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Unknown action']);
            return;
    }
}

function handle_grant(array $input): void
{
    $parentId = (int) ($input['parent_id'] ?? 0);
    $studentId = (int) ($input['student_id'] ?? 0);
    $term = vea_normalize_term($input['term'] ?? '');
    $session = vea_normalize_session($input['session'] ?? '');

    $storage = vea_load_storage();
    $parent = vea_find_parent($parentId, $storage);
   $student = vea_find_student($studentId, $storage);

    if (!$parent) {
        http_response_code(404);
        echo json_encode(['error' => 'Parent not found']);
        return;
    }
    if (!$student) {
        http_response_code(404);
        echo json_encode(['error' => 'Student not found']);
        return;
    }
    if (!in_array($studentId, $parent['students'], true)) {
        http_response_code(400);
        echo json_encode(['error' => 'Student is not linked to this parent']);
        return;
    }

    $record = vea_grant_access($parentId, $studentId, $term, $session, 'manual');

    echo json_encode(['success' => true, 'record' => $record, 'message' => 'Access granted manually.']);
}

function handle_revoke(array $input): void
{
    $parentId = (int) ($input['parent_id'] ?? 0);
    $studentId = (int) ($input['student_id'] ?? 0);
    $term = vea_normalize_term($input['term'] ?? '');
    $session = vea_normalize_session($input['session'] ?? '');

    vea_revoke_access($parentId, $studentId, $term, $session);

    echo json_encode(['success' => true, 'message' => 'Access revoked.']);
}

function handle_verify_payment(array $input): void
{
    $reference = trim((string) ($input['reference'] ?? ''));
    $parentId = (int) ($input['parent_id'] ?? 0);
    $studentId = (int) ($input['student_id'] ?? 0);
    $term = vea_normalize_term($input['term'] ?? '');
    $session = vea_normalize_session($input['session'] ?? '');

    if ($reference === '') {
        http_response_code(422);
        echo json_encode(['error' => 'Missing payment reference']);
        return;
    }

    $storage = vea_load_storage();
    $parent = $parentId ? vea_find_parent($parentId, $storage) : null;

    if (!$parent) {
        http_response_code(404);
        echo json_encode(['error' => 'Parent not found']);
        return;
    }

    if ($studentId === 0) {
        $studentId = (int) ($parent['students'][0] ?? 0);
    }
    if (!$studentId) {
        http_response_code(404);
        echo json_encode(['error' => 'No student linked to parent']);
        return;
    }

    $student = vea_find_student($studentId, $storage);
    if (!$student) {
        http_response_code(404);
        echo json_encode(['error' => 'Student not found']);
        return;
    }
    if (!in_array($studentId, $parent['students'], true)) {
        http_response_code(400);
        echo json_encode(['error' => 'Student is not linked to this parent']);
        return;
    }

    $verification = vea_verify_paystack($reference);
    if (!$verification['success']) {
        http_response_code(400);
        echo json_encode(['error' => $verification['message'] ?? 'Unable to verify payment']);
        return;
    }

    $record = vea_grant_access($parentId, $studentId, $term, $session, 'payment');

    echo json_encode([
        'success' => true,
        'record' => $record,
        'message' => 'Payment verified and access granted.',
        'transaction' => $verification['data'] ?? null,
    ]);
}

function vea_verify_paystack(string $reference): array
{
    $secret = getenv('PAYSTACK_SECRET_KEY') ?: '';
    if ($secret === '') {
        return [
            'success' => false,
            'message' => 'Paystack secret key not configured',
        ];
    }

    $url = 'https://api.paystack.co/transaction/verify/' . urlencode($reference);
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $secret,
            'Content-Type: application/json',
        ],
        CURLOPT_TIMEOUT => 30,
    ]);

    $response = curl_exec($ch);
    if ($response === false) {
        $error = curl_error($ch);
        curl_close($ch);
        return [
            'success' => false,
            'message' => 'Unable to reach Paystack: ' . $error,
        ];
    }

    $statusCode = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    $data = json_decode($response, true);
    if ($statusCode !== 200 || !isset($data['status'])) {
        return [
            'success' => false,
            'message' => 'Unexpected response from Paystack',
            'raw' => $data,
        ];
    }

    if ($data['status'] !== true) {
        return [
            'success' => false,
            'message' => $data['message'] ?? 'Verification failed',
            'raw' => $data,
        ];
    }

    return [
        'success' => true,
        'data' => $data['data'] ?? [],
    ];
}

