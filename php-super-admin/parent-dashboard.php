<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/storage.php';

$parentId = isset($_GET['parent_id']) ? (int) $_GET['parent_id'] : 1;
$term = isset($_GET['term']) ? vea_normalize_term($_GET['term']) : VEA_TERMS[0];
$session = isset($_GET['session']) ? vea_normalize_session($_GET['session']) : VEA_DEFAULT_SESSION;

$storage = vea_load_storage();
$summary = vea_parent_summary($parentId, $storage);
$parent = $summary['parent'];

if (!$parent) {
    http_response_code(404);
    echo 'Parent not found';
    exit;
}

$reference = $_GET['reference'] ?? '';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Parent Dashboard · Report Cards</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/theme.css">
    <style>
        body { margin: 0; background: #0f172a; font-family: 'Inter', sans-serif; color: white; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
        .card { width: min(960px, 90%); background: #ffffff; color: #0f172a; border-radius: 30px; padding: 40px; box-shadow: 0 40px 80px -60px rgba(15, 23, 42, 0.7); }
        h1 { margin: 0; font-size: 30px; }
        .info { color: #475569; margin-top: 8px; }
        .banner { border-radius: 18px; padding: 18px 20px; font-weight: 500; margin-top: 24px; display: flex; justify-content: space-between; align-items: center; }
        .banner.red { background: #fee2e2; color: #b91c1c; }
        .banner.green { background: #dcfce7; color: #166534; }
        .banner.blue { background: #dbeafe; color: #1d4ed8; }
        .report { margin-top: 24px; background: #f8fafc; border-radius: 20px; padding: 20px; border: 1px solid #e2e8f0; }
        .report h2 { margin: 0 0 8px; font-size: 20px; }
        .actions { margin-top: 16px; display: flex; gap: 12px; }
        .button { padding: 12px 18px; border-radius: 12px; font-weight: 600; border: none; cursor: pointer; font-size: 14px; }
        .button.primary { background: linear-gradient(135deg, #2563eb, #6366f1); color: white; }
        .button.ghost { background: white; color: #1f2937; border: 1px solid #cbd5f5; }
        .badge { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; padding: 6px 12px; border-radius: 9999px; background: #e2e8f0; color: #1f2937; }
        .status-timestamp { font-size: 12px; color: #64748b; margin-top: 8px; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Welcome back, <?= htmlspecialchars($parent['name'], ENT_QUOTES) ?></h1>
        <p class="info">View report cards for the <?= htmlspecialchars($term . ' · ' . $session, ENT_QUOTES) ?> academic cycle. Status updates appear instantly after payments or approvals.</p>

        <div id="statusArea"></div>

        <section id="reports"></section>
    </div>

    <script>
        const parentId = <?= (int) $parentId ?>;
        const term = <?= json_encode($term) ?>;
        const sessionValue = <?= json_encode($session) ?>;
        const reference = <?= json_encode($reference) ?>;

        async function initialize() {
            if (reference) {
                await verifyPayment(reference);
            }
            await refreshDashboard();
            setInterval(refreshDashboard, 8000);
        }

        async function verifyPayment(ref) {
            const statusArea = document.getElementById('statusArea');
            const verifying = document.createElement('div');
            verifying.className = 'banner blue';
            verifying.textContent = 'Verifying your payment…';
            statusArea.innerHTML = '';
            statusArea.appendChild(verifying);

            try {
                const response = await fetch('api/report_access.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'verifyPayment', reference: ref, parent_id: parentId, term, session: sessionValue })
                });
                const payload = await response.json();
                if (!response.ok || !payload.success) {
                    throw new Error(payload.error || 'Verification failed');
                }
                const successBanner = document.createElement('div');
                successBanner.className = 'banner green';
                successBanner.textContent = 'Payment confirmed. Access unlocked automatically.';
                statusArea.innerHTML = '';
                statusArea.appendChild(successBanner);
            } catch (error) {
                const errorBanner = document.createElement('div');
                errorBanner.className = 'banner red';
                errorBanner.textContent = error.message + '. Please contact the school if this persists.';
                statusArea.innerHTML = '';
                statusArea.appendChild(errorBanner);
            }
        }

        async function refreshDashboard() {
            const response = await fetch(`api/report_access.php?mode=parent&parent_id=${parentId}&_=${Date.now()}`);
            if (!response.ok) {
                return;
            }
            const payload = await response.json();
            renderParent(payload);
        }

        function renderParent(payload) {
            const statusArea = document.getElementById('statusArea');
            const reports = document.getElementById('reports');
            statusArea.innerHTML = '';
            reports.innerHTML = '';

            const students = payload.students || [];
            if (!students.length) {
                const banner = document.createElement('div');
                banner.className = 'banner red';
                banner.textContent = 'No students linked to your account yet. Please contact the school administrator.';
                statusArea.appendChild(banner);
                return;
            }

            students.forEach(student => {
                const banner = document.createElement('div');
                const access = student.status;
                if (access === 'payment') {
                    banner.className = 'banner green';
                    banner.innerHTML = '<span>Access verified by payment.</span><span class="badge">Granted by Paystack</span>';
                } else if (access === 'manual') {
                    banner.className = 'banner blue';
                    banner.innerHTML = '<span>Access granted by school administrator.</span><span class="badge">Granted by administrator</span>';
                } else {
                    banner.className = 'banner red';
                    banner.innerHTML = '<span>Payment required to view report card.</span><button class="button primary" onclick="launchPaystack(' + student.id + ')">Pay Now</button>';
                }
                statusArea.appendChild(banner);

                const section = document.createElement('div');
                section.className = 'report';
                section.innerHTML = `
                    <h2>${student.name} · ${student.class}</h2>
                    <p>Term: ${student.term} · Session: ${student.session}</p>
                    <p class="status-timestamp">${student.granted_at ? 'Last updated ' + new Date(student.granted_at).toLocaleString() : 'Awaiting access approval.'}</p>
                `;
                if (access === 'payment' || access === 'manual') {
                    const actions = document.createElement('div');
                    actions.className = 'actions';
                    const download = document.createElement('button');
                    download.className = 'button primary';
                    download.textContent = 'View Report Card';
                    download.onclick = () => alert('Report card would open here.');
                    const pdf = document.createElement('button');
                    pdf.className = 'button ghost';
                    pdf.textContent = 'Download PDF';
                    pdf.onclick = () => alert('PDF download would start here.');
                    actions.appendChild(download);
                    actions.appendChild(pdf);
                    section.appendChild(actions);
                }
                reports.appendChild(section);
            });
        }

        function launchPaystack(studentId) {
            const handler = PaystackPop.setup({
                key: <?= json_encode(getenv('PAYSTACK_PUBLIC_KEY') ?: 'pk_test_placeholder') ?>,
                email: <?= json_encode($parent['email']) ?>,
                amount: 250000,
                metadata: {
                    custom_fields: [
                        { display_name: 'Student ID', variable_name: 'student_id', value: studentId },
                        { display_name: 'Parent ID', variable_name: 'parent_id', value: parentId },
                        { display_name: 'Term', variable_name: 'term', value: term },
                        { display_name: 'Session', variable_name: 'session', value: sessionValue }
                    ]
                },
                callback: function(response) {
                    const url = new URL(window.location.href);
                    url.searchParams.set('reference', response.reference);
                    window.location.href = url.toString();
                },
                onClose: function() {
                    alert('Payment window closed.');
                }
            });
            handler.openIframe();
        }

        initialize();
    </script>
    <script src="https://js.paystack.co/v1/inline.js"></script>
</body>
</html>
