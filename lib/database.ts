 persistCollection(key, [value])
    return deepClone(value)
  }

  if (records.length > 1) {
    const [value] = records
    persistCollection(key, [value])
    return deepClone(value)
  }

  return deepClone(records[0])
}

function generateId(prefix: string): string {
  if (typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`
  }

  return `${prefix}_${crypto.randomBytes(12).toString("hex")}`
}

function createDefaultUsers(): StoredUser[] {
  const timestamp = new Date().toISOString()

  return [
    {
      id: "user_super_admin",
      name: "Super Admin",
      email: "superadmin@vea.edu.ng",
      role: "super_admin",
      passwordHash: defaultPasswordHash,
      isActive: true,
      status: "active",
      classId: null,
      studentIds: [],
      subjects: [],
      metadata: null,
      profileImage: null,
      lastLogin: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "user_admin",
      name: "Admin User",
      email: "admin@vea.edu.ng",
      role: "admin",
      passwordHash: defaultPasswordHash,
      isActive: true,
      status: "active",
      classId: null,
      studentIds: [],
      subjects: [],
      metadata: null,
      profileImage: null,
      lastLogin: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ]
}

function createDefaultFeeStructures(): FeeStructureRecord[] {
  const timestamp = new Date().toISOString()

  const seedData: Array<Omit<FeeStructureRecord, "id" | "createdAt" | "updatedAt">> = [
    { className: "JSS 1", tuition: 40000, development: 5000, exam: 3000, sports: 1000, library: 1000, total: 50000 },
