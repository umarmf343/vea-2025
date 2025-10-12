<?php
$data = require __DIR__ . '/includes/data.php';

function render_icon(string $name, string $classes = 'w-5 h-5'): string
{
    $icons = [
        'wallet' => 'M4 5c0-1.1.9-2 2-2h12a2 2 0 0 1 2 2v4H4V5Zm0 6h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8Zm11 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
        'alert' => 'M10.29 3.86a2 2 0 0 1 3.42 0l8.48 14.32A2 2 0 0 1 20.48 21H3.52a2 2 0 0 1-1.71-2.82L10.29 3.86ZM12 9v4m0 4h.01',
        'users' => 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m18-7a4 4 0 1 0-8 0m2-7a4 4 0 1 1-8 0',
        'spark' => 'M12 2v4m6.36-2.36-2.83 2.83M22 12h-4m2.36 6.36-2.83-2.83M12 18v4M6.36 17.64l2.83-2.83M2 12h4M4.64 5.64l2.83 2.83M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
        'check' => 'M20 6 9 17l-5-5',
        'clock' => 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-5v5l3 3',
        'refresh' => 'M21 12a9 9 0 0 1-9 9 9 9 0 0 1-9-9c0-2.21.8-4.24 2.12-5.81L3 5m18 0-2.12 2.19A8.96 8.96 0 0 0 12 3 9 9 0 0 0 3 12',
        'mail' => 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm16 2-8 5-8-5',
        'download' => 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m4-4 5 5 5-5m-5 5V3',
        'sparkle' => 'M12 3l1.84 3.73L18 8l-3.16 1.27L12 13l-2.84-3.73L6 8l4.16-1.27L12 3Zm6.5 9.5.7 1.27L21 14l-1.8.23-.7 1.27-.7-1.27L16 14l1.8-.23.7-1.27ZM6.5 12.5l.7 1.27L9 14l-1.8.23-.7 1.27-.7-1.27L4 14l1.8-.23.7-1.27Z',
    ];

    $path = $icons[$name] ?? $icons['spark'];

    return sprintf('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="%s">' .
        '<path d="%s" />' .
        '</svg>',
        htmlspecialchars($classes, ENT_QUOTES),
        htmlspecialchars($path, ENT_QUOTES)
    );
}

function percent_width(float $value): string
{
    return number_format(min(max($value * 100, 0), 100), 0) . '%';
}

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VEA 2025 · Super Admin Command Center</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        primary: '#2563eb',
                        secondary: '#f97316',
                        muted: '#f1f5f9',
                    },
                    fontFamily: {
                        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
                        serif: ['Playfair Display', 'ui-serif'],
                    },
                }
            }
        };
    </script>
    <link rel="stylesheet" href="assets/css/theme.css">
</head>
<body class="min-h-screen bg-slate-50">
    <div class="max-w-7xl mx-auto px-4 lg:px-8 py-10 space-y-10">
        <header class="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-3xl p-6 lg:p-8 shadow-soft">
            <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div class="flex items-center gap-5">
                    <img src="<?= htmlspecialchars($data['superAdmin']['avatar'], ENT_QUOTES) ?>" alt="Super Admin" class="w-16 h-16 rounded-full border-4 border-white shadow-lg">
                    <div>
                        <p class="text-sm uppercase tracking-widest text-slate-500 font-semibold">Victory Educational Academy</p>
                        <h1 class="text-3xl lg:text-4xl font-serif text-slate-900">Super Admin Command Center</h1>
                        <div class="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                            <span class="badge-pill badge-muted flex items-center gap-2">
                                <?= render_icon('sparkle', 'w-4 h-4') ?>
                                <?= htmlspecialchars($data['superAdmin']['status'], ENT_QUOTES) ?>
                            </span>
                            <span>Last login: <strong><?= htmlspecialchars($data['superAdmin']['lastLogin'], ENT_QUOTES) ?></strong></span>
                            <span>Contact: <a href="mailto:<?= htmlspecialchars($data['superAdmin']['email'], ENT_QUOTES) ?>" class="text-vea-primary font-medium"><?= htmlspecialchars($data['superAdmin']['email'], ENT_QUOTES) ?></a></span>
                        </div>
                    </div>
                </div>
                <div class="flex flex-wrap gap-3">
                    <button data-modal-target="newBroadcast" class="bg-vea-primary text-white px-5 py-3 rounded-xl shadow-soft font-medium flex items-center gap-2">
                        <?= render_icon('mail', 'w-5 h-5 text-white') ?>
                        Compose Broadcast
                    </button>
                    <button data-modal-target="exportReport" class="bg-white border border-slate-200 px-5 py-3 rounded-xl font-medium text-slate-700 flex items-center gap-2">
                        <?= render_icon('download', 'w-5 h-5 text-vea-primary') ?>
                        Export Executive Report
                    </button>
                </div>
            </div>
        </header>

        <section>
            <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                <?php foreach ($data['metrics'] as $metric): ?>
                    <div class="card-surface p-6 space-y-4">
                        <div class="flex items-center justify-between">
                            <div class="icon-circle">
                                <?= render_icon($metric['icon']) ?>
                            </div>
                            <span class="badge-pill <?= str_contains($metric['trend'], '-') ? 'badge-accent' : 'badge-muted' ?>"><?= htmlspecialchars($metric['trend'], ENT_QUOTES) ?></span>
                        </div>
                        <div>
                            <p class="text-sm uppercase tracking-[0.2em] text-slate-500"><?= htmlspecialchars($metric['label'], ENT_QUOTES) ?></p>
                            <p class="text-3xl font-serif text-slate-900 mt-2"><?= htmlspecialchars($metric['value'], ENT_QUOTES) ?></p>
                            <p class="text-sm text-slate-500 mt-1"><?= htmlspecialchars($metric['description'], ENT_QUOTES) ?></p>
                        </div>
                        <div class="progress-track">
                            <div class="progress-bar" style="width: <?= str_contains($metric['trend'], '-') ? '45%' : '82%' ?>"></div>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        </section>

        <section class="grid gap-6 lg:grid-cols-3">
            <div class="lg:col-span-2 card-surface p-6 lg:p-8 space-y-6">
                <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <h2 class="text-2xl font-serif text-slate-900">Financial Pulse</h2>
                        <p class="text-sm text-slate-500">Live view of collections, waivers and defaulters across all campuses.</p>
                    </div>
                    <div class="flex items-center gap-3 text-sm">
                        <span class="badge-pill badge-muted">Collections target: 92%</span>
                        <span class="badge-pill badge-accent">Waiver policy review due in 5 days</span>
                    </div>
                </div>
                <div class="grid gap-6 md:grid-cols-3">
                    <div class="bg-white/80 border-soft rounded-2xl p-5">
                        <p class="text-sm text-slate-500 uppercase tracking-widest">Today</p>
                        <p class="text-2xl font-serif text-slate-900 mt-2">₦<?= number_format($data['collections']['daily']) ?></p>
                        <p class="text-xs text-slate-500 mt-1">Collections processed</p>
                    </div>
                    <div class="bg-white/80 border-soft rounded-2xl p-5">
                        <p class="text-sm text-slate-500 uppercase tracking-widest">This Week</p>
                        <p class="text-2xl font-serif text-slate-900 mt-2">₦<?= number_format($data['collections']['weekly']) ?></p>
                        <p class="text-xs text-slate-500 mt-1">Verified payments</p>
                    </div>
                    <div class="bg-white/80 border-soft rounded-2xl p-5">
                        <p class="text-sm text-slate-500 uppercase tracking-widest">This Term</p>
                        <p class="text-2xl font-serif text-slate-900 mt-2">₦<?= number_format($data['collections']['monthly']) ?></p>
                        <p class="text-xs text-slate-500 mt-1">Across all channels</p>
                    </div>
                </div>
                <div class="grid gap-6 lg:grid-cols-2">
                    <div class="bg-white/80 rounded-2xl border-soft p-5 space-y-4">
                        <div class="flex items-center justify-between">
                            <h3 class="text-lg font-serif text-slate-900">Top Performing Classes</h3>
                            <span class="text-sm text-slate-500">Reconciled this term</span>
                        </div>
                        <div class="space-y-4">
                            <?php foreach ($data['collections']['topClasses'] as $class): ?>
                                <div class="flex items-center justify-between border-soft rounded-2xl p-4">
                                    <div>
                                        <p class="font-medium text-slate-800"><?= htmlspecialchars($class['name'], ENT_QUOTES) ?></p>
                                        <p class="text-xs text-slate-500">Collection health improving</p>
                                    </div>
                                    <div class="text-right">
                                        <p class="text-lg font-serif text-slate-900"><?= htmlspecialchars($class['amount'], ENT_QUOTES) ?></p>
                                        <p class="text-xs stat-trend-up font-medium"><?= htmlspecialchars($class['trend'], ENT_QUOTES) ?></p>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    </div>
                    <div class="bg-white/80 rounded-2xl border-soft p-5 space-y-4">
                        <div class="flex items-center justify-between">
                            <h3 class="text-lg font-serif text-slate-900">Focus on Defaulters</h3>
                            <button class="text-sm text-vea-primary font-medium" data-modal-target="defaulters">View escalation plan</button>
                        </div>
                        <div class="space-y-3">
                            <?php foreach ($data['collections']['defaulters'] as $defaulter): ?>
                                <div class="border-soft rounded-2xl p-4 bg-slate-50/60">
                                    <div class="flex items-center justify-between">
                                        <div>
                                            <p class="font-medium text-slate-800"><?= htmlspecialchars($defaulter['name'], ENT_QUOTES) ?></p>
                                            <p class="text-xs text-slate-500"><?= htmlspecialchars($defaulter['class'], ENT_QUOTES) ?></p>
                                        </div>
                                        <p class="text-sm font-semibold text-slate-700"><?= htmlspecialchars($defaulter['amount'], ENT_QUOTES) ?></p>
                                    </div>
                                    <div class="mt-3 flex justify-between items-center text-xs text-slate-500">
                                        <span>Status: <span class="font-semibold text-slate-700"><?= htmlspecialchars($defaulter['status'], ENT_QUOTES) ?></span></span>
                                        <button class="text-vea-primary font-medium" data-message-fill="Escalation follow-up for <?= htmlspecialchars($defaulter['name'], ENT_QUOTES) ?>">Send reminder</button>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card-surface p-6 lg:p-8 space-y-6">
                <div>
                    <h2 class="text-2xl font-serif text-slate-900">Operational Health</h2>
                    <p class="text-sm text-slate-500">Automated monitoring from infrastructure and support teams.</p>
                </div>
                <div class="space-y-4">
                    <div class="flex items-center justify-between">
                        <span class="text-sm font-medium text-slate-600">Server cluster</span>
                        <span class="badge-pill badge-muted"><?= htmlspecialchars($data['systemHealth']['serverStatus'], ENT_QUOTES) ?></span>
                    </div>
                    <div class="progress-track">
                        <div class="progress-bar" style="width: <?= percent_width(1 - $data['systemHealth']['cpuUsage']) ?>"></div>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-sm font-medium text-slate-600">Database health</span>
                        <span class="badge-pill badge-muted"><?= htmlspecialchars($data['systemHealth']['databaseStatus'], ENT_QUOTES) ?></span>
                    </div>
                    <div class="progress-track">
                        <div class="progress-bar" style="width: <?= percent_width(1 - $data['systemHealth']['memoryUsage']) ?>"></div>
                    </div>
                    <p class="text-sm text-slate-500">API latency: <strong><?= htmlspecialchars($data['systemHealth']['apiLatency'], ENT_QUOTES) ?></strong> · Active sessions: <strong><?= htmlspecialchars($data['systemHealth']['activeSessions'], ENT_QUOTES) ?></strong></p>
                </div>
                <div class="space-y-4">
                    <h3 class="text-lg font-serif text-slate-900">Recent activity</h3>
                    <ul class="space-y-3">
                        <?php foreach ($data['systemHealth']['incidents'] as $incident): ?>
                            <li class="flex items-start gap-3">
                                <div class="icon-circle shrink-0">
                                    <?= render_icon('spark') ?>
                                </div>
                                <div>
                                    <p class="font-medium text-slate-800"><?= htmlspecialchars($incident['type'], ENT_QUOTES) ?></p>
                                    <p class="text-sm text-slate-500"><?= htmlspecialchars($incident['description'], ENT_QUOTES) ?></p>
                                    <p class="text-xs text-slate-400 mt-1"><?= htmlspecialchars($incident['time'], ENT_QUOTES) ?></p>
                                </div>
                            </li>
                        <?php endforeach; ?>
                    </ul>
                </div>
            </div>
        </section>

        <section class="grid gap-6 lg:grid-cols-3">
            <div class="lg:col-span-2 card-surface p-6 lg:p-8 space-y-6">
                <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <h2 class="text-2xl font-serif text-slate-900">Strategic Approvals</h2>
                        <p class="text-sm text-slate-500">Monitor pending decisions and keep leadership aligned.</p>
                    </div>
                    <div class="flex gap-2">
                        <button class="px-4 py-2 rounded-full text-sm font-medium tab-active">Pending</button>
                        <button class="px-4 py-2 rounded-full text-sm font-medium tab-inactive">History</button>
                    </div>
                </div>
                <div class="grid gap-4 md:grid-cols-2">
                    <?php foreach ($data['approvals']['pending'] as $approval): ?>
                        <article class="bg-white/80 border-soft rounded-2xl p-5 space-y-3">
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <h3 class="text-lg font-serif text-slate-900 leading-tight"><?= htmlspecialchars($approval['title'], ENT_QUOTES) ?></h3>
                                    <p class="text-xs text-slate-500 mt-1">Submitted by <?= htmlspecialchars($approval['submittedBy'], ENT_QUOTES) ?></p>
                                </div>
                                <span class="badge-pill <?= $approval['priority'] === 'High' ? 'badge-accent' : 'badge-muted' ?>"><?= htmlspecialchars($approval['priority'], ENT_QUOTES) ?></span>
                            </div>
                            <p class="text-sm text-slate-500">Awaiting review since <?= htmlspecialchars($approval['submittedAt'], ENT_QUOTES) ?>.</p>
                            <div class="flex items-center justify-between pt-3 card-divider">
                                <div class="flex gap-2">
                                    <button class="text-sm font-medium text-vea-primary" data-modal-target="approve" data-approval="<?= htmlspecialchars($approval['title'], ENT_QUOTES) ?>">Approve</button>
                                    <button class="text-sm font-medium text-slate-500" data-modal-target="delegate" data-approval="<?= htmlspecialchars($approval['title'], ENT_QUOTES) ?>">Delegate</button>
                                </div>
                                <button class="text-sm text-slate-400">View dossier →</button>
                            </div>
                        </article>
                    <?php endforeach; ?>
                </div>
                <div class="pt-4 border-t border-dashed border-slate-200">
                    <h3 class="text-sm uppercase tracking-[0.3em] text-slate-400">Recent actions</h3>
                    <div class="mt-3 grid gap-4 md:grid-cols-3">
                        <?php foreach ($data['approvals']['recent'] as $recent): ?>
                            <div class="bg-slate-50/80 rounded-2xl p-4 border-soft">
                                <p class="font-medium text-slate-800 leading-tight"><?= htmlspecialchars($recent['title'], ENT_QUOTES) ?></p>
                                <p class="text-xs text-slate-500 mt-1">By <?= htmlspecialchars($recent['submittedBy'], ENT_QUOTES) ?></p>
                                <p class="text-xs text-slate-400 mt-2">Status: <span class="font-semibold text-slate-700"><?= htmlspecialchars($recent['status'], ENT_QUOTES) ?></span></p>
                                <p class="text-xs text-slate-400">Actioned <?= htmlspecialchars($recent['actionedAt'], ENT_QUOTES) ?></p>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </div>
            </div>

            <div class="card-surface p-6 lg:p-8 space-y-6">
                <div class="flex items-center justify-between">
                    <div>
                        <h2 class="text-2xl font-serif text-slate-900">Leadership Inbox</h2>
                        <p class="text-sm text-slate-500">Priority messages routed for super admin attention.</p>
                    </div>
                    <span class="badge-pill badge-muted">Secure</span>
                </div>
                <div class="space-y-4">
                    <?php foreach ($data['messages'] as $message): ?>
                        <div class="bg-white/90 border-soft rounded-2xl p-5 space-y-2">
                            <div class="flex items-center justify-between">
                                <div>
                                    <p class="font-medium text-slate-800"><?= htmlspecialchars($message['sender'], ENT_QUOTES) ?></p>
                                    <p class="text-xs text-slate-500"><?= htmlspecialchars($message['role'], ENT_QUOTES) ?></p>
                                </div>
                                <span class="text-xs text-slate-400"><?= htmlspecialchars($message['receivedAt'], ENT_QUOTES) ?></span>
                            </div>
                            <p class="text-sm text-slate-600 leading-relaxed"><?= htmlspecialchars($message['excerpt'], ENT_QUOTES) ?></p>
                            <div class="flex gap-3 pt-2">
                                <button class="text-sm font-medium text-vea-primary" data-message-fill="Reply regarding: <?= htmlspecialchars($message['excerpt'], ENT_QUOTES) ?>">Reply</button>
                                <button class="text-sm text-slate-500">Mark as resolved</button>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
                <div class="bg-slate-50/80 border-soft rounded-2xl p-5 text-sm text-slate-500">
                    <p class="font-medium text-slate-700">Automations enabled</p>
                    <p class="mt-1">Escalations route automatically to the super admin if unresolved after 48 hours.</p>
                </div>
            </div>
        </section>

        <section class="grid gap-6 lg:grid-cols-3">
            <div class="card-surface p-6 lg:p-8 space-y-6">
                <div class="flex items-center justify-between">
                    <div>
                        <h2 class="text-2xl font-serif text-slate-900">Intelligence Reports</h2>
                        <p class="text-sm text-slate-500">Generate data rooms for the board or PTA in seconds.</p>
                    </div>
                    <button data-modal-target="exportReport" class="badge-pill badge-muted">New export</button>
                </div>
                <div>
                    <p class="text-sm font-medium text-slate-600">Completion status</p>
                    <div class="progress-track mt-2">
                        <div class="progress-bar" style="width: <?= percent_width($data['reporting']['completion']) ?>"></div>
                    </div>
                    <p class="text-xs text-slate-500 mt-2">68% of requested board packs delivered this week.</p>
                </div>
                <div class="space-y-4">
                    <h3 class="text-sm uppercase tracking-[0.3em] text-slate-400">Recent exports</h3>
                    <ul class="space-y-3">
                        <?php foreach ($data['reporting']['recentExports'] as $export): ?>
                            <li class="bg-white/90 border-soft rounded-2xl p-4">
                                <p class="font-medium text-slate-800"><?= htmlspecialchars($export['name'], ENT_QUOTES) ?></p>
                                <p class="text-xs text-slate-500">Requested by <?= htmlspecialchars($export['requestedBy'], ENT_QUOTES) ?> · <?= htmlspecialchars($export['time'], ENT_QUOTES) ?></p>
                            </li>
                        <?php endforeach; ?>
                    </ul>
                </div>
                <div class="space-y-3">
                    <h3 class="text-sm uppercase tracking-[0.3em] text-slate-400">Templates</h3>
                    <?php foreach ($data['reporting']['templates'] as $template): ?>
                        <div class="flex items-center justify-between bg-slate-50/80 border-soft rounded-2xl p-4">
                            <div>
                                <p class="font-medium text-slate-800"><?= htmlspecialchars($template['name'], ENT_QUOTES) ?></p>
                                <p class="text-xs text-slate-500"><?= htmlspecialchars($template['category'], ENT_QUOTES) ?> · <?= htmlspecialchars($template['duration'], ENT_QUOTES) ?></p>
                            </div>
                            <button class="text-sm font-medium text-vea-primary" data-template="<?= htmlspecialchars($template['name'], ENT_QUOTES) ?>">Launch</button>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>

            <div class="lg:col-span-2 card-surface p-6 lg:p-8 space-y-6">
                <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <h2 class="text-2xl font-serif text-slate-900">Student Oversight</h2>
                        <p class="text-sm text-slate-500">Snapshot of key student journeys the super admin tracks.</p>
                    </div>
                    <button class="badge-pill badge-muted">View analytics</button>
                </div>
                <div class="overflow-hidden rounded-2xl border border-slate-200">
                    <table class="min-w-full divide-y divide-slate-200 table-gradient">
                        <thead class="bg-white/80 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                            <tr>
                                <th class="px-6 py-3">Student</th>
                                <th class="px-6 py-3">Class</th>
                                <th class="px-6 py-3">Guardian</th>
                                <th class="px-6 py-3">Status</th>
                                <th class="px-6 py-3">GPA</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white/70 divide-y divide-slate-100">
                            <?php foreach ($data['students'] as $student): ?>
                                <tr class="hover:bg-slate-50/80">
                                    <td class="px-6 py-4">
                                        <p class="font-medium text-slate-800"><?= htmlspecialchars($student['name'], ENT_QUOTES) ?></p>
                                        <p class="text-xs text-slate-500">Priority follow-up</p>
                                    </td>
                                    <td class="px-6 py-4 text-sm text-slate-600"><?= htmlspecialchars($student['class'], ENT_QUOTES) ?></td>
                                    <td class="px-6 py-4 text-sm text-slate-600"><?= htmlspecialchars($student['guardian'], ENT_QUOTES) ?></td>
                                    <td class="px-6 py-4 text-sm">
                                        <span class="badge-pill <?= $student['status'] === 'Active' ? 'badge-muted' : ($student['status'] === 'Graduating' ? 'badge-accent' : 'bg-red-100 text-red-700') ?>">
                                            <?= htmlspecialchars($student['status'], ENT_QUOTES) ?>
                                        </span>
                                    </td>
                                    <td class="px-6 py-4 text-sm font-semibold text-slate-700"><?= htmlspecialchars($student['gpa'], ENT_QUOTES) ?></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
                <div class="grid gap-4 md:grid-cols-3">
                    <?php foreach ($data['activities'] as $activity): ?>
                        <div class="bg-white/80 border-soft rounded-2xl p-4 space-y-2">
                            <div class="flex items-center justify-between">
                                <div class="icon-circle">
                                    <?= render_icon($activity['icon']) ?>
                                </div>
                                <span class="text-xs text-slate-400"><?= htmlspecialchars($activity['time'], ENT_QUOTES) ?></span>
                            </div>
                            <p class="font-medium text-slate-800 leading-tight"><?= htmlspecialchars($activity['title'], ENT_QUOTES) ?></p>
                            <p class="text-sm text-slate-500 leading-relaxed"><?= htmlspecialchars($activity['description'], ENT_QUOTES) ?></p>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
        </section>
    </div>

    <div id="modal-root" hidden></div>

    <template id="modal-template">
        <div class="modal-backdrop">
            <div class="modal-card space-y-5">
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <h3 class="text-xl font-serif text-slate-900" data-modal-title></h3>
                        <p class="text-sm text-slate-500" data-modal-description></p>
                    </div>
                    <button class="text-slate-400 hover:text-slate-600" data-modal-close>&times;</button>
                </div>
                <form class="space-y-4" data-modal-form>
                    <div>
                        <label class="block text-sm font-medium text-slate-600 mb-2" data-modal-label></label>
                        <textarea class="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/40 focus:outline-none" rows="4" data-modal-textarea></textarea>
                    </div>
                    <div class="flex justify-end gap-3">
                        <button type="button" class="px-4 py-2 rounded-xl border border-slate-200 text-sm" data-modal-close>Cancel</button>
                        <button type="submit" class="px-4 py-2 rounded-xl bg-vea-primary text-white text-sm font-medium" data-modal-submit>Submit</button>
                    </div>
                </form>
            </div>
        </div>
    </template>

    <script src="assets/js/dashboard.js"></script>
</body>
</html>
