import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { 
  Search, Plus, Phone, CreditCard, User, Banknote, Calendar,
  ShoppingCart, Eye, Loader2, Building, Mail, MapPin, ChevronDown, ChevronRight, Download, Package, Edit, Trash2, AlertTriangle, Users
} from 'lucide-react'
import toast from 'react-hot-toast'
import { 
  Button, Input, Card, CardContent, Badge,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription 
} from '@/components/ui'
import { customersService } from '@/services'
import api from '@/services/api'
import { formatMoney, formatPhone, formatInputNumber, cn } from '@/lib/utils'
import type { Customer, Sale, User as UserType } from '@/types'

interface CustomerFormData {
  name: string
  phone: string
  phone_secondary?: string
  telegram_id?: string
  company_name?: string
  email?: string
  address?: string
  customer_type: 'REGULAR' | 'VIP' | 'WHOLESALE'
  credit_limit?: number
  manager_id?: number  // Biriktirilgan kassir
}

interface PaymentFormData {
  amount: number
  payment_type: string
  description?: string
}

interface SaleItem {
  id: number
  product_name: string
  quantity: number
  uom_symbol: string
  unit_price: number
  total_price: number
  discount_amount: number
}

interface DebtRecord {
  id: number
  transaction_type: string
  amount: number
  balance_before: number
  balance_after: number
  reference_type: string
  description: string
  created_at: string
}

export default function CustomersPage() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('')
  const [filterSellerId, setFilterSellerId] = useState<number | ''>('')
  const [showDebtorsOnly, setShowDebtorsOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [expandedSaleId, setExpandedSaleId] = useState<number | null>(null)
  const [saleItems, setSaleItems] = useState<Record<number, SaleItem[]>>({})
  const [loadingSaleItems, setLoadingSaleItems] = useState<number | null>(null)

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<CustomerFormData>({
    defaultValues: { customer_type: 'REGULAR', credit_limit: 0 }
  })

  const { register: registerPayment, handleSubmit: handlePaymentSubmit, reset: resetPayment, setValue: setPaymentValue } = useForm<PaymentFormData>({
    defaultValues: { payment_type: 'CASH' }
  })

  // Fetch customers
  const { data: customersData, isLoading } = useQuery({
    queryKey: ['customers', searchQuery, filterType, filterSellerId, showDebtorsOnly, page],
    queryFn: () => customersService.getCustomers({
      q: searchQuery || undefined,
      customer_type: filterType || undefined,
      manager_id: filterSellerId || undefined,
      has_debt: showDebtorsOnly || undefined,
      page,
      per_page: 20,
    }),
  })

  // Fetch sellers (users who can be assigned to customers)
  const { data: sellersData } = useQuery({
    queryKey: ['sellers-list'],
    queryFn: async () => {
      const response = await api.get('/users?per_page=100')
      return response.data
    },
  })

  // Fetch debtors summary
  const { data: debtorsData } = useQuery({
    queryKey: ['debtors-summary'],
    queryFn: () => customersService.getDebtors(),
  })

  // Fetch customer sales
  const { data: customerSales, isLoading: loadingSales } = useQuery({
    queryKey: ['customer-sales', selectedCustomer?.id],
    queryFn: async () => {
      if (!selectedCustomer) return null
      const response = await api.get(`/sales?customer_id=${selectedCustomer.id}&per_page=100`)
      return response.data
    },
    enabled: !!selectedCustomer && showDetailDialog,
  })

  // Fetch customer debt history (with running balance)
  const { data: customerDebtHistory } = useQuery({
    queryKey: ['customer-debt-history', selectedCustomer?.id],
    queryFn: async () => {
      if (!selectedCustomer) return null
      const response = await api.get(`/customers/${selectedCustomer.id}/debt-history?per_page=100`)
      return response.data
    },
    enabled: !!selectedCustomer && showDetailDialog,
  })

  // Load sale items when expanding a row
  const loadSaleItems = async (saleId: number) => {
    if (saleItems[saleId]) {
      setExpandedSaleId(expandedSaleId === saleId ? null : saleId)
      return
    }
    
    setLoadingSaleItems(saleId)
    try {
      const response = await api.get(`/sales/${saleId}`)
      setSaleItems(prev => ({ ...prev, [saleId]: response.data.data.items }))
      setExpandedSaleId(saleId)
    } catch (error) {
      toast.error('Xatolik yuz berdi')
    } finally {
      setLoadingSaleItems(null)
    }
  }

  // Export debt history to Excel (XLSX)
  const exportPaymentsToExcel = async () => {
    if (!customerDebtHistory?.data || !selectedCustomer) return
    
    try {
      // Dynamically import xlsx library
      const XLSX = await import('xlsx')
      
      // Prepare data
      const data = customerDebtHistory.data.map((record: DebtRecord, index: number) => ({
        '№': index + 1,
        'Sana': new Date(record.created_at).toLocaleDateString('uz-UZ'),
        'Turi': record.transaction_type === 'SALE' || record.transaction_type === 'DEBT_INCREASE' ? 'Xarid' : 
          record.transaction_type === 'PAYMENT' || record.transaction_type === 'DEBT_PAYMENT' ? "To'lov" : record.transaction_type,
        'Summa': Math.abs(record.amount),
        'Qarz oldin': record.balance_before,
        'Qarz keyin': record.balance_after,
        'Izoh': record.description || ''
      }))
      
      // Create workbook and worksheet
      const wb = XLSX.utils.book_new()
      
      // Add header info
      const headerData = [
        ['MIJOZ QARZ VA TO\'LOVLAR TARIXI'],
        [''],
        ['Mijoz:', selectedCustomer.name],
        ['Telefon:', selectedCustomer.phone],
        ['Telegram:', selectedCustomer.telegram_id || '-'],
        ['Kompaniya:', selectedCustomer.company_name || '-'],
        ['Joriy qarz:', formatMoney(selectedCustomer.current_debt)],
        ['Hisobot sanasi:', new Date().toLocaleDateString('uz-UZ')],
        ['']
      ]
      
      const ws = XLSX.utils.aoa_to_sheet(headerData)
      
      // Add data table starting from row 9
      XLSX.utils.sheet_add_json(ws, data, { origin: 'A9' })
      
      // Set column widths
      ws['!cols'] = [
        { wch: 5 },   // №
        { wch: 12 },  // Sana
        { wch: 10 },  // Turi
        { wch: 18 },  // Summa
        { wch: 18 },  // Qarz oldin
        { wch: 18 },  // Qarz keyin
        { wch: 35 },  // Izoh
      ]
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Qarz tarixi')
      
      // Download
      XLSX.writeFile(wb, `${selectedCustomer.name.replace(/\s+/g, '_')}_qarz_tarixi.xlsx`)
      toast.success('Excel fayl yuklab olindi')
    } catch (error) {
      toast.error('Xatolik yuz berdi')
      console.error(error)
    }
  }

  // Export sales history to Excel (XLSX)
  const exportSalesToExcel = async () => {
    if (!customerSales?.data || !selectedCustomer) return
    
    try {
      const XLSX = await import('xlsx')
      
      // Prepare sales data
      const salesData = customerSales.data.map((sale: Sale, index: number) => ({
        '№': index + 1,
        'Sana': new Date(sale.created_at).toLocaleDateString('uz-UZ'),
        'Chek raqami': sale.sale_number,
        'Tovarlar soni': sale.items_count || '-',
        'Umumiy summa': sale.total_amount,
        'To\'langan': sale.paid_amount,
        'Qarz': sale.debt_amount,
        'Holat': sale.payment_status === 'PAID' ? 'To\'langan' :
                 sale.payment_status === 'DEBT' ? 'Qarzga' :
                 sale.payment_status === 'PARTIAL' ? 'Qisman' : sale.payment_status
      }))
      
      // Calculate totals
      const totalAmount = customerSales.data.reduce((sum: number, s: Sale) => sum + Number(s.total_amount), 0)
      const totalPaid = customerSales.data.reduce((sum: number, s: Sale) => sum + Number(s.paid_amount), 0)
      const totalDebt = customerSales.data.reduce((sum: number, s: Sale) => sum + Number(s.debt_amount), 0)
      
      const wb = XLSX.utils.book_new()
      
      // Header info
      const headerData = [
        ['MIJOZ SOTUVLAR TARIXI'],
        [''],
        ['Mijoz:', selectedCustomer.name],
        ['Telefon:', selectedCustomer.phone],
        ['Telegram:', selectedCustomer.telegram_id || '-'],
        ['Kompaniya:', selectedCustomer.company_name || '-'],
        ['Jami xaridlar:', customerSales.data.length + ' ta'],
        ['Hisobot sanasi:', new Date().toLocaleDateString('uz-UZ')],
        ['']
      ]
      
      const ws = XLSX.utils.aoa_to_sheet(headerData)
      XLSX.utils.sheet_add_json(ws, salesData, { origin: 'A9' })
      
      // Add totals row
      const lastRow = 9 + salesData.length + 1
      XLSX.utils.sheet_add_aoa(ws, [
        ['', '', '', 'JAMI:', totalAmount, totalPaid, totalDebt, '']
      ], { origin: `A${lastRow}` })
      
      // Set column widths
      ws['!cols'] = [
        { wch: 5 },   // №
        { wch: 12 },  // Sana
        { wch: 20 },  // Chek raqami
        { wch: 12 },  // Tovarlar soni
        { wch: 18 },  // Umumiy summa
        { wch: 18 },  // To'langan
        { wch: 18 },  // Qarz
        { wch: 12 },  // Holat
      ]
      
      XLSX.utils.book_append_sheet(wb, ws, 'Sotuvlar tarixi')
      XLSX.writeFile(wb, `${selectedCustomer.name.replace(/\s+/g, '_')}_sotuvlar_tarixi.xlsx`)
      toast.success('Excel fayl yuklab olindi')
    } catch (error) {
      toast.error('Xatolik yuz berdi')
      console.error(error)
    }
  }

  // Fetch customer payments (keeping for backward compatibility)
  const { data: customerPayments } = useQuery({
    queryKey: ['customer-payments', selectedCustomer?.id],
    queryFn: async () => {
      if (!selectedCustomer) return null
      const response = await api.get(`/customers/${selectedCustomer.id}/payments`)
      return response.data
    },
    enabled: !!selectedCustomer && showDetailDialog,
  })

  // Create customer mutation
  const createCustomer = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      // Filter out empty strings - backend expects null, not empty string
      const cleanData: any = {}
      Object.entries(data).forEach(([key, value]) => {
        if (value !== '' && value !== undefined && value !== null) {
          cleanData[key] = value
        }
      })
      const response = await api.post('/customers', cleanData)
      return response.data
    },
    onSuccess: () => {
      toast.success('Mijoz muvaffaqiyatli qo\'shildi!')
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      setShowAddDialog(false)
      reset()
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail
      // Handle validation errors (array of objects)
      if (Array.isArray(detail)) {
        const messages = detail.map((e: any) => {
          if (typeof e === 'string') return e
          if (typeof e.msg === 'string') return e.msg
          return 'Validatsiya xatosi'
        })
        toast.error(messages.join(', '))
      } else if (typeof detail === 'string') {
        toast.error(detail)
      } else {
        toast.error('Xatolik yuz berdi')
      }
    },
  })

  // Update customer mutation
  const updateCustomer = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      if (!editingCustomer) return
      const cleanData: any = {}
      Object.entries(data).forEach(([key, value]) => {
        if (value !== '' && value !== undefined && value !== null) {
          cleanData[key] = value
        }
      })
      const response = await api.patch(`/customers/${editingCustomer.id}`, cleanData)
      return response.data
    },
    onSuccess: () => {
      toast.success('Mijoz muvaffaqiyatli yangilandi!')
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['debtors-summary'] })
      setShowAddDialog(false)
      setEditingCustomer(null)
      reset()
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail
      if (Array.isArray(detail)) {
        const messages = detail.map((e: any) => typeof e.msg === 'string' ? e.msg : 'Xatolik')
        toast.error(messages.join(', '))
      } else {
        toast.error(typeof detail === 'string' ? detail : 'Xatolik yuz berdi')
      }
    },
  })

  // Delete customer mutation
  const deleteCustomer = useMutation({
    mutationFn: async (customerId: number) => {
      const response = await api.delete(`/customers/${customerId}`)
      return response.data
    },
    onSuccess: () => {
      toast.success('Mijoz o\'chirildi!')
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['debtors-summary'] })
      setShowDeleteConfirm(false)
      setSelectedCustomer(null)
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Mijozni o\'chirib bo\'lmadi')
    },
  })

  // Pay debt mutation
  const payDebt = useMutation({
    mutationFn: async (data: PaymentFormData) => {
      if (!selectedCustomer) return
      const response = await api.post(`/customers/${selectedCustomer.id}/pay-debt`, data)
      return response.data
    },
    onSuccess: (data) => {
      toast.success(`To'lov qabul qilindi! Qolgan qarz: ${formatMoney(data.current_debt)}`)
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['debtors-summary'] })
      queryClient.invalidateQueries({ queryKey: ['customer-payments'] })
      setShowPaymentDialog(false)
      resetPayment()
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail
      if (Array.isArray(detail)) {
        const messages = detail.map((e: any) => typeof e.msg === 'string' ? e.msg : 'Xatolik')
        toast.error(messages.join(', '))
      } else {
        toast.error(typeof detail === 'string' ? detail : 'Xatolik yuz berdi')
      }
    },
  })

  const onSubmit = (data: CustomerFormData) => {
    if (editingCustomer) {
      updateCustomer.mutate(data)
    } else {
      createCustomer.mutate(data)
    }
  }
  const onPaymentSubmit = (data: PaymentFormData) => payDebt.mutate(data)

  const handlePayClick = (customer: Customer) => {
    setSelectedCustomer(customer)
    setPaymentValue('amount', customer.current_debt)
    setShowPaymentDialog(true)
  }

  const handleEditClick = (customer: Customer) => {
    setEditingCustomer(customer)
    setValue('name', customer.name)
    setValue('phone', customer.phone)
    setValue('phone_secondary', customer.phone_secondary || '')
    setValue('telegram_id', customer.telegram_id || '')
    setValue('company_name', customer.company_name || '')
    setValue('email', customer.email || '')
    setValue('address', customer.address || '')
    setValue('customer_type', customer.customer_type)
    setValue('credit_limit', customer.credit_limit || 0)
    setValue('manager_id', customer.manager_id || undefined)
    setShowAddDialog(true)
  }

  const handleDeleteClick = (customer: Customer) => {
    setSelectedCustomer(customer)
    setShowDeleteConfirm(true)
  }

  const handleDetailClick = (customer: Customer) => {
    setSelectedCustomer(customer)
    setShowDetailDialog(true)
  }

  const getTypeBadge = (type: string) => {
    const normalizedType = type?.toUpperCase() || 'REGULAR'
    const badges: Record<string, { variant: 'warning' | 'primary' | 'secondary', label: string }> = {
      'VIP': { variant: 'warning', label: 'VIP' },
      'WHOLESALE': { variant: 'primary', label: 'Ulgurji' },
      'REGULAR': { variant: 'secondary', label: 'Oddiy' },
    }
    const b = badges[normalizedType] || badges.REGULAR
    return <Badge variant={b.variant}>{b.label}</Badge>
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 lg:gap-4">
        <h1 className="text-xl lg:text-pos-xl font-bold">Mijozlar</h1>
        <Button size="lg" onClick={() => setShowAddDialog(true)} className="w-full sm:w-auto">
          <Plus className="w-5 h-5 mr-2" />
          Yangi mijoz
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2 lg:gap-4">
        <Card>
          <CardContent className="p-2.5 lg:p-4 flex flex-col lg:flex-row items-center gap-2 lg:gap-4">
            <div className="p-2 lg:p-3 bg-primary/10 rounded-xl">
              <User className="w-4 h-4 lg:w-6 lg:h-6 text-primary" />
            </div>
            <div className="text-center lg:text-left">
              <p className="text-xs lg:text-sm text-text-secondary">Mijozlar</p>
              <p className="text-sm lg:text-pos-lg font-bold">{customersData?.total || 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-2.5 lg:p-4 flex flex-col lg:flex-row items-center gap-2 lg:gap-4">
            <div className="p-2 lg:p-3 bg-danger/10 rounded-xl">
              <CreditCard className="w-4 h-4 lg:w-6 lg:h-6 text-danger" />
            </div>
            <div className="text-center lg:text-left">
              <p className="text-xs lg:text-sm text-text-secondary">Qarzdorlar</p>
              <p className="text-sm lg:text-pos-lg font-bold">{debtorsData?.data?.length || 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-2.5 lg:p-4 flex flex-col lg:flex-row items-center gap-2 lg:gap-4">
            <div className="p-2 lg:p-3 bg-warning/10 rounded-xl">
              <Banknote className="w-4 h-4 lg:w-6 lg:h-6 text-warning" />
            </div>
            <div className="text-center lg:text-left">
              <p className="text-xs lg:text-sm text-text-secondary">Jami qarz</p>
              <p className="text-xs lg:text-pos-lg font-bold text-danger truncate">{formatMoney(debtorsData?.total_debt || 0)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 lg:p-4">
          <div className="flex flex-col sm:flex-row gap-2 lg:gap-4 items-stretch sm:items-center">
            <div className="flex-1">
              <Input
                icon={<Search className="w-4 h-4 lg:w-5 lg:h-5" />}
                placeholder="Mijoz qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-sm lg:text-base"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                className="flex-1 sm:flex-none min-h-[44px] lg:min-h-btn px-3 lg:px-4 py-2 lg:py-3 border-2 border-border rounded-xl text-sm lg:text-pos-base"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="">Barcha</option>
                <option value="REGULAR">Oddiy</option>
                <option value="VIP">VIP</option>
                <option value="WHOLESALE">Ulgurji</option>
              </select>
              <select
                className="flex-1 sm:flex-none min-h-[44px] lg:min-h-btn px-3 lg:px-4 py-2 lg:py-3 border-2 border-border rounded-xl text-sm lg:text-pos-base"
                value={filterSellerId}
                onChange={(e) => setFilterSellerId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Barcha kassirlar</option>
                {sellersData?.data?.map((seller: UserType) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.first_name} {seller.last_name}
                  </option>
                ))}
              </select>
              <Button
                variant={showDebtorsOnly ? 'danger' : 'outline'}
                onClick={() => setShowDebtorsOnly(!showDebtorsOnly)}
                className="text-sm lg:text-base"
              >
                <CreditCard className="w-4 h-4 lg:w-5 lg:h-5 lg:mr-2" />
                <span className="hidden lg:inline">Faqat qarzdorlar</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customers List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-3">
          {customersData?.data?.map((customer: Customer) => (
            <Card key={customer.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="p-3 bg-primary/10 rounded-full">
                      <User className="w-6 h-6 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-pos-base">{customer.name}</p>
                        {getTypeBadge(customer.customer_type)}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-text-secondary">
                        <span className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          {formatPhone(customer.phone)}
                        </span>
                        {customer.company_name && (
                          <span className="flex items-center gap-1">
                            <Building className="w-4 h-4" />
                            {customer.company_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-center hidden md:block">
                      <p className="text-xs text-text-secondary">Jami xarid</p>
                      <p className="font-semibold text-primary">{formatMoney(customer.total_purchases)}</p>
                    </div>

                    {customer.current_debt > 0 && (
                      <div className="text-center">
                        <p className="text-xs text-text-secondary">Qarz</p>
                        <p className="font-bold text-danger">{formatMoney(customer.current_debt)}</p>
                      </div>
                    )}

                    {customer.advance_balance > 0 && (
                      <div className="text-center">
                        <p className="text-xs text-text-secondary">Avans</p>
                        <p className="font-bold text-success">{formatMoney(customer.advance_balance)}</p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {customer.current_debt > 0 && (
                        <Button variant="success" size="sm" onClick={() => handlePayClick(customer)}>
                          <Banknote className="w-4 h-4 mr-1" />
                          To'lov
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => handleEditClick(customer)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDetailClick(customer)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleDeleteClick(customer)}
                        className="text-danger hover:bg-danger hover:text-white"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {customersData?.data?.length === 0 && (
            <div className="text-center py-12">
              <User className="w-16 h-16 mx-auto text-text-secondary opacity-50 mb-4" />
              <p className="text-text-secondary">Mijozlar topilmadi</p>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {customersData && customersData.total > 20 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Oldingi</Button>
          <span className="px-4">{page} / {Math.ceil(customersData.total / 20)}</span>
          <Button variant="outline" disabled={page >= Math.ceil(customersData.total / 20)} onClick={() => setPage(page + 1)}>Keyingi</Button>
        </div>
      )}

      {/* Add/Edit Customer Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => {
        setShowAddDialog(open)
        if (!open) {
          setEditingCustomer(null)
          reset()
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? 'Mijozni tahrirlash' : 'Yangi mijoz qo\'shish'}</DialogTitle>
            <DialogDescription>Mijoz ma'lumotlarini kiriting</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <label className="font-medium">Mijoz ismi *</label>
              <Input {...register('name', { required: 'Ism kiritilishi shart' })} placeholder="To'liq ism" />
              {errors.name && <p className="text-danger text-sm">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="font-medium">Telefon *</label>
                <Input {...register('phone', { required: 'Telefon kiritilishi shart' })} placeholder="+998 90 123 45 67" />
              </div>
              <div className="space-y-2">
                <label className="font-medium">Qo'shimcha telefon</label>
                <Input {...register('phone_secondary')} placeholder="+998 90 123 45 67" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="font-medium">Telegram ID</label>
                <Input {...register('telegram_id')} placeholder="@username yoki 123456789" />
              </div>
              <div className="space-y-2">
                <label className="font-medium">Email</label>
                <Input {...register('email')} type="email" placeholder="email@example.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="font-medium">Kompaniya</label>
                <Input {...register('company_name')} placeholder="Kompaniya nomi" />
              </div>
              <div className="space-y-2">
                <label className="font-medium">Manzil</label>
                <Input {...register('address')} placeholder="To'liq manzil" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="font-medium">Mijoz turi</label>
                <select {...register('customer_type')} className="w-full min-h-btn px-4 py-3 border-2 border-border rounded-pos">
                  <option value="REGULAR">Oddiy</option>
                  <option value="VIP">VIP</option>
                  <option value="WHOLESALE">Ulgurji</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="font-medium">Kredit limiti</label>
                <Input type="number" {...register('credit_limit', { valueAsNumber: true })} placeholder="0" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="font-medium flex items-center gap-2">
                <Users className="w-4 h-4" />
                Biriktirilgan kassir
              </label>
              <select {...register('manager_id', { valueAsNumber: true })} className="w-full min-h-btn px-4 py-3 border-2 border-border rounded-pos">
                <option value="">Tanlanmagan</option>
                {sellersData?.data?.map((seller: UserType) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.first_name} {seller.last_name}
                  </option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setShowAddDialog(false)
                setEditingCustomer(null)
                reset()
              }}>
                Bekor qilish
              </Button>
              <Button type="submit" disabled={createCustomer.isPending || updateCustomer.isPending}>
                {(createCustomer.isPending || updateCustomer.isPending) ? 'Saqlanmoqda...' : 'Saqlash'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-danger">
              <AlertTriangle className="w-5 h-5" />
              Mijozni o'chirish
            </DialogTitle>
            <DialogDescription>
              Haqiqatan ham <strong>{selectedCustomer?.name}</strong> ni o'chirmoqchimisiz?
              {selectedCustomer && selectedCustomer.current_debt > 0 && (
                <span className="block mt-2 text-danger">
                  Diqqat: Bu mijozda {formatMoney(selectedCustomer.current_debt)} qarz mavjud!
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Bekor qilish
            </Button>
            <Button 
              variant="danger" 
              onClick={() => selectedCustomer && deleteCustomer.mutate(selectedCustomer.id)}
              disabled={deleteCustomer.isPending}
            >
              {deleteCustomer.isPending ? 'O\'chirilmoqda...' : 'O\'chirish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="pr-6">To'lov qabul qilish</DialogTitle>
          </DialogHeader>

          {selectedCustomer && (
            <div className="bg-gradient-to-r from-red-50 to-orange-50 p-3 rounded-lg mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-full">
                  <User className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{selectedCustomer.name}</p>
                  <p className="text-xs text-gray-500">{formatPhone(selectedCustomer.phone)}</p>
                </div>
              </div>
              <div className="mt-2 p-2 bg-white rounded-lg text-center">
                <p className="text-xs text-gray-500">Joriy qarz:</p>
                <p className="text-lg font-bold text-red-600">{formatMoney(selectedCustomer.current_debt)}</p>
              </div>
            </div>
          )}

          <form onSubmit={handlePaymentSubmit(onPaymentSubmit)} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">To'lov summasi *</label>
              <input
                type="text"
                inputMode="numeric"
                {...registerPayment('amount', { required: true, valueAsNumber: true })}
                placeholder="Summa kiriting"
                className="w-full h-11 px-3 text-base font-bold text-center border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">To'lov turi</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'CASH', label: 'Naqd', icon: Banknote },
                  { value: 'CARD', label: 'Karta', icon: CreditCard },
                  { value: 'TRANSFER', label: "O'tkazma", icon: Building },
                ].map((pt) => (
                  <label key={pt.value} className="cursor-pointer">
                    <input type="radio" {...registerPayment('payment_type')} value={pt.value} className="sr-only peer" />
                    <div className="flex flex-col items-center gap-1 p-2 border-2 border-gray-200 rounded-lg peer-checked:border-blue-500 peer-checked:bg-blue-50 transition-colors">
                      <pt.icon className="w-4 h-4" />
                      <span className="text-xs">{pt.label}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Izoh</label>
              <Input {...registerPayment('description')} placeholder="Ixtiyoriy izoh" className="text-sm" />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPaymentDialog(false)}
                className="flex-1 h-10 border-2 border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={payDebt.isPending}
                className="flex-1 h-10 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              >
                {payDebt.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
                Qabul qilish
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Customer Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mijoz ma'lumotlari</DialogTitle>
            <DialogDescription>To'liq tarix va statistika</DialogDescription>
          </DialogHeader>

          {selectedCustomer && (
            <div className="space-y-6">
              {/* Customer Info Header */}
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 rounded-pos">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-white rounded-full shadow-sm">
                      <User className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-pos-lg font-bold">{selectedCustomer.name}</h3>
                        {getTypeBadge(selectedCustomer.customer_type)}
                      </div>
                      <div className="flex flex-wrap gap-4 mt-2 text-sm text-text-secondary">
                        <span className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          {formatPhone(selectedCustomer.phone)}
                        </span>
                        {selectedCustomer.company_name && (
                          <span className="flex items-center gap-1">
                            <Building className="w-4 h-4" />
                            {selectedCustomer.company_name}
                          </span>
                        )}
                        {selectedCustomer.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-4 h-4" />
                            {selectedCustomer.email}
                          </span>
                        )}
                        {selectedCustomer.telegram_id && (
                          <span className="flex items-center gap-1">
                            <span className="w-4 h-4 text-blue-500 font-bold text-xs">TG</span>
                            {selectedCustomer.telegram_id}
                          </span>
                        )}
                        {selectedCustomer.address && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {selectedCustomer.address}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {selectedCustomer.current_debt > 0 && (
                    <Button variant="success" onClick={() => {
                      setShowDetailDialog(false)
                      setTimeout(() => handlePayClick(selectedCustomer), 100)
                    }}>
                      <Banknote className="w-4 h-4 mr-2" />
                      To'lov qabul qilish
                    </Button>
                  )}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-text-secondary">Jami xarid</p>
                    <p className="text-pos-lg font-bold text-primary">{formatMoney(selectedCustomer.total_purchases)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-text-secondary">Joriy qarz</p>
                    <p className={cn("text-pos-lg font-bold", selectedCustomer.current_debt > 0 ? "text-danger" : "text-success")}>
                      {formatMoney(selectedCustomer.current_debt)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-text-secondary">Avans</p>
                    <p className="text-pos-lg font-bold text-success">{formatMoney(selectedCustomer.advance_balance)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-text-secondary">Kredit limiti</p>
                    <p className="text-pos-lg font-bold">{formatMoney(selectedCustomer.credit_limit)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Sales History */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" />
                    Sotuvlar tarixi ({customerSales?.data?.length || 0} ta)
                  </h4>
                  {customerSales?.data && customerSales.data.length > 0 && (
                    <Button variant="outline" size="sm" onClick={exportSalesToExcel}>
                      <Download className="w-4 h-4 mr-2" />
                      Excel
                    </Button>
                  )}
                </div>
                {loadingSales ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : customerSales?.data && customerSales.data.length > 0 ? (
                  <div className="border border-border rounded-pos overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="w-10"></th>
                          <th className="px-4 py-3 text-left text-sm font-medium">Sana</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">Chek №</th>
                          <th className="px-4 py-3 text-center text-sm font-medium">Tovarlar</th>
                          <th className="px-4 py-3 text-right text-sm font-medium">Summa</th>
                          <th className="px-4 py-3 text-right text-sm font-medium">To'langan</th>
                          <th className="px-4 py-3 text-right text-sm font-medium">Qarz</th>
                          <th className="px-4 py-3 text-center text-sm font-medium">Holat</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {customerSales.data.map((sale: Sale) => (
                          <React.Fragment key={sale.id}>
                            <tr 
                              className="hover:bg-gray-50 cursor-pointer"
                              onClick={() => loadSaleItems(sale.id)}
                            >
                              <td className="px-2 py-3 text-center">
                                {loadingSaleItems === sale.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                                ) : expandedSaleId === sale.id ? (
                                  <ChevronDown className="w-4 h-4 mx-auto text-blue-600" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 mx-auto text-gray-400" />
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4 text-text-secondary" />
                                  {new Date(sale.created_at).toLocaleDateString('uz-UZ')}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm font-medium">{sale.sale_number}</td>
                              <td className="px-4 py-3 text-sm text-center">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs">
                                  <Package className="w-3 h-3" />
                                  {sale.items_count || '?'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-right font-semibold">{formatMoney(sale.total_amount)}</td>
                              <td className="px-4 py-3 text-sm text-right text-success">{formatMoney(sale.paid_amount)}</td>
                              <td className="px-4 py-3 text-sm text-right text-danger">
                                {sale.debt_amount > 0 ? formatMoney(sale.debt_amount) : '-'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <Badge variant={
                                  sale.payment_status === 'PAID' ? 'success' :
                                  sale.payment_status === 'DEBT' ? 'danger' :
                                  sale.payment_status === 'PARTIAL' ? 'warning' : 'secondary'
                                }>
                                  {sale.payment_status === 'PAID' ? 'To\'langan' :
                                   sale.payment_status === 'DEBT' ? 'Qarzga' :
                                   sale.payment_status === 'PARTIAL' ? 'Qisman' : sale.payment_status}
                                </Badge>
                              </td>
                            </tr>
                            {/* Expanded items */}
                            {expandedSaleId === sale.id && saleItems[sale.id] && (
                              <tr key={`${sale.id}-items`}>
                                <td colSpan={8} className="p-0">
                                  <div className="bg-blue-50 p-4 border-t border-blue-200">
                                    <h5 className="font-medium text-sm mb-2 text-blue-800">Tovarlar ro'yxati:</h5>
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="text-gray-600">
                                          <th className="text-left py-1 px-2">Tovar</th>
                                          <th className="text-center py-1 px-2">Miqdor</th>
                                          <th className="text-right py-1 px-2">Narx</th>
                                          <th className="text-right py-1 px-2">Chegirma</th>
                                          <th className="text-right py-1 px-2">Jami</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {saleItems[sale.id].map((item: SaleItem) => (
                                          <tr key={item.id} className="border-t border-blue-200">
                                            <td className="py-2 px-2 font-medium">{item.product_name}</td>
                                            <td className="py-2 px-2 text-center">{item.quantity} {item.uom_symbol}</td>
                                            <td className="py-2 px-2 text-right">{formatMoney(item.unit_price)}</td>
                                            <td className="py-2 px-2 text-right text-orange-600">
                                              {item.discount_amount > 0 ? `-${formatMoney(item.discount_amount)}` : '-'}
                                            </td>
                                            <td className="py-2 px-2 text-right font-semibold">{formatMoney(item.total_price)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-text-secondary bg-gray-50 rounded-pos">
                    <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Sotuvlar topilmadi</p>
                  </div>
                )}
              </div>

              {/* Payment/Debt History with Running Balance */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Banknote className="w-5 h-5" />
                    Qarz va to'lovlar tarixi ({customerDebtHistory?.data?.length || 0} ta)
                  </h4>
                  {customerDebtHistory?.data && customerDebtHistory.data.length > 0 && (
                    <Button variant="outline" size="sm" onClick={exportPaymentsToExcel}>
                      <Download className="w-4 h-4 mr-2" />
                      Excel
                    </Button>
                  )}
                </div>
                {customerDebtHistory?.data && customerDebtHistory.data.length > 0 ? (
                  <div className="border border-border rounded-pos overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium">Sana</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">Turi</th>
                          <th className="px-4 py-3 text-right text-sm font-medium">Summa</th>
                          <th className="px-4 py-3 text-right text-sm font-medium">Qarz oldin</th>
                          <th className="px-4 py-3 text-right text-sm font-medium">Qarz keyin</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">Izoh</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {customerDebtHistory.data.map((record: DebtRecord) => {
                          const isPayment = record.transaction_type === 'PAYMENT' || record.transaction_type === 'DEBT_PAYMENT'
                          const isSale = record.transaction_type === 'SALE'
                          
                          return (
                            <tr key={record.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm">
                                {new Date(record.created_at).toLocaleDateString('uz-UZ')}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <Badge variant={isPayment ? 'success' : isSale ? 'warning' : 'secondary'}>
                                  {isPayment ? "To'lov" : isSale ? 'Xarid' : record.transaction_type}
                                </Badge>
                              </td>
                              <td className={cn(
                                "px-4 py-3 text-sm text-right font-semibold",
                                isPayment ? "text-green-600" : "text-red-600"
                              )}>
                                {isPayment ? '-' : '+'}{formatMoney(Math.abs(record.amount))}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-gray-500">
                                {formatMoney(record.balance_before)}
                              </td>
                              <td className={cn(
                                "px-4 py-3 text-sm text-right font-semibold",
                                record.balance_after > 0 ? "text-red-600" : "text-green-600"
                              )}>
                                {formatMoney(record.balance_after)}
                              </td>
                              <td className="px-4 py-3 text-sm text-text-secondary max-w-xs truncate">
                                {record.description || '-'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-text-secondary bg-gray-50 rounded-pos">
                    <Banknote className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Tarix topilmadi</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
