<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/storage.php';

$storage = vea_load_storage();
$parents = $storage['parents'];
$students = $storage['students'];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Approve & Publish Report Cards</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/theme.css">
    <style>
        body { background: #f8fafc; font-family: 'Inter', sans-serif; margin: 0; }
        .layout { max-width: 1040px; margin: 0 auto; padding: 32px 20px; }
        .card { background: white; border-radius: 26px; padding: 28px 32px; box-shadow: 0 20px 60px -50px rgba(15, 23, 42, 0.6); }
        h1 { margin: 0; font-size: 30px; color: #0f172a; }
        p { color: #475569; }
        .grid { display: grid; gap: 20px; margin-top: 24px; }
        .parent-block { border: 1px solid #e2e8f0; border-radius: 18px; padding: 18px; background: #f1f5f9; }
        .parent-header { display: flex; justify-content: space-between; }
        .badge { background: #dbeafe; padding: 6px 12px; border-radius: 999px; font-size: 13px; color: #1d4ed8; }
        .student-select { display: flex; align-items: center; gap: 12px; margin-top: 12px; }
        .student-select label { font-weight: 500; }
        .student-select input { transform: scale(1.2); }
        .actions { margin-top: 28px; display: flex; justify-content: flex-end; gap: 12px; }
        button { border: none; border-radius: 12px; padding: 12px 18px; font-weight: 600; cursor: pointer; font-size: 14px; }
        .button-primary { background: linear-gradient(135deg, #2563eb, #6366f1); color: white; }
        .button-ghost { background: white; color: #1f2937; border: 1px solid #cbd5f5; }
        .toast { position: fixed; bottom: 24px; right: 24px; background: white; padding: 16px 20px; border-radius: 12px; box-shadow: 0 20px 45px -28px rgba(15, 23, 42, 0.6); display: none; font-weight: 500; }
        .toast[data-visible="true"] { display: block; }
    </style>
</head>
<body>
    <div class="layout">
        <div class="card">
            <h1>Approve &amp; Publish</h1>
            <p>Choose which parents should receive this report card. Approving automatically grants manual access for the selected families.</p>

            <form id="approvalForm">
                <div class="grid" id="parentGrid"></div>
                <div class="actions">
                    <button type="button" class="button-ghost" onclick="window.location.reload()">Reset</button>
                    <button type="submit" class="button-primary">Approve &amp; Publish</button>
                </div>
            </form>
        </div>
    </div>

    <div class="toast" id="toast">Access granted for selected parents.</div>

    <script>
        const parents = <?= json_encode($parents) ?>;
        const students = <?= json_encode($students) ?>;
        const parentGrid = document.getElementById('parentGrid');
        const toast = document.getElementById('toast');

        const studentMap = new Map(students.map(student => [student.id, student]));

        parents.forEach(parent => {
            const block = document.createElement('div');
            block.className = 'parent-block';
            block.innerHTML = `
                <div class="parent-header">
                    <div>
                        <h3 style="margin:0;">${parent.name}</h3>
                        <p style="margin:4px 0 0;">${parent.email}</p>
                    </div>
                    <span class="badge">Parent ID: ${parent.id}</span>
                </div>
            `;
            const container = document.createElement('div');
            if (!parent.students.length) {
                const message = document.createElement('p');
                message.textContent = 'Link a student to this parent first.';
                container.appendChild(message);
            } else {
                parent.students.forEach(studentId => {
                    const info = studentMap.get(studentId);
                    if (!info) return;
                    const option = document.createElement('label');
                    option.className = 'student-select';
                    option.innerHTML = `
                        <input type="checkbox" name="assignments" value="${parent.id}:${info.id}">
                        <span>${info.name} · ${info.class}</span>
                    `;
                    container.appendChild(option);
                });
            }
            block.appendChild(container);
            parentGrid.appendChild(block);
        });

        document.getElementById('approvalForm').addEventListener('submit', async (event) => {
            event.preventDefault();
            const checked = Array.from(parentGrid.querySelectorAll('input[type="checkbox"]:checked'));
            if (!checked.length) {
                showToast('Select at least one parent to publish.');
                return;
            }
            for (const checkbox of checked) {
                const [parentId, studentId] = checkbox.value.split(':').map(Number);
                await grantManual(parentId, studentId);
            }
            showToast('Access granted for selected parents.');
        });

        async function grantManual(parentId, studentId) {
            try {
                await fetch('api/report_access.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'grant', parent_id: parentId, student_id: studentId, term: 'First Term', session: '2024/2025' })
                });
            } catch (error) {
                console.error('Failed to grant access', error);
            }
        }

        function showToast(message) {
            toast.textContent = message;
            toast.dataset.visible = 'true';
            setTimeout(() => toast.dataset.visible = 'false', 2600);
        }
    </script>
</body>
</html>
