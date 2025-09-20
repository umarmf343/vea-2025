-- Creating actual MySQL database schema for VEA Portal

CREATE DATABASE IF NOT EXISTS vea_portal;
USE vea_portal;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role ENUM('student', 'teacher', 'admin', 'super_admin', 'parent', 'accountant', 'librarian') NOT NULL,
  class_id INT NULL,
  student_id VARCHAR(50) NULL,
  subjects JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role)
);

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  level VARCHAR(50) NOT NULL,
  teacher_id INT NULL,
  capacity INT DEFAULT 30,
  status ENUM('active', 'inactive') DEFAULT 'active',
  subjects JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Students table
CREATE TABLE IF NOT EXISTS students (
  id INT PRIMARY KEY AUTO_INCREMENT,
  student_id VARCHAR(50) UNIQUE NOT NULL,
  user_id INT NULL,
  name VARCHAR(255) NOT NULL,
  class_id INT NULL,
  class_name VARCHAR(100) NULL,
  parent_email VARCHAR(255) NULL,
  date_of_birth DATE NULL,
  address TEXT NULL,
  phone VARCHAR(20) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL,
  INDEX idx_student_id (student_id),
  INDEX idx_student_user (user_id),
  INDEX idx_class_id (class_id)
);

-- Grades table
CREATE TABLE IF NOT EXISTS grades (
  id INT PRIMARY KEY AUTO_INCREMENT,
  student_id INT NOT NULL,
  subject VARCHAR(100) NOT NULL,
  first_ca DECIMAL(5,2) DEFAULT 0,
  second_ca DECIMAL(5,2) DEFAULT 0,
  assignment DECIMAL(5,2) DEFAULT 0,
  exam DECIMAL(5,2) DEFAULT 0,
  total DECIMAL(6,2) DEFAULT 0,
  grade VARCHAR(2) NULL,
  teacher_remarks TEXT NULL,
  term VARCHAR(20) NOT NULL,
  session VARCHAR(20) NOT NULL,
  class_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL,
  INDEX idx_grade_student (student_id),
  INDEX idx_grade_class (class_id),
  INDEX idx_grade_term (term),
  INDEX idx_grade_session (session)
);

-- Detailed marks table for continuous assessment tracking
CREATE TABLE IF NOT EXISTS student_marks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  student_id INT NOT NULL,
  subject VARCHAR(100) NOT NULL,
  ca1 DECIMAL(5,2) DEFAULT 0,
  ca2 DECIMAL(5,2) DEFAULT 0,
  assignment DECIMAL(5,2) DEFAULT 0,
  exam DECIMAL(5,2) DEFAULT 0,
  ca_total DECIMAL(6,2) DEFAULT 0,
  grand_total DECIMAL(6,2) DEFAULT 0,
  percentage DECIMAL(5,2) DEFAULT 0,
  grade VARCHAR(2) NOT NULL,
  remarks VARCHAR(255) NULL,
  term VARCHAR(20) NOT NULL,
  session VARCHAR(20) NOT NULL,
  teacher_id INT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_marks_student_term (student_id, term, session),
  INDEX idx_marks_teacher (teacher_id)
);

-- Report cards table
CREATE TABLE IF NOT EXISTS report_cards (
  id INT PRIMARY KEY AUTO_INCREMENT,
  student_id INT NOT NULL,
  term VARCHAR(20) NOT NULL,
  academic_year VARCHAR(20) NOT NULL,
  subjects_data JSON NOT NULL,
  behavioral_assessment JSON NULL,
  attendance_data JSON NULL,
  teacher_remarks TEXT NULL,
  total_marks DECIMAL(10,2) NULL,
  average DECIMAL(5,2) NULL,
  position INT NULL,
  status ENUM('draft', 'submitted', 'approved', 'published') DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  UNIQUE KEY unique_student_term (student_id, term, academic_year),
  INDEX idx_status (status)
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  student_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_type VARCHAR(100) NOT NULL,
  status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
  reference VARCHAR(255) UNIQUE NOT NULL,
  paystack_reference VARCHAR(255) NULL,
  payer_email VARCHAR(255) NULL,
  metadata JSON NULL,
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  INDEX idx_reference (reference),
  INDEX idx_status (status)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sender_id INT NOT NULL,
  recipient_id INT NOT NULL,
  subject VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_recipient (recipient_id),
  INDEX idx_created_at (created_at)
);

-- Library books table
CREATE TABLE IF NOT EXISTS library_books (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255) NOT NULL,
  isbn VARCHAR(50) NULL,
  category VARCHAR(100) NOT NULL,
  total_copies INT DEFAULT 1,
  available_copies INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_title (title)
);

-- Book borrowing table
CREATE TABLE IF NOT EXISTS book_borrowings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  student_id INT NOT NULL,
  book_id INT NOT NULL,
  borrowed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  due_date DATE NOT NULL,
  returned_at TIMESTAMP NULL,
  status ENUM('borrowed', 'returned', 'overdue') DEFAULT 'borrowed',
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES library_books(id) ON DELETE CASCADE,
  INDEX idx_status (status),
  INDEX idx_due_date (due_date)
);

-- Insert default admin user
INSERT IGNORE INTO users (email, password, name, role) VALUES 
('admin@victoryeducationalacademy.com.ng', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VcSAg/9qm', 'Super Admin', 'super_admin');

-- Insert sample classes
INSERT IGNORE INTO classes (name, level) VALUES 
('JSS 1A', 'Junior Secondary'),
('JSS 1B', 'Junior Secondary'),
('JSS 2A', 'Junior Secondary'),
('JSS 2B', 'Junior Secondary'),
('JSS 3A', 'Junior Secondary'),
('JSS 3B', 'Junior Secondary'),
('SS 1A', 'Senior Secondary'),
('SS 1B', 'Senior Secondary'),
('SS 2A', 'Senior Secondary'),
('SS 2B', 'Senior Secondary'),
('SS 3A', 'Senior Secondary'),
('SS 3B', 'Senior Secondary');
