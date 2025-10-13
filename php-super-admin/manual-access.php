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
    <title>Manual Report Card Access · VEA</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/theme.css">
    <style>
        body { font-family: 'Inter', sans-serif; background: #f8fafc; margin: 0; }
        .container { max-width: 1100px; margin: 0 auto; padding: 32px 20px; }
        .card { background: white; border-radius: 24px; padding: 32px; box-shadow: 0 30px 60px -40px rgba(15, 23, 42, 0.4); }
        h1 { margin: 0; font-size: 28px; color: #0f172a; }
        .subtitle { margin-top: 8px; color: #475569; }
        .grid { display: grid; gap: 24px; margin-top: 32px; }
        .parent-card { border: 1px solid #e2e8f0; border-radius: 20px; padding: 20px; background: #f8fafc; }
        .parent-header { display: flex; justify-content: space-between; align-items: center; }
        .parent-name { font-weight: 600; color: #0f172a; font-size: 18px; }
        .parent-email { color: #475569; font-size: 14px; }
        .student-block { background: white; border-radius: 16px; padding: 16px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #e2e8f0; }
        .student-info { display: flex; flex-direction: column; gap: 4px; }
        .term { font-size: 13px; color: #6366f1; text-transform: uppercase; letter-spacing: 0.08em; }
        .status-pill { border-radius: 9999px; padding: 6px 14px; font-size: 13px; font-weight: 600; }
        .status-payment { background: #dcfce7; color: #166534; }
        .status-manual { background: #dbeafe; color: #1d4ed8; }
        .status-none { background: #fee2e2; color: #b91c1c; }
        .toggle { position: relative; width: 52px; height: 28px; border-radius: 999px; background: #e2e8f0; cursor: pointer; transition: background 0.2s ease-in-out; }
        .toggle[data-active="true"] { background: linear-gradient(135deg, #2563eb, #6366f1); }
        .toggle-thumb { position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: white; transition: transform 0.2s ease-in-out; box-shadow: 0 4px 10px rgba(15, 23, 42, 0.15); }
        .toggle[data-active="true"] .toggle-thumb { transform: translateX(24px); }
        .message { margin-top: 8px; font-size: 13px; color: #475569; }
        .toast { position: fixed; top: 24px; right: 24px; padding: 14px 18px; background: white; border-radius: 12px; box-shadow: 0 20px 45px -30px rgba(15, 23, 42, 0.6); display: none; gap: 12px; align-items: center; font-weight: 500; }
        .toast[data-visible="true"] { display: inline-flex; }
        .toast-success { color: #166534; }
        .toast-error { color: #b91c1c; }
        .badge { padding: 6px 10px; border-radius: 999px; font-size: 12px; background: #e2e8f0; color: #1f2937; }
        .offline { color: #b45309; font-weight: 500; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <h1>Manual Report Card Access</h1>
            <p class="subtitle">Toggle parent access instantly. Updates stream in real-time from payments and approvals.</p>
            <div class="badge" id="syncStatus">Last updated: <span data-role="updatedAt">never</span></div>
            <div class="grid" id="parentList" aria-live="polite"></div>
        </div>
    </div>

    <div class="toast" id="toast" role="status" aria-live="assertive"></div>

    <template id="studentRow">
        <div class="student-block">
            <div class="student-info">
                <span class="term" data-role="term"></span>
                <span data-role="name"></span>
                <span class="message" data-role="message"></span>
            </div>
            <div style="display:flex; flex-direction: column; gap: 8px; align-items: flex-end;">
                <span class="status-pill" data-role="status"></span>
                <div class="toggle" data-role="toggle" tabindex="0" role="switch" aria-checked="false">
                    <div class="toggle-thumb"></div>
                </div>
            </div>
        </div>
    </template>

    <script>
        const parentList = document.getElementById('parentList');
        const toast = document.getElementById('toast');
        const updatedAtTarget = document.querySelector('[data-role="updatedAt"]');
        const studentTemplate = document.getElementById('studentRow');

        async function fetchAccess() {
            const url = 'api/report_access.php?mode=list&_=' + Date.now();
            try {
                const response = await fetch(url, { cache: 'no-store' });
                if (!response.ok) throw new Error('Network error');
                const payload = await response.json();
                localStorage.setItem('vea_manual_access_snapshot', JSON.stringify(payload));
                renderParents(payload.parents || []);
                updatedAtTarget.textContent = new Date(payload.updated_at).toLocaleString();
                updatedAtTarget.classList.remove('offline');
            } catch (error) {
                const cached = localStorage.getItem('vea_manual_access_snapshot');
                if (cached) {
                    const payload = JSON.parse(cached);
                    renderParents(payload.parents || []);
                    updatedAtTarget.textContent = new Date(payload.updated_at).toLocaleString() + ' (offline)';
                    updatedAtTarget.classList.add('offline');
                    showToast('Offline snapshot loaded. Changes will sync later.', false);
                } else {
                    parentList.innerHTML = '<p>Unable to load data right now. Please check your connection.</p>';
                }
            }
        }

        function renderParents(parents) {
            parentList.innerHTML = '';
            parents.forEach(parent => {
                const wrapper = document.createElement('div');
                wrapper.className = 'parent-card';
                wrapper.innerHTML = `
                    <div class="parent-header">
                        <div>
                            <div class="parent-name">${parent.name}</div>
                            <div class="parent-email">${parent.email}</div>
                        </div>
                        <span class="badge">Parent ID: ${parent.id}</span>
                    </div>
                    <div class="grid" style="margin-top: 16px;"></div>
                `;
                const studentGrid = wrapper.querySelector('.grid');
                if (!parent.students.length) {
                    const notice = document.createElement('p');
                    notice.className = 'message';
                    notice.textContent = 'Link a student to this parent first.';
                    studentGrid.appendChild(notice);
                }
                parent.students.forEach(student => {
                    const clone = studentTemplate.content.cloneNode(true);
                    const row = clone.querySelector('.student-block');
                    row.dataset.parentId = parent.id;
                    row.dataset.studentId = student.id;
                    row.dataset.term = student.term;
                    row.dataset.session = student.session;

                    clone.querySelector('[data-role="term"]').textContent = `${student.term} · ${student.session}`;
                    clone.querySelector('[data-role="name"]').textContent = `${student.name} · ${student.class}`;

                    const status = clone.querySelector('[data-role="status"]');
                    const message = clone.querySelector('[data-role="message"]');
                    const toggle = clone.querySelector('[data-role="toggle"]');

                    toggle.dataset.disabled = parent.students.length ? 'false' : 'true';
                    if (!parent.students.length) {
                        toggle.classList.add('disabled');
                        toggle.setAttribute('aria-disabled', 'true');
                    }

                    updateRowState(status, message, toggle, student);

                    toggle.addEventListener('click', () => {
                        if (toggle.dataset.disabled === 'true') return;
                        const active = toggle.getAttribute('data-active') === 'true';
                        if (active) {
                            revokeAccess(row);
                        } else {
                            grantAccess(row);
                        }
                    });

                    toggle.addEventListener('keydown', (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            toggle.click();
                        }
                    });

                    studentGrid.appendChild(clone);
                });

                parentList.appendChild(wrapper);
            });
        }

        function updateRowState(statusEl, messageEl, toggleEl, student) {
            const method = student.status;
            toggleEl.setAttribute('data-active', method !== 'none');
            toggleEl.setAttribute('aria-checked', method !== 'none');

            if (method === 'payment') {
                statusEl.textContent = 'Payment';
                statusEl.className = 'status-pill status-payment';
                messageEl.textContent = 'Granted automatically after verified Paystack payment.';
            } else if (method === 'manual') {
                statusEl.textContent = 'Manual';
                statusEl.className = 'status-pill status-manual';
                messageEl.textContent = 'Granted by school administrator.';
            } else {
                statusEl.textContent = 'Not granted';
                statusEl.className = 'status-pill status-none';
                messageEl.textContent = 'Toggle on to grant access instantly.';
            }
        }

        async function grantAccess(row) {
            const payload = buildPayload(row);
            try {
                const response = await fetch('api/report_access.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...payload, action: 'grant' })
                });
                if (!response.ok) throw new Error('Unable to grant');
                await fetchAccess();
                showToast('Access granted', true);
            } catch (error) {
                showToast('Unable to grant access right now.', false);
            }
        }

        async function revokeAccess(row) {
            const payload = buildPayload(row);
            try {
                const response = await fetch('api/report_access.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...payload, action: 'revoke' })
                });
                if (!response.ok) throw new Error('Unable to revoke');
                await fetchAccess();
                showToast('Access revoked', true);
            } catch (error) {
                showToast('Unable to revoke access right now.', false);
            }
        }

        function buildPayload(row) {
            return {
                parent_id: parseInt(row.dataset.parentId, 10),
                student_id: parseInt(row.dataset.studentId, 10),
                term: row.dataset.term,
                session: row.dataset.session
            };
        }

        function showToast(message, success) {
            toast.textContent = message;
            toast.className = 'toast ' + (success ? 'toast-success' : 'toast-error');
            toast.dataset.visible = 'true';
            setTimeout(() => { toast.dataset.visible = 'false'; }, 2800);
        }

        fetchAccess();
        setInterval(fetchAccess, 10000);
    </script>
</body>
</html>
