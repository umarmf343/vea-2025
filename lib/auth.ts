import { dbManager } from "@/lib/database-manager"

export type UserRole = "super_admin" | "admin" | "teacher" | "student" | "parent" | "librarian" | "accountant"

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  isActive: boolean
  lastLogin?: string
  profileImage?: string
  metadata?: Record<string, any>
}

export interface AuthSession {
  user: User
  token: string
  expiresAt: string
}

export const auth = {
  login: async (email: string, password: string): Promise<AuthSession | null> => {
    try {
      // Get user from database
      const user = await dbManager.getUserByEmail(email)
      if (!user || !user.isActive) {
        return null
      }

      // Verify password (in real implementation, use bcrypt)
      const isValidPassword = await dbManager.verifyPassword(password, user.passwordHash)
      if (!isValidPassword) {
        return null
      }

      // Update last login
      await dbManager.updateUserLastLogin(user.id)

      // Generate JWT token (in real implementation, use proper JWT)
      const token = await dbManager.generateAuthToken(user.id)

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as UserRole,
          isActive: user.isActive,
          lastLogin: new Date().toISOString(),
          profileImage: user.profileImage,
          metadata: user.metadata,
        },
        token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }
    } catch (error) {
      console.error("Login error:", error)
      return null
    }
  },

  validateToken: async (token: string): Promise<User | null> => {
    try {
      const userId = await dbManager.validateAuthToken(token)
      if (!userId) {
        return null
      }

      const user = await dbManager.getUserById(userId)
      if (!user || !user.isActive) {
        return null
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as UserRole,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        profileImage: user.profileImage,
        metadata: user.metadata,
      }
    } catch (error) {
      console.error("Token validation error:", error)
      return null
    }
  },

  hasPermission: (userRole: UserRole, requiredRole: UserRole): boolean => {
    const roleHierarchy: Record<UserRole, number> = {
      super_admin: 7,
      admin: 6,
      teacher: 5,
      librarian: 4,
      accountant: 4,
      parent: 3,
      student: 2,
    }

    return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
  },

  register: async (userData: {
    name: string
    email: string
    password: string
    role: UserRole
    metadata?: Record<string, any>
  }): Promise<User | null> => {
    try {
      const existingUser = await dbManager.getUserByEmail(userData.email)
      if (existingUser) {
        throw new Error("User already exists")
      }

      const hashedPassword = await dbManager.hashPassword(userData.password)
      const newUser = await dbManager.createUser({
        ...userData,
        passwordHash: hashedPassword,
        isActive: true,
      })

      return {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role as UserRole,
        isActive: newUser.isActive,
        profileImage: newUser.profileImage,
        metadata: newUser.metadata,
      }
    } catch (error) {
      console.error("Registration error:", error)
      return null
    }
  },

  logout: async (token: string): Promise<boolean> => {
    try {
      await dbManager.invalidateAuthToken(token)
      return true
    } catch (error) {
      console.error("Logout error:", error)
      return false
    }
  },
}
