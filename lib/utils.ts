import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  const merged = twMerge(clsx(inputs))

  return (
    merged
      // Fix the specific malformed pattern first (most critical)
      .replace(/bg-\[#2d682d\]hover:bg-\[#1a4a1a\]text-white/g, "bg-[#2d682d] hover:bg-[#1a4a1a] text-white")
      // Fix any color bracket concatenation patterns
      .replace(/(\]\w)/g, (match, p1) => `] ${p1.slice(1)}`)
      .replace(/(\w)(\[)/g, (match, p1, p2) => `${p1} ${p2}`)
      // Fix specific color class concatenation
      .replace(/(\])(hover:|focus:|active:|disabled:)/g, "$1 $2")
      .replace(/(hover:bg-\[#[a-fA-F0-9]{6}\])(text-)/g, "$1 $2")
      .replace(/(bg-\[#[a-fA-F0-9]{6}\])(hover:)/g, "$1 $2")
      // Fix data attribute concatenation
      .replace(/(data-\[state=active\]:bg-\w+-\d+)(data-\[state=active\]:text-\w+)/g, "$1 $2")
      // Normalize multiple spaces and trim
      .replace(/\s+/g, " ")
      .trim()
  )
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-NG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date))
}

export function generateAdmissionNumber(): string {
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")
  return `VEA/${year}/${random}`
}

export function calculateAge(birthDate: string): number {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }

  return age
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function generatePassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*"
  let password = ""
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}
