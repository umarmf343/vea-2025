<?php

declare(strict_types=1);

const VEA_STORAGE_FILE = __DIR__ . '/../data/storage.json';
const VEA_DEFAULT_SESSION = '2024/2025';
const VEA_TERMS = ['First Term', 'Second Term', 'Third Term'];

/**
 * Load storage data from disk. Returns default structure if file missing.
 */
function vea_load_storage(): array
{
    if (!is_dir(dirname(VEA_STORAGE_FILE))) {
        mkdir(dirname(VEA_STORAGE_FILE), 0777, true);
    }

    if (!file_exists(VEA_STORAGE_FILE)) {
        $default = vea_default_storage();
        vea_save_storage($default);
        return $default;
    }

    $json = @file_get_contents(VEA_STORAGE_FILE);
    if ($json === false) {
        return vea_default_storage();
    }

    $data = json_decode($json, true);
    if (!is_array($data)) {
        return vea_default_storage();
    }

    $defaults = vea_default_storage();

    return array_merge($defaults, $data);
}

/**
 * Persist storage data with basic file locking.
 */
function vea_save_storage(array $data): void
{
    if (!is_dir(dirname(VEA_STORAGE_FILE))) {
        mkdir(dirname(VEA_STORAGE_FILE), 0777, true);
    }

    $file = fopen(VEA_STORAGE_FILE, 'c+');
    if (!$file) {
        throw new RuntimeException('Unable to open storage.');
    }

    try {
        if (!flock($file, LOCK_EX)) {
            throw new RuntimeException('Unable to lock storage.');
        }

        ftruncate($file, 0);
        rewind($file);
        fwrite($file, json_encode($data, JSON_PRETTY_PRINT));
        fflush($file);
        flock($file, LOCK_UN);
    } finally {
        fclose($file);
    }
}

function vea_default_storage(): array
{
    return [
        'parents' => [
            ['id' => 1, 'name' => 'Adebayo Sola', 'email' => 'adebayo.sola@example.com', 'students' => [1, 2]],
            ['id' => 2, 'name' => 'Grace Eze', 'email' => 'grace.eze@example.com', 'students' => [3]],
            ['id' => 3, 'name' => 'Samuel Johnson', 'email' => 'samuel.j@example.com', 'students' => []],
        ],
        'students' => [
            ['id' => 1, 'name' => 'Sola Junior', 'class' => 'JSS 2A'],
            ['id' => 2, 'name' => 'Modupe Sola', 'class' => 'Primary 5B'],
            ['id' => 3, 'name' => 'Uche Eze', 'class' => 'SSS 1'],
        ],
        'access' => [],
    ];
}

function vea_find_parent(int $parentId, array $storage): ?array
{
    foreach ($storage['parents'] as $parent) {
        if ((int) $parent['id'] === $parentId) {
            return $parent;
        }
    }
    return null;
}

function vea_find_student(int $studentId, array $storage): ?array
{
    foreach ($storage['students'] as $student) {
        if ((int) $student['id'] === $studentId) {
            return $student;
        }
    }
    return null;
}

function vea_access_key(int $parentId, int $studentId, string $term, string $session): string
{
    return implode(':', [$parentId, $studentId, $term, $session]);
}

function vea_normalize_term(?string $term): string
{
    $term = trim((string) $term);
    foreach (VEA_TERMS as $valid) {
        if (strcasecmp($term, $valid) === 0) {
            return $valid;
        }
    }

    $map = [
        'first' => 'First Term',
        '1st' => 'First Term',
        'second' => 'Second Term',
        '2nd' => 'Second Term',
        'third' => 'Third Term',
        '3rd' => 'Third Term',
    ];

    $key = strtolower($term);
    if (isset($map[$key])) {
        return $map[$key];
    }

    return 'First Term';
}

function vea_normalize_session(?string $session): string
{
    $session = trim((string) $session);
    if ($session === '') {
        return VEA_DEFAULT_SESSION;
    }
    if (!preg_match('/^\d{4}\/\d{4}$/', $session)) {
        return VEA_DEFAULT_SESSION;
    }
    return $session;
}

function vea_current_timestamp(): string
{
    return gmdate('c');
}

function vea_get_access(int $parentId, int $studentId, string $term, string $session, array $storage): ?array
{
    $key = vea_access_key($parentId, $studentId, $term, $session);
    if (!isset($storage['access'][$key])) {
        return null;
    }

    return $storage['access'][$key];
}

function vea_grant_access(int $parentId, int $studentId, string $term, string $session, string $method): array
{
    $method = $method === 'payment' ? 'payment' : 'manual';
    $storage = vea_load_storage();
    $key = vea_access_key($parentId, $studentId, $term, $session);

    $record = [
        'parent_id' => $parentId,
        'student_id' => $studentId,
        'term' => $term,
        'session' => $session,
        'method' => $method,
        'granted_at' => vea_current_timestamp(),
    ];

    $storage['access'][$key] = $record;
    vea_save_storage($storage);

    return $record;
}

function vea_revoke_access(int $parentId, int $studentId, string $term, string $session): void
{
    $storage = vea_load_storage();
    $key = vea_access_key($parentId, $studentId, $term, $session);
    unset($storage['access'][$key]);
    vea_save_storage($storage);
}

function vea_list_access(array $storage): array
{
    $result = [];
    $term = VEA_TERMS[0];
    $session = VEA_DEFAULT_SESSION;

    foreach ($storage['parents'] as $parent) {
        $parentEntry = [
            'id' => (int) $parent['id'],
            'name' => $parent['name'],
            'email' => $parent['email'],
            'students' => [],
        ];

        $studentIds = $parent['students'] ?? [];
        foreach ($studentIds as $studentId) {
            $student = vea_find_student((int) $studentId, $storage);
            if (!$student) {
                continue;
            }
            $record = vea_get_access((int) $parent['id'], (int) $student['id'], $term, $session, $storage);

            $parentEntry['students'][] = [
                'id' => (int) $student['id'],
                'name' => $student['name'],
                'class' => $student['class'],
                'term' => $term,
                'session' => $session,
                'status' => $record ? ($record['method'] === 'payment' ? 'payment' : 'manual') : 'none',
                'granted_at' => $record['granted_at'] ?? null,
            ];
        }

        $result[] = $parentEntry;
    }

    return $result;
}

function vea_parent_summary(int $parentId, array $storage): array
{
    $parent = vea_find_parent($parentId, $storage);
    if (!$parent) {
        return ['parent' => null, 'students' => []];
    }

    $students = [];
    foreach ($parent['students'] as $studentId) {
        $student = vea_find_student((int) $studentId, $storage);
        if (!$student) {
            continue;
        }
        $term = VEA_TERMS[0];
        $session = VEA_DEFAULT_SESSION;
        $record = vea_get_access((int) $parent['id'], (int) $student['id'], $term, $session, $storage);
        $students[] = [
            'id' => (int) $student['id'],
            'name' => $student['name'],
            'class' => $student['class'],
            'term' => $term,
            'session' => $session,
            'status' => $record ? $record['method'] : 'none',
            'granted_at' => $record['granted_at'] ?? null,
        ];
    }

    return ['parent' => $parent, 'students' => $students];
}

