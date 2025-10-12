<?php
return [
    'superAdmin' => [
        'name' => 'System Super Admin',
        'email' => 'superadmin@vea.edu.ng',
        'avatar' => 'https://ui-avatars.com/api/?background=2563eb&color=fff&name=Super+Admin',
        'lastLogin' => '2025-02-01 08:32',
        'status' => 'Online'
    ],
    'metrics' => [
        [
            'label' => 'Total Revenue',
            'value' => '₦18.4M',
            'trend' => '+12.4%',
            'description' => 'compared to last quarter',
            'icon' => 'wallet'
        ],
        [
            'label' => 'Outstanding Fees',
            'value' => '₦2.1M',
            'trend' => '-4.2%',
            'description' => 'collections improving week over week',
            'icon' => 'alert'
        ],
        [
            'label' => 'Active Students',
            'value' => '1,245',
            'trend' => '+58',
            'description' => 'new enrollments this term',
            'icon' => 'users'
        ],
        [
            'label' => 'Teacher Satisfaction',
            'value' => '94%',
            'trend' => '+6%',
            'description' => 'based on quarterly surveys',
            'icon' => 'spark'
        ],
    ],
    'collections' => [
        'daily' => 520000,
        'weekly' => 3520000,
        'monthly' => 14800000,
        'targets' => [
            'collections' => 0.78,
            'waivers' => 0.35,
            'defaulters' => 0.62,
        ],
        'topClasses' => [
            ['name' => 'JSS3 Emerald', 'amount' => '₦2,850,000', 'trend' => '+8.2%'],
            ['name' => 'SS2 Sapphire', 'amount' => '₦2,430,000', 'trend' => '+5.6%'],
            ['name' => 'JSS2 Ruby', 'amount' => '₦2,120,000', 'trend' => '+4.1%'],
        ],
        'defaulters' => [
            ['name' => 'Precious Adeyemi', 'class' => 'SS1 Topaz', 'amount' => '₦185,000', 'status' => 'Final Notice'],
            ['name' => 'Opeyemi Lawal', 'class' => 'JSS3 Emerald', 'amount' => '₦162,000', 'status' => 'Follow-up'],
            ['name' => 'Chisom Nwosu', 'class' => 'SS2 Sapphire', 'amount' => '₦150,500', 'status' => 'Escalated'],
        ],
    ],
    'systemHealth' => [
        'serverStatus' => 'Operational',
        'databaseStatus' => 'Healthy',
        'apiLatency' => '128ms',
        'cpuUsage' => 0.42,
        'memoryUsage' => 0.58,
        'activeSessions' => 187,
        'incidents' => [
            ['type' => 'Maintenance Window', 'description' => 'Database index optimization completed successfully.', 'time' => '2 hours ago'],
            ['type' => 'Notification', 'description' => 'New version 3.4.2 deployed to production.', 'time' => 'yesterday'],
            ['type' => 'Alert', 'description' => 'Automatic backups verified and synced to off-site storage.', 'time' => '3 days ago'],
        ],
    ],
    'approvals' => [
        'pending' => [
            ['title' => 'Curriculum update - Science faculty', 'submittedBy' => 'Mrs. Kemi Daniels', 'submittedAt' => '2025-02-03 11:20', 'priority' => 'High'],
            ['title' => 'Library acquisition budget', 'submittedBy' => 'Mr. Sule Akande', 'submittedAt' => '2025-02-02 09:45', 'priority' => 'Medium'],
            ['title' => 'Sports facility refurbishment', 'submittedBy' => 'Facilities Team', 'submittedAt' => '2025-01-30 14:10', 'priority' => 'High'],
        ],
        'recent' => [
            ['title' => 'Termly assessment schedule', 'submittedBy' => 'Academics', 'status' => 'Approved', 'actionedAt' => '2025-02-01'],
            ['title' => 'ICT equipment procurement', 'submittedBy' => 'Technology', 'status' => 'Approved', 'actionedAt' => '2025-01-28'],
            ['title' => 'Cafeteria vendor onboarding', 'submittedBy' => 'Operations', 'status' => 'Declined', 'actionedAt' => '2025-01-26'],
        ],
    ],
    'messages' => [
        ['sender' => 'Mrs. Chinyere Okoye', 'role' => 'Principal', 'excerpt' => 'Requesting a review of the scholarship allocation...', 'receivedAt' => '08:30 AM'],
        ['sender' => 'Finance Team', 'role' => 'Accountant', 'excerpt' => 'Updated the breakdown for PTA levy collections...', 'receivedAt' => 'Yesterday'],
        ['sender' => 'ICT Department', 'role' => 'Administrator', 'excerpt' => 'Reminder: Security audit scheduled for Friday.', 'receivedAt' => '2 days ago'],
    ],
    'reporting' => [
        'completion' => 0.68,
        'recentExports' => [
            ['name' => 'Q1 Financial Summary.pdf', 'requestedBy' => 'Super Admin', 'time' => '20 minutes ago'],
            ['name' => 'Staff Payroll Overview.xlsx', 'requestedBy' => 'Accountant', 'time' => 'Yesterday'],
        ],
        'templates' => [
            ['name' => 'Full Financial Audit', 'category' => 'Finance', 'duration' => 'Approx. 12 minutes'],
            ['name' => 'Performance Overview', 'category' => 'Academics', 'duration' => 'Approx. 8 minutes'],
            ['name' => 'Engagement Snapshot', 'category' => 'Community', 'duration' => 'Approx. 6 minutes'],
        ],
    ],
    'students' => [
        ['name' => 'Ibrahim Musa', 'class' => 'JSS3 Emerald', 'guardian' => 'Mrs. Jamila Musa', 'status' => 'Active', 'gpa' => '3.82'],
        ['name' => 'Grace Eze', 'class' => 'SS2 Sapphire', 'guardian' => 'Mr. Daniel Eze', 'status' => 'Probation', 'gpa' => '2.45'],
        ['name' => 'Oluwatobi Ajayi', 'class' => 'SS3 Topaz', 'guardian' => 'Mrs. Ajayi', 'status' => 'Graduating', 'gpa' => '4.00'],
    ],
    'activities' => [
        ['title' => 'Finance sync completed', 'icon' => 'check', 'time' => 'Just now', 'description' => 'Paystack reconciliation and manual adjustments have been merged.'],
        ['title' => '3 urgent approvals waiting', 'icon' => 'clock', 'time' => '12 minutes ago', 'description' => 'Curriculum update, facility refurbishment and library budget require review.'],
        ['title' => 'Report templates refreshed', 'icon' => 'refresh', 'time' => '1 hour ago', 'description' => 'Analytics team has added two new KPI dashboards for finance.'],
    ],
];
