"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { BookOpen, Search, Plus, Users, Calendar, AlertTriangle } from "lucide-react"
import { dbManager } from "@/lib/database-manager"
import { useToast } from "@/hooks/use-toast"
import { TutorialLink } from "@/components/tutorial-link"

interface LibrarianDashboardProps {
  librarian: {
    id: string
    name: string
    email: string
  }
}

type BorrowStatus = "active" | "overdue" | "returned"
type RequestStatus = "pending" | "approved" | "rejected" | "fulfilled"

interface InventoryBook {
  id: string
  title: string
  author: string
  isbn: string
  copies: number
  available: number
  category: string
  tags?: string[]
  description?: string | null
  shelfLocation?: string | null
  coverImage?: string | null
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
  status: BorrowStatus
  returnedDate: string | null
  returnedTo: string | null
}

interface BookRequestRecord {
  id: string
  bookId: string | null
  bookTitle: string
  studentId: string
  studentName: string
  studentClass: string
  requestDate: string
  status: RequestStatus
  approvedBy?: string | null
  rejectedBy?: string | null
  notes?: string | null
}

export function LibrarianDashboard({ librarian }: LibrarianDashboardProps) {
  const [selectedTab, setSelectedTab] = useState("overview")
  const [searchTerm, setSearchTerm] = useState("")
  const [books, setBooks] = useState<InventoryBook[]>([])
  const [borrowedBooks, setBorrowedBooks] = useState<BorrowedBookRecord[]>([])
  const [requests, setRequests] = useState<BookRequestRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [bookDialogOpen, setBookDialogOpen] = useState(false)
  const [bookDetailsOpen, setBookDetailsOpen] = useState(false)
  const [bookDialogLoading, setBookDialogLoading] = useState(false)
  const [editingBookId, setEditingBookId] = useState<string | null>(null)
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null)
  const [bookForm, setBookForm] = useState({
    title: "",
    author: "",
    isbn: "",
    category: "",
    copies: "1",
    available: "1",
    description: "",
    shelfLocation: "",
    tags: "",
    coverImage: "",
  })

  const { toast } = useToast()

  const loadLibraryData = useCallback(async () => {
    try {
      setLoading(true)
      const [booksData, borrowedData, requestsData] = await Promise.all([
        dbManager.getBooks(),
        dbManager.getBorrowedBooks(),
        dbManager.getBookRequests(),
      ])

      setBooks(booksData)
      setBorrowedBooks(borrowedData)
      setRequests(requestsData)
    } catch (error) {
      console.error("Error loading library data:", error)
      toast({
        variant: "destructive",
        title: "Library data unavailable",
        description: "We were unable to load the latest library information.",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadLibraryData()

    const handleUpdates = () => {
      void loadLibraryData()
    }

    dbManager.on("libraryInventoryUpdated", handleUpdates)
    dbManager.on("libraryBorrowUpdated", handleUpdates)
    dbManager.on("libraryBooksUpdated", handleUpdates)
    dbManager.on("libraryRequestUpdated", handleUpdates)

    return () => {
      dbManager.off("libraryInventoryUpdated", handleUpdates)
      dbManager.off("libraryBorrowUpdated", handleUpdates)
      dbManager.off("libraryBooksUpdated", handleUpdates)
      dbManager.off("libraryRequestUpdated", handleUpdates)
    }
  }, [loadLibraryData])

  const handleAddBook = async (bookData: Omit<InventoryBook, "id" | "available" | "copies"> & { copies: number; available?: number }) => {
    try {
      await dbManager.addBook({
        ...bookData,
        copies: bookData.copies,
        available: bookData.available ?? bookData.copies,
        addedBy: librarian.id,
      })
      toast({
        title: "Book added",
        description: `${bookData.title} has been added to the library inventory.`,
      })
      await loadLibraryData()
    } catch (error) {
      console.error("Error adding book:", error)
      toast({
        variant: "destructive",
        title: "Unable to add book",
        description: "Please check the book details and try again.",
      })
    }
  }

  const handleApproveRequest = async (requestId: string) => {
    try {
      await dbManager.updateBookRequest(requestId, {
        status: "approved",
        approvedBy: librarian.id,
      })
      toast({
        title: "Request approved",
        description: "The student has been notified and the book has been issued.",
      })
      await loadLibraryData()
    } catch (error) {
      console.error("Error approving request:", error)
      toast({
        variant: "destructive",
        title: "Approval failed",
        description: "We couldn't approve this request. Please try again.",
      })
    }
  }

  const handleRejectRequest = async (requestId: string) => {
    try {
      await dbManager.updateBookRequest(requestId, {
        status: "rejected",
        rejectedBy: librarian.id,
      })
      toast({
        title: "Request rejected",
        description: "The student will be notified of the rejection.",
      })
      await loadLibraryData()
    } catch (error) {
      console.error("Error rejecting request:", error)
      toast({
        variant: "destructive",
        title: "Rejection failed",
        description: "We couldn't reject this request. Please try again.",
      })
    }
  }

  const handleReturnBook = async (borrowId: string) => {
    try {
      await dbManager.returnBook(borrowId, {
        returnedTo: librarian.id,
      })
      toast({
        title: "Book returned",
        description: "The inventory has been updated.",
      })
      await loadLibraryData()
    } catch (error) {
      console.error("Error returning book:", error)
      toast({
        variant: "destructive",
        title: "Return failed",
        description: "We couldn't mark this book as returned. Please try again.",
      })
    }
  }

  const overdueBooks = borrowedBooks.filter((book) => {
    if (book.status === "returned") {
      return false
    }
    if (book.status === "overdue") {
      return true
    }
    const dueDate = new Date(book.dueDate)
    return dueDate < new Date()
  })

  const selectedBook = useMemo(
    () => (selectedBookId ? books.find((book) => book.id === selectedBookId) ?? null : null),
    [books, selectedBookId],
  )

  const resetBookForm = useCallback(() => {
    setBookForm({
      title: "",
      author: "",
      isbn: "",
      category: "",
      copies: "1",
      available: "1",
      description: "",
      shelfLocation: "",
      tags: "",
      coverImage: "",
    })
    setEditingBookId(null)
  }, [])

  const handleOpenAddBook = useCallback(() => {
    resetBookForm()
    setBookDialogOpen(true)
  }, [resetBookForm])

  const handleBookFormChange = (field: keyof typeof bookForm, value: string) => {
    setBookForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleOpenEditBook = useCallback(
    (book: InventoryBook) => {
      setEditingBookId(book.id)
      setBookForm({
        title: book.title ?? "",
        author: book.author ?? "",
        isbn: book.isbn ?? "",
        category: book.category ?? "",
        copies: String(book.copies ?? 1),
        available: String(book.available ?? book.copies ?? 1),
        description: book.description ?? "",
        shelfLocation: book.shelfLocation ?? "",
        tags: (book.tags ?? []).join(", "),
        coverImage: book.coverImage ?? "",
      })
      setBookDialogOpen(true)
      setBookDetailsOpen(false)
    },
    [],
  )

  const handleViewBook = useCallback((book: InventoryBook) => {
    setSelectedBookId(book.id)
    setBookDetailsOpen(true)
  }, [])

  const handleDeleteBook = useCallback(
    async (bookId: string) => {
      const runtimeConfirm = typeof window !== "undefined" ? window.confirm : undefined
      const confirmed = runtimeConfirm ? runtimeConfirm("Remove this book from the library catalog?") : true
      if (!confirmed) {
        return
      }

      try {
        setDeletingBookId(bookId)
        await dbManager.deleteBook(bookId)
        toast({
          title: "Book removed",
          description: "The book has been deleted from the catalog.",
        })
        if (selectedBookId === bookId) {
          setSelectedBookId(null)
          setBookDetailsOpen(false)
        }
        await loadLibraryData()
      } catch (error) {
        console.error("Error deleting book:", error)
        toast({
          variant: "destructive",
          title: "Unable to delete book",
          description: error instanceof Error ? error.message : "Please try again later.",
        })
      } finally {
        setDeletingBookId(null)
      }
    },
    [loadLibraryData, selectedBookId, toast],
  )

  const handleSubmitBook = useCallback(async () => {
    if (!bookForm.title.trim() || !bookForm.author.trim() || !bookForm.isbn.trim() || !bookForm.category.trim()) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Title, author, ISBN, and category are required.",
      })
      return
    }

    const copies = Number.parseInt(bookForm.copies, 10)
    const available = Number.parseInt(bookForm.available, 10)

    if (Number.isNaN(copies) || copies <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid copies",
        description: "Enter a valid number of copies.",
      })
      return
    }

    if (Number.isNaN(available) || available < 0) {
      toast({
        variant: "destructive",
        title: "Invalid availability",
        description: "Enter how many copies are currently available.",
      })
      return
    }

    const normalizedAvailable = Math.min(available, copies)
    const tags = bookForm.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)

    try {
      setBookDialogLoading(true)

      if (editingBookId) {
        await dbManager.updateBook(editingBookId, {
          title: bookForm.title.trim(),
          author: bookForm.author.trim(),
          isbn: bookForm.isbn.trim(),
          category: bookForm.category.trim(),
          copies,
          available: normalizedAvailable,
          description: bookForm.description.trim() ? bookForm.description.trim() : null,
          shelfLocation: bookForm.shelfLocation.trim() ? bookForm.shelfLocation.trim() : null,
          coverImage: bookForm.coverImage.trim() ? bookForm.coverImage.trim() : null,
          tags,
        })

        toast({
          title: "Book updated",
          description: "The book information has been refreshed.",
        })
      } else {
        await handleAddBook({
          title: bookForm.title.trim(),
          author: bookForm.author.trim(),
          isbn: bookForm.isbn.trim(),
          category: bookForm.category.trim(),
          copies,
          available: normalizedAvailable,
          description: bookForm.description.trim() ? bookForm.description.trim() : null,
          shelfLocation: bookForm.shelfLocation.trim() ? bookForm.shelfLocation.trim() : null,
          coverImage: bookForm.coverImage.trim() ? bookForm.coverImage.trim() : null,
          tags,
        })
      }

      await loadLibraryData()
      setBookDialogOpen(false)
      resetBookForm()
    } catch (error) {
      console.error("Error saving book:", error)
      toast({
        variant: "destructive",
        title: "Unable to save book",
        description: error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setBookDialogLoading(false)
    }
  }, [bookForm, editingBookId, handleAddBook, loadLibraryData, resetBookForm, toast])

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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Welcome, {librarian.name}</h1>
            <p className="text-green-100">Library Management - VEA 2025</p>
          </div>
          <TutorialLink
            href="https://www.youtube.com/watch?v=3GwjfUFyY6M"
            variant="inverse"
            className="text-white"
          />
        </div>
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
                  <Button className="bg-[#b29032] hover:bg-[#b29032]/90" onClick={handleOpenAddBook}>
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
                          <Button size="sm" variant="outline" onClick={() => handleOpenEditBook(book)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            className="bg-[#2d682d] hover:bg-[#2d682d]/90"
                            onClick={() => handleViewBook(book)}
                          >
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
                      <Badge variant={record.status === "overdue" ? "destructive" : "default"}>
                        {record.status}
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

      <Dialog
        open={bookDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setBookDialogOpen(true)
          } else {
            setBookDialogOpen(false)
            resetBookForm()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBookId ? "Update Book" : "Add New Book"}</DialogTitle>
            <DialogDescription>
              {editingBookId
                ? "Edit the details of the selected book and update the catalog."
                : "Provide the details for the new book you want to add to the library."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="book-title">Title</Label>
              <Input
                id="book-title"
                value={bookForm.title}
                onChange={(event) => handleBookFormChange("title", event.target.value)}
                placeholder="e.g. Introduction to Biology"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="book-author">Author</Label>
              <Input
                id="book-author"
                value={bookForm.author}
                onChange={(event) => handleBookFormChange("author", event.target.value)}
                placeholder="Author name"
              />
            </div>
            <div className="grid gap-2 md:grid-cols-2 md:gap-4">
              <div className="grid gap-2">
                <Label htmlFor="book-isbn">ISBN</Label>
                <Input
                  id="book-isbn"
                  value={bookForm.isbn}
                  onChange={(event) => handleBookFormChange("isbn", event.target.value)}
                  placeholder="ISBN number"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="book-category">Category</Label>
                <Input
                  id="book-category"
                  value={bookForm.category}
                  onChange={(event) => handleBookFormChange("category", event.target.value)}
                  placeholder="e.g. Science"
                />
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2 md:gap-4">
              <div className="grid gap-2">
                <Label htmlFor="book-copies">Total Copies</Label>
                <Input
                  id="book-copies"
                  type="number"
                  min={1}
                  value={bookForm.copies}
                  onChange={(event) => handleBookFormChange("copies", event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="book-available">Available Copies</Label>
                <Input
                  id="book-available"
                  type="number"
                  min={0}
                  value={bookForm.available}
                  onChange={(event) => handleBookFormChange("available", event.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="book-shelf">Shelf Location</Label>
              <Input
                id="book-shelf"
                value={bookForm.shelfLocation}
                onChange={(event) => handleBookFormChange("shelfLocation", event.target.value)}
                placeholder="e.g. Aisle 3B"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="book-tags">Tags</Label>
              <Input
                id="book-tags"
                value={bookForm.tags}
                onChange={(event) => handleBookFormChange("tags", event.target.value)}
                placeholder="Comma separated keywords"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="book-description">Description</Label>
              <Textarea
                id="book-description"
                value={bookForm.description}
                onChange={(event) => handleBookFormChange("description", event.target.value)}
                placeholder="Short summary of the book"
                rows={4}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="book-cover">Cover Image URL</Label>
              <Input
                id="book-cover"
                value={bookForm.coverImage}
                onChange={(event) => handleBookFormChange("coverImage", event.target.value)}
                placeholder="Optional image link"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBookDialogOpen(false)
                resetBookForm()
              }}
              disabled={bookDialogLoading}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleSubmitBook()} disabled={bookDialogLoading}>
              {bookDialogLoading ? "Saving..." : editingBookId ? "Update Book" : "Add Book"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={bookDetailsOpen && Boolean(selectedBook)}
        onOpenChange={(open) => {
          setBookDetailsOpen(open)
          if (!open) {
            setSelectedBookId(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedBook?.title}</DialogTitle>
            <DialogDescription>
              Detailed information about this title, including borrowing status and catalog metadata.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <span className="text-gray-500">Author</span>
              <span className="font-medium">{selectedBook?.author}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-gray-500">ISBN</span>
              <span className="font-medium">{selectedBook?.isbn}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-gray-500">Category</span>
              <span className="font-medium">{selectedBook?.category}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="text-gray-500">Available</span>
              <span className="font-medium">
                {selectedBook?.available ?? 0}/{selectedBook?.copies ?? 0}
              </span>
            </div>
            {selectedBook?.shelfLocation && (
              <div className="grid grid-cols-2 gap-2">
                <span className="text-gray-500">Shelf</span>
                <span className="font-medium">{selectedBook.shelfLocation}</span>
              </div>
            )}
            {selectedBook?.tags && selectedBook.tags.length > 0 && (
              <div className="grid gap-2">
                <span className="text-gray-500">Tags</span>
                <div className="flex flex-wrap gap-2">
                  {selectedBook.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {selectedBook?.description && (
              <div className="grid gap-1">
                <span className="text-gray-500">Description</span>
                <p className="text-gray-700">{selectedBook.description}</p>
              </div>
            )}
          </div>
          <DialogFooter className="flex flex-col items-stretch gap-2 sm:flex-row sm:justify-between">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleOpenEditBook(selectedBook!)}>
                Edit Book
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleDeleteBook(selectedBook!.id)}
                disabled={deletingBookId === selectedBook?.id}
              >
                {deletingBookId === selectedBook?.id ? "Deleting..." : "Delete"}
              </Button>
            </div>
            <Button variant="outline" onClick={() => setBookDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
