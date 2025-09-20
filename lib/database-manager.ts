import { safeStorage } from "./safe-storage"

class DatabaseManager {
  private listeners: Map<string, Function[]> = new Map()
  private static instance: DatabaseManager
  private eventListeners: Map<string, Function[]> = new Map()
  private storageArea: any

  constructor() {
    this.storageArea = safeStorage
  }

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager()
    }
    return DatabaseManager.instance
  }

  addEventListener(key: string, callback: Function) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, [])
    }
    this.listeners.get(key)!.push(callback)
  }

  removeEventListener(key: string, callback?: Function) {
    if (callback) {
      const callbacks = this.listeners.get(key)
      if (callbacks) {
        const index = callbacks.indexOf(callback)
        if (index > -1) {
          callbacks.splice(index, 1)
        }
      }
    } else {
      // Remove all listeners for this key
      this.listeners.delete(key)
    }
  }

  removeAllEventListeners() {
    this.listeners.clear()
  }

  on(event: string, callback: Function) {
    this.addEventListener(event, callback)
  }

  off(event: string, callback?: Function) {
    this.removeEventListener(event, callback)
  }

  emit(event: string, data?: any) {
    this.triggerEvent(event, data)
  }

  triggerEvent(key: string, data: any) {
    this.notifyListeners(key, data)

    // Also trigger storage event for cross-tab communication
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(
          new StorageEvent("storage", {
            key,
            newValue: JSON.stringify(data),
            storageArea: localStorage,
          }),
        )
      } catch (error) {
        console.error("[v0] Error dispatching storage event:", error)
      }
    }
  }

  private notifyListeners(key: string, data: any) {
    const callbacks = this.listeners.get(key)
    if (callbacks) {
      callbacks.forEach((callback) => callback(data))
    }
  }

  private getData(key: string): any[] {
    const data = safeStorage.getItem(key)
    return data ? JSON.parse(data) : []
  }

  private setData(key: string, data: any[]): void {
    safeStorage.setItem(key, JSON.stringify(data))
  }

  // Financial Methods
  getFeeCollection(): any[] {
    const key = "feeCollection"
    const data = safeStorage.getItem(key)
    return data ? JSON.parse(data) : []
  }

  getClassWiseCollection(): any[] {
    const key = "classWiseCollection"
    const data = safeStorage.getItem(key)
    return data ? JSON.parse(data) : []
  }

  getExpenseTracking(): any[] {
    const key = "expenseTracking"
    const data = safeStorage.getItem(key)
    return data ? JSON.parse(data) : []
  }

  async getFeeCollectionData(period: string) {
    try {
      const key = `feeCollection_${period}`
      const data = safeStorage.getItem(key)
      return data
        ? JSON.parse(data)
        : [
            { month: "Jan", collected: 2500000, expected: 3000000, percentage: 83.3 },
            { month: "Feb", collected: 2800000, expected: 3000000, percentage: 93.3 },
            { month: "Mar", collected: 2200000, expected: 3000000, percentage: 73.3 },
            { month: "Apr", collected: 2900000, expected: 3000000, percentage: 96.7 },
          ]
    } catch (error) {
      console.error("Error getting fee collection data:", error)
      return []
    }
  }

  async getClassWiseCollection(period: string, classFilter: string) {
    try {
      const key = `classCollection_${period}`
      const data = safeStorage.getItem(key)
      let classData = data
        ? JSON.parse(data)
        : [
            { class: "JSS 1", collected: 850000, expected: 900000, students: 45, percentage: 94.4 },
            { class: "JSS 2", collected: 780000, expected: 900000, students: 42, percentage: 86.7 },
            { class: "JSS 3", collected: 920000, expected: 950000, students: 48, percentage: 96.8 },
            { class: "SS 1", collected: 1200000, expected: 1300000, students: 38, percentage: 92.3 },
            { class: "SS 2", collected: 1100000, expected: 1200000, students: 35, percentage: 91.7 },
            { class: "SS 3", collected: 980000, expected: 1100000, students: 32, percentage: 89.1 },
          ]

      if (classFilter && classFilter !== "all") {
        classData = classData.filter((item: any) => item.class === classFilter)
      }

      return classData
    } catch (error) {
      console.error("Error getting class-wise collection:", error)
      return []
    }
  }

  async getExpenseData(period: string) {
    try {
      const key = `expenses_${period}`
      const data = safeStorage.getItem(key)
      return data
        ? JSON.parse(data)
        : [
            { category: "Staff Salaries", amount: 1500000, percentage: 45 },
            { category: "Utilities", amount: 300000, percentage: 9 },
            { category: "Maintenance", amount: 200000, percentage: 6 },
            { category: "Supplies", amount: 400000, percentage: 12 },
            { category: "Transport", amount: 250000, percentage: 7.5 },
            { category: "Others", amount: 683333, percentage: 20.5 },
          ]
    } catch (error) {
      console.error("Error getting expense data:", error)
      return []
    }
  }

  async getFeeDefaulters() {
    const data = safeStorage.getItem("feeDefaulters")
    return data ? JSON.parse(data) : []
  }

  async getFinancialSummary(period: string) {
    try {
      const key = `financialSummary_${period}`
      const data = safeStorage.getItem(key)
      return data
        ? JSON.parse(data)
        : {
            totalCollected: 10400000,
            collectionRate: 87.3,
            studentsPaid: 240,
            defaultersCount: 15,
            outstandingAmount: 1500000,
            avgCollectionTime: 15,
            onTimePaymentRate: 94.2,
          }
    } catch (error) {
      console.error("Error getting financial summary:", error)
      return {
        totalCollected: 0,
        collectionRate: 0,
        studentsPaid: 0,
        defaultersCount: 0,
        outstandingAmount: 0,
        avgCollectionTime: 0,
        onTimePaymentRate: 0,
      }
    }
  }

  getFinancialSummary(): any {
    const key = "financialSummary"
    const data = safeStorage.getItem(key)
    return data ? JSON.parse(data) : {}
  }

  async saveFinancialReport(reportData: any) {
    try {
      const reports = await this.getAllFinancialReports()
      const newReport = {
        ...reportData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      }
      reports.push(newReport)
      safeStorage.setItem("financialReports", JSON.stringify(reports))
      this.triggerEvent("financialReportSaved", newReport)
      return newReport
    } catch (error) {
      console.error("Error saving financial report:", error)
      throw error
    }
  }

  saveFinancialReport(report: any): void {
    const reports = this.getFinancialReports()
    reports.push({
      ...report,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    })
    safeStorage.setItem("financialReports", JSON.stringify(reports))
    this.emit("financialReportSaved", report)
  }

  async getAllFinancialReports() {
    const reports = safeStorage.getItem("financialReports")
    return reports ? JSON.parse(reports) : []
  }

  getFinancialReports(): any[] {
    const reports = safeStorage.getItem("financialReports")
    return reports ? JSON.parse(reports) : []
  }

  async sendPaymentReminder(defaulterId: string) {
    try {
      const defaulters = await this.getFeeDefaulters()
      const defaulter = defaulters.find((d: any) => d.id === defaulterId)

      if (defaulter) {
        // Simulate sending reminder
        const reminder = {
          id: Date.now().toString(),
          defaulterId,
          type: "payment_reminder",
          message: `Payment reminder sent to ${defaulter.name} for outstanding amount of ₦${defaulter.amount.toLocaleString()}`,
          sentAt: new Date().toISOString(),
        }

        await this.saveNotification({
          title: "Payment Reminder Sent",
          message: reminder.message,
          type: "financial",
          targetAudience: ["admin", "accountant"],
        })

        this.triggerEvent("paymentReminderSent", reminder)
        return reminder
      }

      throw new Error("Defaulter not found")
    } catch (error) {
      console.error("Error sending payment reminder:", error)
      throw error
    }
  }

  async contactParent(defaulterId: string) {
    try {
      const defaulters = await this.getFeeDefaulters()
      const defaulter = defaulters.find((d: any) => d.id === defaulterId)

      if (defaulter) {
        // Simulate contacting parent
        const contact = {
          id: Date.now().toString(),
          defaulterId,
          type: "parent_contact",
          message: `Parent contact initiated for ${defaulter.name} regarding outstanding fees`,
          contactedAt: new Date().toISOString(),
        }

        await this.saveNotification({
          title: "Parent Contacted",
          message: contact.message,
          type: "financial",
          targetAudience: ["admin", "accountant"],
        })

        this.triggerEvent("parentContacted", contact)
        return contact
      }

      throw new Error("Defaulter not found")
    } catch (error) {
      console.error("Error contacting parent:", error)
      throw error
    }
  }

  async updateFeeCollection(period: string, data: any) {
    try {
      const key = `feeCollection_${period}`
      safeStorage.setItem(key, JSON.stringify(data))
      this.triggerEvent("financialDataUpdated", { period, type: "feeCollection", data })
      return data
    } catch (error) {
      console.error("Error updating fee collection:", error)
      throw error
    }
  }

  async addExpense(period: string, expenseData: any) {
    try {
      const expenses = await this.getExpenseData(period)
      const newExpense = {
        ...expenseData,
        id: Date.now().toString(),
        addedAt: new Date().toISOString(),
      }
      expenses.push(newExpense)

      const key = `expenses_${period}`
      safeStorage.setItem(key, JSON.stringify(expenses))
      this.triggerEvent("expenseAdded", { period, expense: newExpense })
      return newExpense
    } catch (error) {
      console.error("Error adding expense:", error)
      throw error
    }
  }

  async saveUser(userData: any) {
    try {
      const users = await this.getAllUsers()
      const existingIndex = users.findIndex((u) => u.id === userData.id)

      if (existingIndex >= 0) {
        users[existingIndex] = { ...users[existingIndex], ...userData, updatedAt: new Date().toISOString() }
      } else {
        users.push({ ...userData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      }

      safeStorage.setItem("users", JSON.stringify(users))
      this.triggerEvent("userUpdated", userData)

      return userData
    } catch (error) {
      console.error("Error saving user:", error)
      throw error
    }
  }

  async deleteUser(userId: number) {
    try {
      const users = await this.getAllUsers()
      const filteredUsers = users.filter((u) => u.id !== userId)

      safeStorage.setItem("users", JSON.stringify(filteredUsers))
      this.triggerEvent("userDeleted", { userId })

      return true
    } catch (error) {
      console.error("Error deleting user:", error)
      throw error
    }
  }

  async getAllUsers() {
    const users = safeStorage.getItem("users")
    return users
      ? JSON.parse(users)
      : [
          {
            id: 1,
            name: "John Doe",
            email: "john@vea.edu.ng",
            role: "Student",
            status: "Active",
            lastLogin: "2024-03-10",
            class: "JSS 1A",
            admissionNo: "VEA2025001",
          },
          {
            id: 2,
            name: "Jane Smith",
            email: "jane@vea.edu.ng",
            role: "Teacher",
            status: "Active",
            lastLogin: "2024-03-10",
            subjects: ["Mathematics", "Physics"],
          },
          {
            id: 3,
            name: "Mike Johnson",
            email: "mike@vea.edu.ng",
            role: "Parent",
            status: "Active",
            lastLogin: "2024-03-09",
            children: [1],
          },
        ]
  }

  // User Management
  createUser(userData: any): void {
    const users = this.getUsers()
    const newUser = {
      ...userData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    }
    users.push(newUser)
    safeStorage.setItem("users", JSON.stringify(users))
    this.emit("userCreated", newUser)
  }

  updateUser(userId: string, userData: any): void {
    const users = this.getUsers()
    const index = users.findIndex((user) => user.id === userId)
    if (index !== -1) {
      users[index] = { ...users[index], ...userData, updatedAt: new Date().toISOString() }
      safeStorage.setItem("users", JSON.stringify(users))
      this.emit("userUpdated", users[index])
    }
  }

  deleteUser(userId: string): void {
    const users = this.getUsers()
    const filteredUsers = users.filter((user) => user.id !== userId)
    safeStorage.setItem("users", JSON.stringify(filteredUsers))
    this.emit("userDeleted", userId)
  }

  getUsers(): any[] {
    const users = safeStorage.getItem("users")
    return users ? JSON.parse(users) : []
  }

  async saveBranding(brandingData: any) {
    try {
      const enhancedBrandingData = {
        ...brandingData,
        updatedAt: new Date().toISOString(),
        version: Date.now(),
      }
      safeStorage.setItem("schoolBranding", JSON.stringify(enhancedBrandingData))
      this.triggerEvent("brandingUpdated", enhancedBrandingData)
      return enhancedBrandingData
    } catch (error) {
      console.error("Error saving branding:", error)
      throw error
    }
  }

  // Branding Management
  saveBranding(brandingData: any): void {
    const enhancedBrandingData = {
      ...brandingData,
      updatedAt: new Date().toISOString(),
    }
    safeStorage.setItem("schoolBranding", JSON.stringify(enhancedBrandingData))
    this.emit("brandingUpdated", enhancedBrandingData)
  }

  async getBranding() {
    try {
      const branding = safeStorage.getItem("schoolBranding")
      return branding
        ? JSON.parse(branding)
        : {
            schoolLogo: null,
            headmasterSignature: null,
            headmasterName: "Dr. Emmanuel Adebayo",
            defaultRemark: "Keep up the excellent work and continue to strive for academic excellence.",
            logoUrl: "",
            signatureUrl: "",
          }
    } catch (error) {
      console.error("Error getting branding:", error)
      return null
    }
  }

  getBranding(): any {
    const branding = safeStorage.getItem("schoolBranding")
    return branding ? JSON.parse(branding) : {}
  }

  async saveReportCard(reportData: any) {
    try {
      const reportCards = await this.getAllReportCards()
      const existingIndex = reportCards.findIndex((r) => r.studentId === reportData.studentId)

      const enhancedReportData = {
        ...reportData,
        updatedAt: new Date().toISOString(),
        version: Date.now(),
      }

      if (existingIndex >= 0) {
        reportCards[existingIndex] = enhancedReportData
      } else {
        reportCards.push(enhancedReportData)
      }

      safeStorage.setItem("reportCards", JSON.stringify(reportCards))
      this.triggerEvent("reportCardUpdated", enhancedReportData)

      return enhancedReportData
    } catch (error) {
      console.error("Error saving report card:", error)
      throw error
    }
  }

  // Report Card Management
  saveReportCard(reportCardData: any): void {
    const reportCards = this.getReportCards()
    const existingIndex = reportCards.findIndex(
      (rc) => rc.studentId === reportCardData.studentId && rc.term === reportCardData.term,
    )

    if (existingIndex !== -1) {
      reportCards[existingIndex] = { ...reportCards[existingIndex], ...reportCardData }
    } else {
      reportCards.push({ ...reportCardData, id: Date.now().toString() })
    }

    safeStorage.setItem("reportCards", JSON.stringify(reportCards))
    this.emit("reportCardSaved", reportCardData)
  }

  async getAllReportCards() {
    const reportCards = safeStorage.getItem("reportCards")
    return reportCards ? JSON.parse(reportCards) : []
  }

  getReportCards(): any[] {
    const reportCards = safeStorage.getItem("reportCards")
    return reportCards ? JSON.parse(reportCards) : []
  }

  async getReportCard(studentId: string) {
    const reportCards = await this.getAllReportCards()
    return reportCards.find((r: any) => r.studentId === studentId) || null
  }

  async getSystemHealth() {
    return {
      database: "healthy",
      paymentGateway: "online",
      emailService: "active",
      cpuUsage: Math.floor(Math.random() * 30) + 40, // 40-70%
      memoryUsage: Math.floor(Math.random() * 20) + 50, // 50-70%
      uptime: "99.9%",
      lastChecked: new Date().toISOString(),
    }
  }

  async saveTeacherData(teacherId: string, dataType: string, data: any) {
    try {
      const key = `teacher_${teacherId}_${dataType}`
      const enhancedData = {
        ...data,
        teacherId,
        dataType,
        updatedAt: new Date().toISOString(),
        version: Date.now(),
      }
      safeStorage.setItem(key, JSON.stringify(enhancedData))
      this.triggerEvent(`teacherDataUpdated_${dataType}`, { teacherId, data: enhancedData })
      return enhancedData
    } catch (error) {
      console.error("Error saving teacher data:", error)
      throw error
    }
  }

  // Teacher Data Management
  saveTeacherData(key: string, data: any): void {
    const enhancedData = {
      ...data,
      savedAt: new Date().toISOString(),
    }
    safeStorage.setItem(key, JSON.stringify(enhancedData))
    this.emit("teacherDataSaved", { key, data: enhancedData })
  }

  async getTeacherData(teacherId: string, dataType: string) {
    try {
      const key = `teacher_${teacherId}_${dataType}`
      const data = safeStorage.getItem(key)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error("Error getting teacher data:", error)
      return null
    }
  }

  getTeacherData(key: string): any {
    const data = safeStorage.getItem(key)
    return data ? JSON.parse(data) : null
  }

  async getAllTeacherData() {
    const teacherData = safeStorage.getItem("teacherData")
    return teacherData ? JSON.parse(teacherData) : {}
  }

  getAllTeacherData(): any {
    const teacherData = safeStorage.getItem("teacherData")
    return teacherData ? JSON.parse(teacherData) : {}
  }

  async saveMessage(messageData: any) {
    try {
      const messages = await this.getAllMessages()
      const newMessage = {
        ...messageData,
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        status: "sent",
        reactions: [],
        attachments: messageData.attachments || [],
      }

      messages.push(newMessage)
      safeStorage.setItem("messages", JSON.stringify(messages))
      this.triggerEvent("messageReceived", newMessage)

      return newMessage
    } catch (error) {
      console.error("Error saving message:", error)
      throw error
    }
  }

  // Messaging System
  saveMessage(message: any): void {
    const messages = this.getMessages()
    const newMessage = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
    }
    messages.push(newMessage)
    safeStorage.setItem("messages", JSON.stringify(messages))
    this.emit("messageSaved", newMessage)
  }

  async getAllMessages() {
    const messages = safeStorage.getItem("messages")
    return messages ? JSON.parse(messages) : []
  }

  getMessages(): any[] {
    const messages = safeStorage.getItem("messages")
    return messages ? JSON.parse(messages) : []
  }

  async getMessagesByConversation(participants: string[]) {
    const allMessages = await this.getAllMessages()
    return allMessages.filter((msg: any) => participants.every((p) => [msg.senderId, msg.receiverId].includes(p)))
  }

  async saveApprovalStatus(studentId: string, status: string, feedback?: string, adminId?: string) {
    try {
      const approvals = await this.getAllApprovals()
      const key = `approval_${studentId}`

      approvals[key] = {
        studentId,
        status,
        feedback: feedback || "",
        adminId: adminId || "system",
        updatedAt: new Date().toISOString(),
        history: approvals[key]?.history || [],
      }

      // Add to history
      approvals[key].history.push({
        status,
        feedback,
        adminId,
        timestamp: new Date().toISOString(),
      })

      safeStorage.setItem("reportCardApprovals", JSON.stringify(approvals))
      this.triggerEvent("approvalStatusUpdated", { studentId, status, feedback })

      return approvals[key]
    } catch (error) {
      console.error("Error saving approval status:", error)
      throw error
    }
  }

  // Approval Workflow
  saveApprovalWorkflow(approval: any): void {
    const approvals = this.getApprovalWorkflows()
    approvals.push({
      ...approval,
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
    })
    safeStorage.setItem("reportCardApprovals", JSON.stringify(approvals))
    this.emit("approvalSaved", approval)
  }

  async getAllApprovals() {
    const approvals = safeStorage.getItem("reportCardApprovals")
    return approvals ? JSON.parse(approvals) : {}
  }

  getApprovalWorkflows(): any[] {
    const approvals = safeStorage.getItem("reportCardApprovals")
    return approvals ? JSON.parse(approvals) : []
  }

  async getApprovalStatus(studentId: string) {
    const approvals = await this.getAllApprovals()
    return approvals[`approval_${studentId}`] || null
  }

  async saveSystemSettings(settings: any) {
    try {
      const enhancedSettings = {
        ...settings,
        updatedAt: new Date().toISOString(),
        version: Date.now(),
      }
      safeStorage.setItem("systemSettings", JSON.stringify(enhancedSettings))
      this.triggerEvent("settingsUpdated", enhancedSettings)
      return enhancedSettings
    } catch (error) {
      console.error("Error saving system settings:", error)
      throw error
    }
  }

  // System Settings
  saveSystemSettings(settings: any): void {
    const enhancedSettings = {
      ...settings,
      updatedAt: new Date().toISOString(),
    }
    safeStorage.setItem("systemSettings", JSON.stringify(enhancedSettings))
    this.emit("systemSettingsUpdated", enhancedSettings)
  }

  async getSystemSettings() {
    try {
      const settings = safeStorage.getItem("systemSettings")
      return settings
        ? JSON.parse(settings)
        : {
            academicYear: "2024/2025",
            currentTerm: "First Term",
            reportCardDeadline: "",
            schoolName: "Victory Educational Academy",
            schoolAddress: "No. 19, Abdulazeez Street, Zone 3 Duste Baumpaba, Bwari Area Council, Abuja",
          }
    } catch (error) {
      console.error("Error getting system settings:", error)
      return null
    }
  }

  getSystemSettings(): any {
    const settings = safeStorage.getItem("systemSettings")
    return settings ? JSON.parse(settings) : {}
  }

  async getAllClasses() {
    const classes = safeStorage.getItem("classes")
    return classes
      ? JSON.parse(classes)
      : [
          "JSS 1A",
          "JSS 1B",
          "JSS 1C",
          "JSS 2A",
          "JSS 2B",
          "JSS 2C",
          "JSS 3A",
          "JSS 3B",
          "JSS 3C",
          "SS 1A",
          "SS 1B",
          "SS 1C",
          "SS 2A",
          "SS 2B",
          "SS 2C",
          "SS 3A",
          "SS 3B",
          "SS 3C",
        ]
  }

  // Class Management
  getClasses(): any[] {
    const classes = safeStorage.getItem("classes")
    return classes
      ? JSON.parse(classes)
      : [
          { id: "1", name: "JSS1A", students: 25, teacher: "Mrs. Johnson" },
          { id: "2", name: "JSS1B", students: 23, teacher: "Mr. Smith" },
          { id: "3", name: "JSS2A", students: 27, teacher: "Mrs. Brown" },
          { id: "4", name: "JSS2B", students: 24, teacher: "Mr. Davis" },
          { id: "5", name: "JSS3A", students: 26, teacher: "Mrs. Wilson" },
        ]
  }

  async addClass(className: string) {
    try {
      const classes = await this.getAllClasses()
      if (!classes.includes(className)) {
        classes.push(className)
        safeStorage.setItem("classes", JSON.stringify(classes))
        this.triggerEvent("classAdded", { className })
      }
      return classes
    } catch (error) {
      console.error("Error adding class:", error)
      throw error
    }
  }

  createClass(classData: any): void {
    const classes = this.getClasses()
    const newClass = {
      ...classData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    }
    classes.push(newClass)
    safeStorage.setItem("classes", JSON.stringify(classes))
    this.emit("classCreated", newClass)
  }

  async deleteClass(className: string) {
    try {
      const classes = await this.getAllClasses()
      const filteredClasses = classes.filter((c: string) => c !== className)
      safeStorage.setItem("classes", JSON.stringify(filteredClasses))
      this.triggerEvent("classDeleted", { className })
      return filteredClasses
    } catch (error) {
      console.error("Error deleting class:", error)
      throw error
    }
  }

  updateClass(classId: string, classData: any): void {
    const classes = this.getClasses()
    const index = classes.findIndex((cls) => cls.id === classId)
    if (index !== -1) {
      classes[index] = { ...classes[index], ...classData, updatedAt: new Date().toISOString() }
      safeStorage.setItem("classes", JSON.stringify(classes))
      this.emit("classUpdated", classes[index])
    }
  }

  deleteClass(classId: string): void {
    const classes = this.getClasses()
    const filteredClasses = classes.filter((cls) => cls.id !== classId)
    safeStorage.setItem("classes", JSON.stringify(filteredClasses))
    this.emit("classDeleted", classId)
  }

  async savePayment(paymentData: any) {
    try {
      const payments = await this.getAllPayments()
      const newPayment = {
        ...paymentData,
        id: Date.now(),
        timestamp: new Date().toISOString(),
        status: "completed",
      }
      payments.push(newPayment)
      safeStorage.setItem("payments", JSON.stringify(payments))
      this.triggerEvent("paymentCompleted", newPayment)
      return newPayment
    } catch (error) {
      console.error("Error saving payment:", error)
      throw error
    }
  }

  async getAllPayments() {
    const payments = safeStorage.getItem("payments")
    return payments ? JSON.parse(payments) : []
  }

  async getPayments() {
    try {
      const payments = safeStorage.getItem("payments")
      return payments
        ? JSON.parse(payments)
        : [
            {
              id: "1",
              studentName: "John Doe",
              parentName: "Jane Doe",
              amount: 50000,
              status: "paid",
              method: "online",
              date: "2025-01-08",
              reference: "PAY_123456789",
              hasAccess: true,
            },
            {
              id: "2",
              studentName: "Alice Smith",
              parentName: "Bob Smith",
              amount: 50000,
              status: "pending",
              method: "offline",
              date: "2025-01-07",
              hasAccess: false,
            },
            {
              id: "3",
              studentName: "Michael Johnson",
              parentName: "Sarah Johnson",
              amount: 50000,
              status: "failed",
              method: "online",
              date: "2025-01-06",
              reference: "PAY_987654321",
              hasAccess: false,
            },
          ]
    } catch (error) {
      console.error("Error getting payments:", error)
      return []
    }
  }

  async updatePaymentAccess(paymentId: string, hasAccess: boolean) {
    try {
      const payments = await this.getPayments()
      const updatedPayments = payments.map((payment: any) =>
        payment.id === paymentId ? { ...payment, hasAccess, status: hasAccess ? "paid" : payment.status } : payment,
      )
      safeStorage.setItem("payments", JSON.stringify(updatedPayments))
      this.triggerEvent("paymentsUpdated", updatedPayments)
      return updatedPayments.find((p: any) => p.id === paymentId)
    } catch (error) {
      console.error("Error updating payment access:", error)
      throw error
    }
  }

  async createPayment(paymentData: any) {
    try {
      const payments = await this.getPayments()
      const newPayment = {
        ...paymentData,
        id: Date.now().toString(),
        date: new Date().toISOString().split("T")[0],
        hasAccess: paymentData.status === "paid",
      }
      payments.push(newPayment)
      safeStorage.setItem("payments", JSON.stringify(payments))
      this.triggerEvent("paymentsUpdated", payments)
      return newPayment
    } catch (error) {
      console.error("Error creating payment:", error)
      throw error
    }
  }

  async updatePaymentStatus(paymentId: string, status: "paid" | "pending" | "failed") {
    try {
      const payments = await this.getPayments()
      const updatedPayments = payments.map((payment: any) =>
        payment.id === paymentId ? { ...payment, status, hasAccess: status === "paid" } : payment,
      )
      safeStorage.setItem("payments", JSON.stringify(updatedPayments))
      this.triggerEvent("paymentsUpdated", updatedPayments)
      return updatedPayments.find((p: any) => p.id === paymentId)
    } catch (error) {
      console.error("Error updating payment status:", error)
      throw error
    }
  }

  async saveNotification(notificationData: any) {
    try {
      const notifications = await this.getAllNotifications()
      const newNotification = {
        ...notificationData,
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        read: false,
      }
      notifications.push(newNotification)
      safeStorage.setItem("notifications", JSON.stringify(notifications))
      this.triggerEvent("notificationReceived", newNotification)
      return newNotification
    } catch (error) {
      console.error("Error saving notification:", error)
      throw error
    }
  }

  // Notification System
  createNotification(notification: any): void {
    const notifications = this.getNotifications()
    const newNotification = {
      ...notification,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    }
    notifications.push(newNotification)
    safeStorage.setItem("notifications", JSON.stringify(notifications))
    this.emit("notificationCreated", newNotification)
  }

  async getAllNotifications() {
    const notifications = safeStorage.getItem("notifications")
    return notifications ? JSON.parse(notifications) : []
  }

  getNotifications(): any[] {
    const notifications = safeStorage.getItem("notifications")
    return notifications ? JSON.parse(notifications) : []
  }

  async markNotificationAsRead(notificationId: string) {
    try {
      const notifications = await this.getAllNotifications()
      const notification = notifications.find((n: any) => n.id === notificationId)
      if (notification) {
        notification.read = true
        safeStorage.setItem("notifications", JSON.stringify(notifications))
        this.triggerEvent("notificationRead", { notificationId })
      }
      return notification
    } catch (error) {
      console.error("Error marking notification as read:", error)
      throw error
    }
  }

  markNotificationAsRead(notificationId: string): void {
    const notifications = this.getNotifications()
    const index = notifications.findIndex((n) => n.id === notificationId)
    if (index !== -1) {
      notifications[index].read = true
      safeStorage.setItem("notifications", JSON.stringify(notifications))
      this.emit("notificationRead", notifications[index])
    }
  }

  async syncData() {
    try {
      // Trigger sync events for all data types
      const dataTypes = [
        "users",
        "reportCards",
        "messages",
        "approvals",
        "branding",
        "systemSettings",
        "classes",
        "payments",
        "notifications",
      ]

      for (const dataType of dataTypes) {
        this.triggerEvent(`${dataType}Synced`, { timestamp: new Date().toISOString() })
      }

      return true
    } catch (error) {
      console.error("Error syncing data:", error)
      throw error
    }
  }

  async validateData() {
    try {
      const validationResults = {
        users: await this.validateUsers(),
        reportCards: await this.validateReportCards(),
        systemHealth: await this.getSystemHealth(),
      }

      this.triggerEvent("dataValidated", validationResults)
      return validationResults
    } catch (error) {
      console.error("Error validating data:", error)
      throw error
    }
  }

  private async validateUsers() {
    const users = await this.getAllUsers()
    return {
      total: users.length,
      valid: users.filter((u: any) => u.name && u.email && u.role).length,
      invalid: users.filter((u: any) => !u.name || !u.email || !u.role).length,
    }
  }

  private async validateReportCards() {
    const reportCards = await this.getAllReportCards()
    return {
      total: reportCards.length,
      valid: reportCards.filter((r: any) => r.studentId && r.marks).length,
      invalid: reportCards.filter((r: any) => !r.studentId || !r.marks).length,
    }
  }

  async getNotices() {
    const notices = safeStorage.getItem("notices")
    return notices ? JSON.parse(notices) : []
  }

  async createNotice(noticeData: any) {
    try {
      const notices = await this.getNotices()
      const newNotice = {
        ...noticeData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      notices.unshift(newNotice) // Add to beginning for chronological order
      safeStorage.setItem("notices", JSON.stringify(notices))
      this.triggerEvent("noticeCreated", newNotice)
      return newNotice
    } catch (error) {
      console.error("Error creating notice:", error)
      throw error
    }
  }

  // Notice Management
  getNotices(): any[] {
    const notices = safeStorage.getItem("notices")
    return notices ? JSON.parse(notices) : []
  }

  async updateNotice(noticeId: string, updateData: any) {
    try {
      const notices = await this.getNotices()
      const index = notices.findIndex((n: any) => n.id === noticeId)
      if (index > -1) {
        notices[index] = {
          ...notices[index],
          ...updateData,
          updatedAt: new Date().toISOString(),
        }
        safeStorage.setItem("notices", JSON.stringify(notices))
        this.triggerEvent("noticeUpdated", notices[index])
        return notices[index]
      }
      throw new Error("Notice not found")
    } catch (error) {
      console.error("Error updating notice:", error)
      throw error
    }
  }

  createNotice(noticeData: any): void {
    const notices = this.getNotices()
    const newNotice = {
      ...noticeData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    }
    notices.push(newNotice)
    safeStorage.setItem("notices", JSON.stringify(notices))
    this.emit("noticeCreated", newNotice)
  }

  updateNotice(noticeId: string, noticeData: any): void {
    const notices = this.getNotices()
    const index = notices.findIndex((notice) => notice.id === noticeId)
    if (index !== -1) {
      notices[index] = { ...notices[index], ...noticeData, updatedAt: new Date().toISOString() }
      safeStorage.setItem("notices", JSON.stringify(notices))
      this.emit("noticeUpdated", notices[index])
    }
  }

  async deleteNotice(noticeId: string) {
    try {
      const notices = await this.getNotices()
      const filteredNotices = notices.filter((n: any) => n.id !== noticeId)
      safeStorage.setItem("notices", JSON.stringify(filteredNotices))
      this.triggerEvent("noticeDeleted", { noticeId })
      return true
    } catch (error) {
      console.error("Error deleting notice:", error)
      throw error
    }
  }

  deleteNotice(noticeId: string): void {
    const notices = this.getNotices()
    const filteredNotices = notices.filter((notice) => notice.id !== noticeId)
    safeStorage.setItem("notices", JSON.stringify(filteredNotices))
    this.emit("noticeDeleted", noticeId)
  }

  async getNoticesByAudience(audience: string) {
    try {
      const notices = await this.getNotices()
      return notices.filter((notice: any) => notice.targetAudience.includes(audience) || audience === "admin")
    } catch (error) {
      console.error("Error getting notices by audience:", error)
      return []
    }
  }

  async getPinnedNotices(audience?: string) {
    try {
      const notices = await this.getNotices()
      let filteredNotices = notices.filter((notice: any) => notice.isPinned)

      if (audience && audience !== "admin") {
        filteredNotices = filteredNotices.filter((notice: any) => notice.targetAudience.includes(audience))
      }

      return filteredNotices
    } catch (error) {
      console.error("Error getting pinned notices:", error)
      return []
    }
  }

  async getAcademicAnalytics(term = "current", classFilter = "all") {
    try {
      // Get all teacher data and report cards
      const teacherData = await this.getAllTeacherData()
      const reportCards = await this.getAllReportCards()
      const users = await this.getAllUsers()

      // Calculate class performance
      const classPerformance = this.calculateClassPerformance(teacherData, reportCards, classFilter)

      // Calculate subject performance
      const subjectPerformance = this.calculateSubjectPerformance(teacherData, classFilter)

      // Calculate term comparison
      const termComparison = this.calculateTermComparison(teacherData, term)

      // Get top performers
      const topPerformers = this.getTopPerformers(teacherData, reportCards, users, classFilter)

      // Generate radar chart data
      const performanceRadarData = this.generateRadarData(subjectPerformance)

      // Calculate summary statistics
      const summaryStats = this.calculateSummaryStats(classPerformance, teacherData)

      return {
        classPerformance,
        subjectPerformance,
        termComparison,
        topPerformers,
        performanceRadarData,
        summaryStats,
        generatedAt: new Date().toISOString(),
      }
    } catch (error) {
      console.error("Error getting academic analytics:", error)
      return {
        classPerformance: [],
        subjectPerformance: [],
        termComparison: [],
        topPerformers: [],
        performanceRadarData: [],
        summaryStats: {
          overallAverage: 0,
          totalStudents: 0,
          passRate: 0,
          excellenceRate: 0,
        },
      }
    }
  }

  private calculateClassPerformance(teacherData: any[], reportCards: any[], classFilter: string) {
    const classMap = new Map()

    // Process teacher marks data
    Object.entries(teacherData).forEach(([key, data]: [string, any]) => {
      if (data.marks) {
        Object.entries(data.marks).forEach(([studentId, marks]: [string, any]) => {
          const studentClass = this.getStudentClass(studentId)
          if (classFilter === "all" || this.matchesClassFilter(studentClass, classFilter)) {
            if (!classMap.has(studentClass)) {
              classMap.set(studentClass, { scores: [], students: new Set() })
            }

            const total = (marks.firstCA || 0) + (marks.secondCA || 0) + (marks.noteAssignment || 0) + (marks.exam || 0)
            const percentage = (total / (marks.totalObtainable || 100)) * 100

            classMap.get(studentClass).scores.push(percentage)
            classMap.get(studentClass).students.add(studentId)
          }
        })
      }
    })

    return Array.from(classMap.entries()).map(([className, data]: [string, any]) => {
      const scores = data.scores
      const average = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0
      const topScore = scores.length > 0 ? Math.max(...scores) : 0
      const lowScore = scores.length > 0 ? Math.min(...scores) : 0

      return {
        class: className,
        average: Math.round(average * 10) / 10,
        students: data.students.size,
        topScore: Math.round(topScore),
        lowScore: Math.round(lowScore),
      }
    })
  }

  private calculateSubjectPerformance(teacherData: any[], classFilter: string) {
    const subjectMap = new Map()

    Object.entries(teacherData).forEach(([key, data]: [string, any]) => {
      const [className, subject] = key.split("-")

      if (classFilter === "all" || this.matchesClassFilter(className, classFilter)) {
        if (data.marks) {
          const scores: number[] = []

          Object.values(data.marks).forEach((marks: any) => {
            const total = (marks.firstCA || 0) + (marks.secondCA || 0) + (marks.noteAssignment || 0) + (marks.exam || 0)
            const percentage = (total / (marks.totalObtainable || 100)) * 100
            scores.push(percentage)
          })

          if (scores.length > 0) {
            const average = scores.reduce((a, b) => a + b, 0) / scores.length
            const passCount = scores.filter((score) => score >= 50).length
            const excellentCount = scores.filter((score) => score >= 80).length

            if (!subjectMap.has(subject)) {
              subjectMap.set(subject, {
                subject,
                scores: [],
                passCount: 0,
                excellentCount: 0,
                totalStudents: 0,
                teacher: data.teacherName || "Unknown",
              })
            }

            const subjectData = subjectMap.get(subject)
            subjectData.scores.push(...scores)
            subjectData.passCount += passCount
            subjectData.excellentCount += excellentCount
            subjectData.totalStudents += scores.length
          }
        }
      }
    })

    return Array.from(subjectMap.values()).map((data: any) => ({
      subject: data.subject,
      average: Math.round((data.scores.reduce((a: number, b: number) => a + b, 0) / data.scores.length) * 10) / 10,
      passRate: Math.round((data.passCount / data.totalStudents) * 100),
      excellentRate: Math.round((data.excellentCount / data.totalStudents) * 100),
      teacher: data.teacher,
    }))
  }

  private calculateTermComparison(teacherData: any[], currentTerm: string) {
    // Simulate term comparison data based on current data
    const currentAverage = this.calculateOverallAverage(teacherData)

    return [
      { term: "First Term", average: Math.max(currentAverage - 5, 70), passRate: 85, attendance: 92 },
      { term: "Second Term", average: Math.max(currentAverage - 2, 75), passRate: 88, attendance: 89 },
      { term: "Third Term", average: currentAverage, passRate: 91, attendance: 94 },
    ]
  }

  private getTopPerformers(teacherData: any[], reportCards: any[], users: any[], classFilter: string) {
    const studentPerformance = new Map()

    // Calculate student averages from teacher data
    Object.entries(teacherData).forEach(([key, data]: [string, any]) => {
      if (data.marks) {
        Object.entries(data.marks).forEach(([studentId, marks]: [string, any]) => {
          const studentClass = this.getStudentClass(studentId)
          if (classFilter === "all" || this.matchesClassFilter(studentClass, classFilter)) {
            if (!studentPerformance.has(studentId)) {
              studentPerformance.set(studentId, { scores: [], subjects: 0, class: studentClass })
            }

            const total = (marks.firstCA || 0) + (marks.secondCA || 0) + (marks.noteAssignment || 0) + (marks.exam || 0)
            const percentage = (total / (marks.totalObtainable || 100)) * 100

            studentPerformance.get(studentId).scores.push(percentage)
            studentPerformance.get(studentId).subjects++
          }
        })
      }
    })

    // Calculate averages and sort
    const performers = Array.from(studentPerformance.entries())
      .map(([studentId, data]: [string, any]) => {
        const average = data.scores.reduce((a: number, b: number) => a + b, 0) / data.scores.length
        const student = users.find((u: any) => u.id === studentId)

        return {
          name: student?.name || `Student ${studentId}`,
          class: data.class,
          average: Math.round(average * 10) / 10,
          subjects: data.subjects,
        }
      })
      .sort((a, b) => b.average - a.average)
      .slice(0, 5)

    return performers
  }

  private generateRadarData(subjectPerformance: any[]) {
    return subjectPerformance.slice(0, 6).map((subject) => ({
      subject: subject.subject,
      A: subject.average,
      B: Math.max(subject.average - 5, 60), // Simulate previous term data
    }))
  }

  private calculateSummaryStats(classPerformance: any[], teacherData: any[]) {
    const totalStudents = classPerformance.reduce((sum, cls) => sum + cls.students, 0)
    const overallAverage =
      classPerformance.length > 0
        ? classPerformance.reduce((sum, cls) => sum + cls.average * cls.students, 0) / totalStudents
        : 0

    // Calculate pass rate and excellence rate from all scores
    const totalScores: number[] = []
    Object.values(teacherData).forEach((data: any) => {
      if (data.marks) {
        Object.values(data.marks).forEach((marks: any) => {
          const total = (marks.firstCA || 0) + (marks.secondCA || 0) + (marks.noteAssignment || 0) + (marks.exam || 0)
          const percentage = (total / (marks.totalObtainable || 100)) * 100
          totalScores.push(percentage)
        })
      }
    })

    const passCount = totalScores.filter((score) => score >= 50).length
    const excellentCount = totalScores.filter((score) => score >= 80).length
    const passRate = totalScores.length > 0 ? (passCount / totalScores.length) * 100 : 0
    const excellenceRate = totalScores.length > 0 ? (excellentCount / totalScores.length) * 100 : 0

    return {
      overallAverage: Math.round(overallAverage * 10) / 10,
      totalStudents,
      passRate: Math.round(passRate * 10) / 10,
      excellenceRate: Math.round(excellenceRate * 10) / 10,
    }
  }

  private calculateOverallAverage(teacherData: any[]) {
    const totalScores: number[] = []

    Object.values(teacherData).forEach((data: any) => {
      if (data.marks) {
        Object.values(data.marks).forEach((marks: any) => {
          const total = (marks.firstCA || 0) + (marks.secondCA || 0) + (marks.noteAssignment || 0) + (marks.exam || 0)
          const percentage = (total / (marks.totalObtainable || 100)) * 100
          totalScores.push(percentage)
        })
      }
    })

    return totalScores.length > 0 ? totalScores.reduce((a, b) => a + b, 0) / totalScores.length : 0
  }

  private getStudentClass(studentId: string) {
    // Extract class from student ID or use a default mapping
    const classMapping: { [key: string]: string } = {
      student1: "JSS 1A",
      student2: "JSS 1B",
      student3: "JSS 2A",
      student4: "JSS 2B",
      student5: "JSS 3A",
      student6: "SS 1A",
      student7: "SS 2A",
      student8: "SS 3A",
    }

    return classMapping[studentId] || "JSS 1A"
  }

  private matchesClassFilter(studentClass: string, classFilter: string) {
    if (classFilter === "all") return true

    const filterMap: { [key: string]: string[] } = {
      jss1: ["JSS 1A", "JSS 1B"],
      jss2: ["JSS 2A", "JSS 2B"],
      jss3: ["JSS 3A", "JSS 3B"],
      ss1: ["SS 1A", "SS 1B"],
      ss2: ["SS 2A", "SS 2B"],
      ss3: ["SS 3A", "SS 3B"],
    }

    return filterMap[classFilter]?.includes(studentClass) || false
  }

  async saveAnalyticsReport(reportData: any) {
    try {
      const reports = await this.getAllAnalyticsReports()
      const newReport = {
        ...reportData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      }
      reports.push(newReport)
      safeStorage.setItem("analyticsReports", JSON.stringify(reports))
      this.triggerEvent("analyticsReportSaved", newReport)
      return newReport
    } catch (error) {
      console.error("Error saving analytics report:", error)
      throw error
    }
  }

  // Academic Analytics
  saveAnalyticsReport(report: any): void {
    const reports = this.getAnalyticsReports()
    reports.push({
      ...report,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    })
    safeStorage.setItem("analyticsReports", JSON.stringify(reports))
    this.emit("analyticsReportSaved", report)
  }

  async getAllAnalyticsReports() {
    const reports = safeStorage.getItem("analyticsReports")
    return reports ? JSON.parse(reports) : []
  }

  getAnalyticsReports(): any[] {
    const reports = safeStorage.getItem("analyticsReports")
    return reports ? JSON.parse(reports) : []
  }

  async getStudentsByClass(className: string) {
    try {
      const users = await this.getAllUsers()
      return users.filter((user: any) => user.role === "Student" && user.class === className)
    } catch (error) {
      console.error("Error getting students by class:", error)
      throw error
    }
  }

  async getStudentAcademicData(studentId: string) {
    try {
      const marksKey = `marks_${studentId}`
      const marks = safeStorage.getItem(marksKey)

      if (!marks) {
        // Return sample data for demonstration
        return [
          { subject: "Mathematics", totalPercentage: 75 },
          { subject: "English", totalPercentage: 82 },
          { subject: "Science", totalPercentage: 68 },
          { subject: "Social Studies", totalPercentage: 79 },
          { subject: "French", totalPercentage: 71 },
        ]
      }

      return JSON.parse(marks)
    } catch (error) {
      console.error("Error getting student academic data:", error)
      throw error
    }
  }

  async getStudentAttendance(studentId: string) {
    try {
      const attendanceKey = `attendance_${studentId}`
      const attendance = safeStorage.getItem(attendanceKey)

      if (!attendance) {
        // Generate realistic attendance data
        const present = Math.floor(Math.random() * 20) + 160 // 160-180 days
        const total = 180
        const percentage = Math.round((present / total) * 100)

        const attendanceData = {
          present,
          total,
          percentage,
          absent: total - present,
        }

        // Save generated data
        safeStorage.setItem(attendanceKey, JSON.stringify(attendanceData))
        return attendanceData
      }

      return JSON.parse(attendance)
    } catch (error) {
      console.error("Error getting student attendance:", error)
      throw error
    }
  }

  // Student Data Management
  getStudentMarks(studentId: string, term: string): any {
    const marksKey = `marks_${studentId}_${term}`
    const marks = safeStorage.getItem(marksKey)
    return marks ? JSON.parse(marks) : null
  }

  async getUpcomingEvents(className: string) {
    try {
      const eventsKey = `events_${className}`
      const events = safeStorage.getItem(eventsKey)

      if (!events) {
        // Generate sample events for the class
        const sampleEvents = [
          {
            id: 1,
            title: "Mathematics Test",
            date: "March 20, 2024",
            description: "Chapter 5-7 coverage",
            type: "exam",
            class: className,
          },
          {
            id: 2,
            title: "Science Fair",
            date: "March 25, 2024",
            description: "Present your science projects",
            type: "event",
            class: className,
          },
          {
            id: 3,
            title: "Parent-Teacher Meeting",
            date: "March 30, 2024",
            description: "Discuss student progress",
            type: "meeting",
            class: className,
          },
        ]

        safeStorage.setItem(eventsKey, JSON.stringify(sampleEvents))
        return sampleEvents
      }

      return JSON.parse(events)
    } catch (error) {
      console.error("Error getting upcoming events:", error)
      throw error
    }
  }

  async getStudentAttendance(studentId: string): any {
    const attendanceKey = `attendance_${studentId}`
    const attendance = safeStorage.getItem(attendanceKey)

    if (!attendance) {
      const attendanceData = {
        present: Math.floor(Math.random() * 20) + 80,
        total: 100,
        percentage: 0,
      }
      attendanceData.percentage = Math.round((attendanceData.present / attendanceData.total) * 100)
      safeStorage.setItem(attendanceKey, JSON.stringify(attendanceData))
      return attendanceData
    }

    return JSON.parse(attendance)
  }

  async getUpcomingEvents(): any[] {
    const eventsKey = "upcomingEvents"
    const events = safeStorage.getItem(eventsKey)

    if (!events) {
      const sampleEvents = [
        {
          id: "1",
          title: "Mid-Term Examination",
          date: "2024-02-15",
          type: "exam",
        },
        {
          id: "2",
          title: "Parent-Teacher Meeting",
          date: "2024-02-20",
          type: "meeting",
        },
        {
          id: "3",
          title: "Sports Day",
          date: "2024-02-25",
          type: "event",
        },
      ]
      safeStorage.setItem(eventsKey, JSON.stringify(sampleEvents))
      return sampleEvents
    }

    return JSON.parse(events)
  }

  async getStudentProfile(studentId: string) {
    try {
      const profileKey = `profile_${studentId}`
      const profile = safeStorage.getItem(profileKey)

      if (!profile) {
        // Return basic profile from users data
        const users = await this.getAllUsers()
        const user = users.find((u: any) => u.id === studentId)
        return user || null
      }

      return JSON.parse(profile)
    } catch (error) {
      console.error("Error getting student profile:", error)
      throw error
    }
  }

  async updateStudentProfile(studentId: string, profileData: any) {
    try {
      const profileKey = `profile_${studentId}`
      const updatedProfile = {
        ...profileData,
        id: studentId,
        updatedAt: new Date().toISOString(),
      }

      safeStorage.setItem(profileKey, JSON.stringify(updatedProfile))

      // Also update in users array
      const users = await this.getAllUsers()
      const userIndex = users.findIndex((u: any) => u.id === studentId)
      if (userIndex >= 0) {
        users[userIndex] = { ...users[userIndex], ...updatedProfile }
        safeStorage.setItem("users", JSON.stringify(users))
      }

      this.triggerEvent("profileUpdate", updatedProfile)
      return updatedProfile
    } catch (error) {
      console.error("Error updating student profile:", error)
      throw error
    }
  }

  getStudentProfile(studentId: string): any {
    const profileKey = `profile_${studentId}`
    const profile = safeStorage.getItem(profileKey)
    return profile ? JSON.parse(profile) : null
  }

  async renewLibraryBook(bookId: string, studentId: string) {
    try {
      const booksKey = `libraryBooks_${studentId}`
      const books = safeStorage.getItem(booksKey)

      if (books) {
        const booksList = JSON.parse(books)
        const bookIndex = booksList.findIndex((b: any) => b.id === bookId)

        if (bookIndex >= 0) {
          // Extend due date by 2 weeks
          const currentDue = new Date(booksList[bookIndex].dueDate)
          currentDue.setDate(currentDue.getDate() + 14)
          booksList[bookIndex].dueDate = currentDue.toISOString().split("T")[0]
          booksList[bookIndex].renewedAt = new Date().toISOString()

          safeStorage.setItem(booksKey, JSON.stringify(booksList))
          this.triggerEvent("libraryBookRenewed", { bookId, studentId })
        }
      }

      return true
    } catch (error) {
      console.error("Error renewing library book:", error)
      throw error
    }
  }

  async submitAssignment(submissionData: any) {
    try {
      const submissionsKey = `submissions_${submissionData.studentId}`
      const submissions = safeStorage.getItem(submissionsKey)
      const submissionsList = submissions ? JSON.parse(submissions) : []

      // Update or add submission
      const existingIndex = submissionsList.findIndex((s: any) => s.assignmentId === submissionData.assignmentId)

      if (existingIndex >= 0) {
        submissionsList[existingIndex] = { ...submissionsList[existingIndex], ...submissionData }
      } else {
        submissionsList.push({
          ...submissionData,
          id: Date.now().toString(),
          submittedAt: new Date().toISOString(),
        })
      }

      safeStorage.setItem(submissionsKey, JSON.stringify(submissionsList))
      this.triggerEvent("assignmentSubmitted", submissionData)

      return submissionData
    } catch (error) {
      console.error("Error submitting assignment:", error)
      throw error
    }
  }

  async promoteStudent(studentId: string, promotionData: any) {
    try {
      const users = await this.getAllUsers()
      const studentIndex = users.findIndex((u: any) => u.id === studentId)

      if (studentIndex >= 0) {
        users[studentIndex].class = promotionData.toClass
        users[studentIndex].session = promotionData.session
        users[studentIndex].promotedAt = promotionData.promotedAt

        safeStorage.setItem("users", JSON.stringify(users))
        this.triggerEvent("studentPromoted", { studentId, promotionData })
      }

      return true
    } catch (error) {
      console.error("Error promoting student:", error)
      throw error
    }
  }

  async saveBatchPromotion(batchData: any) {
    try {
      const batches = JSON.parse(safeStorage.getItem("batchPromotions") || "[]")
      batches.push(batchData)
      safeStorage.setItem("batchPromotions", JSON.stringify(batches))
      this.triggerEvent("batchPromotionCompleted", batchData)
      return batchData
    } catch (error) {
      console.error("Error saving batch promotion:", error)
      throw error
    }
  }
}

const databaseManagerInstance = DatabaseManager.getInstance()
export { databaseManagerInstance as DatabaseManager }
export { databaseManagerInstance as dbManager }
export default databaseManagerInstance
