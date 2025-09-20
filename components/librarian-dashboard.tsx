"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { BookOpen, Search, Plus, Users, Calendar, AlertTriangle } from "lucide-react"

interface LibrarianDashboardProps {
  librarian: {
    id: string
    name: string
    email: string
  }
}

interface LibraryBook {
  id: string
  title: string
  author: string
  isbn: string
  category: string
  copies: number
  available: number
  addedBy?: string | null
  addedDate?: string | null
}

interface BorrowedBookRecord {
  id: string
  bookId: string
  bookTitle: string
  studentId: string
  studentName: string
  studentClass: string
  borrowDate: string
  dueDate: string
  status: "active" | "returned" | "overdue"
  issuedBy?: string | null
  returnedDate?: string | null
  returnedTo?: string | null
}

interface LibraryRequestRecord {
  id: string
  bookId: string | null
  bookTitle: string
  studentId: string
  studentName: string
  studentClass: string
  requestDate: string
  status: "pending" | "approved" | "rejected"
  approvedBy?: string | null
  approvedDate?: string | null
  rejectedBy?: string | null
  rejectedDate?: string | null
  notes?: string | null
}

export function LibrarianDashboard({ librarian }: LibrarianDashboardProps) {
  const [selectedTab, setSelectedTab] = useState("overview")
  const [searchTerm, setSearchTerm] = useState("")
  const [books, setBooks] = useState<LibraryBook[]>([])
  const [borrowedBooks, setBorrowedBooks] = useState<BorrowedBookRecord[]>([])
  const [requests, setRequests] = useState<LibraryRequestRecord[]>([])
  const [loading, setLoading] = useState(true)

  const loadLibraryData = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) {
        setLoading(true)
      }

      try {
        const response = await fetch("/api/library/dashboard", { cache: "no-store" })

        if (!response.ok) {
          throw new Error(`Failed to load library data (${response.status})`)
        }

        const data = (await response.json()) as Partial<{
          books: LibraryBook[]
          borrowedBooks: BorrowedBookRecord[]
          requests: LibraryRequestRecord[]
        }>

        setBooks(Array.isArray(data.books) ? data.books : [])
        setBorrowedBooks(Array.isArray(data.borrowedBooks) ? data.borrowedBooks : [])
        setRequests(Array.isArray(data.requests) ? data.requests : [])
      } catch (error) {
        console.error("Error loading library data:", error)
        if (!showSpinner) {
          setLoading(false)
        }
      } finally {
        if (showSpinner) {
          setLoading(false)
        }
      }
    },
    [],
  )

  useEffect(() => {
    void loadLibraryData()
  }, [loadLibraryData])

  const handleAddBook = async (bookData: {
    title: string
    author: string
    isbn: string
    category: string
    copies: number
    available?: number
  }) => {
    try {
      setLoading(true)
      const response = await fetch("/api/library/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...bookData,
          copies: Number(bookData.copies),
          available:
            bookData.available !== undefined ? Number(bookData.available) : Number(bookData.copies),
          addedBy: librarian.id,
        }),
      })

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(errorPayload?.error ?? "Failed to add book")
      }

      await loadLibraryData(false)
    } catch (error) {
      console.error("Error adding book:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleApproveRequest = async (requestId: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/library/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved", librarianId: librarian.id }),
      })

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(errorPayload?.error ?? "Failed to approve request")
      }

      await loadLibraryData(false)
    } catch (error) {
      console.error("Error approving request:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleRejectRequest = async (requestId: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/library/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected", librarianId: librarian.id }),
      })

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(errorPayload?.error ?? "Failed to reject request")
      }

      await loadLibraryData(false)
    } catch (error) {
      console.error("Error rejecting request:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleReturnBook = async (borrowId: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/library/borrowed/${borrowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "return", librarianId: librarian.id }),
      })

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(errorPayload?.error ?? "Failed to update borrow record")
      }

      await loadLibraryData(false)
    } catch (error) {
      console.error("Error returning book:", error)
    } finally {
      setLoading(false)
    }
  }

  const overdueBooks = borrowedBooks.filter((book) => {
    const dueDate = new Date(book.dueDate)
    return dueDate < new Date() && book.status === "active"
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2d682d] mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading library data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#2d682d] to-[#b29032] text-white p-6 rounded-lg">
        <h1 className="text-2xl font-bold">Welcome, {librarian.name}</h1>
        <p className="text-green-100">Library Management - VEA 2025</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-8 w-8 text-[#2d682d]" />
              <div>
                <p className="text-2xl font-bold text-[#2d682d]">{books.length}</p>
                <p className="text-sm text-gray-600">Total Books</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-8 w-8 text-[#b29032]" />
              <div>
                <p className="text-2xl font-bold text-[#b29032]">{borrowedBooks.length}</p>
                <p className="text-sm text-gray-600">Borrowed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-8 w-8 text-[#2d682d]" />
              <div>
                <p className="text-2xl font-bold text-[#2d682d]">{requests.length}</p>
                <p className="text-sm text-gray-600">Requests</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold text-red-500">{overdueBooks.length}</p>
                <p className="text-sm text-gray-600">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="books">Books</TabsTrigger>
          <TabsTrigger value="borrowed">Borrowed</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-[#2d682d]">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {borrowedBooks.slice(0, 3).map((book, index) => (
                    <div key={index} className="p-2 bg-green-50 border-l-4 border-[#2d682d] rounded">
                      <p className="text-sm font-medium">Book Borrowed</p>
                      <p className="text-xs text-gray-600">
                        {book.bookTitle} by {book.studentName}
                      </p>
                    </div>
                  ))}
                  {requests
                    .filter((r) => r.status === "pending")
                    .slice(0, 2)
                    .map((request, index) => (
                      <div key={index} className="p-2 bg-yellow-50 border-l-4 border-[#b29032] rounded">
                        <p className="text-sm font-medium">New Request</p>
                        <p className="text-xs text-gray-600">
                          {request.bookTitle} by {request.studentName}
                        </p>
                      </div>
                    ))}
                  {overdueBooks.slice(0, 1).map((book, index) => (
                    <div key={index} className="p-2 bg-red-50 border-l-4 border-red-500 rounded">
                      <p className="text-sm font-medium">Overdue Alert</p>
                      <p className="text-xs text-gray-600">
                        {book.bookTitle} by {book.studentName}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-[#2d682d]">Popular Books</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {books.slice(0, 5).map((book) => (
                    <div key={book.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div>
                        <p className="text-sm font-medium">{book.title}</p>
                        <p className="text-xs text-gray-600">{book.author}</p>
                      </div>
                      <Badge variant="outline">{(book.copies || 0) - (book.available || 0)} borrowed</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="books" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">Book Management</CardTitle>
              <CardDescription>Manage library books and inventory</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex space-x-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                      placeholder="Search books..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <Button
                    className="bg-[#b29032] hover:bg-[#b29032]/90"
                    onClick={() => {
                      const title = prompt("Enter book title:")
                      const author = prompt("Enter author:")
                      const isbn = prompt("Enter ISBN:")
                      const copies = prompt("Enter number of copies:")
                      const category = prompt("Enter category:")

                      if (title && author && isbn && copies && category) {
                        handleAddBook({
                          title,
                          author,
                          isbn,
                          copies: Number.parseInt(copies),
                          available: Number.parseInt(copies),
                          category,
                        })
                      }
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Book
                  </Button>
                </div>

                <div className="space-y-2">
                  {books
                    .filter(
                      (book) =>
                        book.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        book.author?.toLowerCase().includes(searchTerm.toLowerCase()),
                    )
                    .map((book) => (
                      <div key={book.id} className="flex justify-between items-center p-4 border rounded-lg">
                        <div className="flex-1">
                          <h3 className="font-medium">{book.title}</h3>
                          <p className="text-sm text-gray-600">by {book.author}</p>
                          <p className="text-xs text-gray-500">ISBN: {book.isbn}</p>
                          <Badge variant="outline" className="mt-1">
                            {book.category}
                          </Badge>
                        </div>
                        <div className="text-center mr-4">
                          <p className="text-sm font-medium">Available</p>
                          <p className="text-lg font-bold text-[#2d682d]">
                            {book.available || 0}/{book.copies || 0}
                          </p>
                        </div>
                        <div className="space-x-2">
                          <Button size="sm" variant="outline">
                            Edit
                          </Button>
                          <Button size="sm" className="bg-[#2d682d] hover:bg-[#2d682d]/90">
                            View Details
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="borrowed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">Borrowed Books</CardTitle>
              <CardDescription>Track borrowed books and due dates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {borrowedBooks.map((record) => (
                  <div key={record.id} className="flex justify-between items-center p-4 border rounded-lg">
                    <div className="flex-1">
                      <h3 className="font-medium">{record.bookTitle}</h3>
                      <p className="text-sm text-gray-600">
                        {record.studentName} ({record.studentClass})
                      </p>
                      <p className="text-xs text-gray-500">
                        Borrowed: {record.borrowDate} | Due: {record.dueDate}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge
                        variant={
                          new Date(record.dueDate) < new Date() && record.status === "active"
                            ? "destructive"
                            : "default"
                        }
                      >
                        {new Date(record.dueDate) < new Date() && record.status === "active"
                          ? "overdue"
                          : record.status}
                      </Badge>
                      {record.status === "active" && (
                        <Button
                          size="sm"
                          className="bg-[#2d682d] hover:bg-[#2d682d]/90"
                          onClick={() => handleReturnBook(record.id)}
                        >
                          Return Book
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#2d682d]">Book Requests</CardTitle>
              <CardDescription>Manage student book requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {requests.map((request) => (
                  <div key={request.id} className="flex justify-between items-center p-4 border rounded-lg">
                    <div className="flex-1">
                      <h3 className="font-medium">{request.bookTitle}</h3>
                      <p className="text-sm text-gray-600">
                        {request.studentName} ({request.studentClass})
                      </p>
                      <p className="text-xs text-gray-500">Requested: {request.requestDate}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={request.status === "pending" ? "secondary" : "default"}>{request.status}</Badge>
                      {request.status === "pending" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleRejectRequest(request.id)}>
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            className="bg-[#2d682d] hover:bg-[#2d682d]/90"
                            onClick={() => handleApproveRequest(request.id)}
                          >
                            Approve
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
