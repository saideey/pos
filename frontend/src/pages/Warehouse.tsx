import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import { 
  Search, Plus, Package, Warehouse as WarehouseIcon, AlertTriangle, 
  TrendingUp, Trash2, Calendar, DollarSign, History, Loader2, Filter, Download,
  Pencil, X, Info
} from 'lucide-react'
import toast from 'react-hot-toast'
import { 
  Button, Input, Card, CardContent, Badge,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription 
} from '@/components/ui'
import { warehouseService, productsService } from '@/services'
import api from '@/services/api'
import { formatMoney, formatNumber, cn, formatDateTashkent, formatTimeTashkent } from '@/lib/utils'
import { useAuthStore } from '@/stores'
import type { Stock, Warehouse, Product } from '@/types'

interface IncomeItem {
  product_id: number
  quantity: number
  uom_id: number
  unit_price_usd: number // Dollarda narx
}

interface IncomeFormData {
  warehouse_id: number
  document_number?: string
  supplier_name?: string
  notes?: string
  items: IncomeItem[]
}

interface MovementEditData {
  id: number
  product_name: string
  quantity: number
  unit_price: number
  unit_price_usd: number | null
  document_number: string
  supplier_name: string
  notes: string
}

type MovementFilter = 'all' | 'income' | 'outcome'

export default function WarehousePage() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const isDirector = user?.role_type === 'director'
  
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [showLowOnly, setShowLowOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [showIncomeDialog, setShowIncomeDialog] = useState(false)
  const [activeTab, setActiveTab] = useState<'stock' | 'history'>('stock')
  
  // History filters
  const [movementFilter, setMovementFilter] = useState<MovementFilter>('all')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)
  
  // Edit/Delete state
  const [editingMovement, setEditingMovement] = useState<MovementEditData | null>(null)
  const [deletingMovement, setDeletingMovement] = useState<{id: number, name: string} | null>(null)
  const [deleteReason, setDeleteReason] = useState('')

  const { register, control, handleSubmit, reset, watch } = useForm<IncomeFormData>({
    defaultValues: {
      warehouse_id: 1,
      items: [{ product_id: 0, quantity: 1, uom_id: 1, unit_price_usd: 0 }]
    }
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  // Fetch exchange rate
  const { data: exchangeRateData } = useQuery({
    queryKey: ['exchange-rate'],
    queryFn: async () => {
      const response = await api.get('/settings/exchange-rate')
      return response.data
    },
  })
  const usdRate = exchangeRateData?.usd_rate || 12800

  // Fetch warehouses
  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehouseService.getWarehouses(),
  })

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: productsService.getCategories,
  })

  // Fetch products for income form
  const { data: productsForSelect, isLoading: productsLoading } = useQuery({
    queryKey: ['products-for-select'],
    queryFn: async () => {
      const result = await productsService.getProducts({ per_page: 500 })
      return result
    },
  })
  
  // Safe products array
  const productsList = productsForSelect?.data || []

  // Fetch UOMs
  const { data: uomsResponse } = useQuery({
    queryKey: ['uoms'],
    queryFn: productsService.getUOMs,
  })
  const uoms = Array.isArray(uomsResponse) ? uomsResponse : []

  // Fetch stock
  const { data: stockData, isLoading } = useQuery({
    queryKey: ['stock', searchQuery, selectedWarehouse, selectedCategory, showLowOnly, page],
    queryFn: () => warehouseService.getStock({
      search: searchQuery || undefined,
      warehouse_id: selectedWarehouse || undefined,
      category_id: selectedCategory || undefined,
      below_minimum: showLowOnly || undefined,
      page,
      per_page: 20,
    }),
  })

  // Fetch stock movements (transaction history)
  const { data: movementsData, isLoading: loadingMovements } = useQuery({
    queryKey: ['stock-movements', selectedWarehouse, movementFilter, startDate, endDate, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedWarehouse) params.append('warehouse_id', selectedWarehouse.toString())
      
      // Movement type filter
      if (movementFilter === 'income') {
        params.append('movement_type', 'purchase')
      } else if (movementFilter === 'outcome') {
        params.append('movement_type', 'sale')
      }
      
      // Date filters
      if (startDate) params.append('start_date', startDate)
      if (endDate) params.append('end_date', endDate)
      
      params.append('page', page.toString())
      params.append('per_page', '30')
      const response = await api.get(`/warehouse/movements?${params}`)
      return response.data
    },
    enabled: activeTab === 'history',
  })

  // Fetch low stock count
  const { data: lowStock } = useQuery({
    queryKey: ['low-stock'],
    queryFn: () => warehouseService.getLowStock(),
  })

  // Stock income mutation
  const stockIncome = useMutation({
    mutationFn: async (data: IncomeFormData) => {
      // Convert USD prices to UZS
      const itemsWithUzs = data.items
        .filter(item => item.product_id > 0 && item.quantity > 0)
        .map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          uom_id: item.uom_id,
          unit_price: item.unit_price_usd * usdRate, // Convert to UZS
          unit_price_usd: item.unit_price_usd,
          exchange_rate: usdRate
        }))
      
      const response = await api.post('/warehouse/income', {
        ...data,
        items: itemsWithUzs,
        exchange_rate: usdRate
      })
      return response.data
    },
    onSuccess: () => {
      toast.success('Kirim muvaffaqiyatli amalga oshirildi!')
      queryClient.invalidateQueries({ queryKey: ['stock'] })
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
      queryClient.invalidateQueries({ queryKey: ['low-stock'] })
      setShowIncomeDialog(false)
      reset()
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail
      if (Array.isArray(detail)) {
        toast.error(detail.map((e: any) => e.msg).join(', ') || 'Validatsiya xatosi')
      } else {
        toast.error(typeof detail === 'string' ? detail : 'Xatolik yuz berdi')
      }
    },
  })

  // Edit movement mutation (Director only)
  const editMovement = useMutation({
    mutationFn: async (data: { id: number, quantity?: number, unit_price?: number, unit_price_usd?: number, document_number?: string, supplier_name?: string, notes?: string }) => {
      const params = new URLSearchParams()
      if (data.quantity !== undefined) params.append('quantity', data.quantity.toString())
      if (data.unit_price !== undefined) params.append('unit_price', data.unit_price.toString())
      if (data.unit_price_usd !== undefined) params.append('unit_price_usd', data.unit_price_usd.toString())
      if (data.document_number !== undefined) params.append('document_number', data.document_number)
      if (data.supplier_name !== undefined) params.append('supplier_name', data.supplier_name)
      if (data.notes !== undefined) params.append('notes', data.notes)
      
      const response = await api.put(`/warehouse/movements/${data.id}?${params}`)
      return response.data
    },
    onSuccess: () => {
      toast.success('Harakat muvaffaqiyatli tahrirlandi!')
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
      queryClient.invalidateQueries({ queryKey: ['stock'] })
      setEditingMovement(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Tahrirlashda xatolik')
    }
  })

  // Delete movement mutation (Director only)
  const deleteMovement = useMutation({
    mutationFn: async ({ id, reason }: { id: number, reason: string }) => {
      const response = await api.delete(`/warehouse/movements/${id}?reason=${encodeURIComponent(reason)}`)
      return response.data
    },
    onSuccess: () => {
      toast.success('Harakat o\'chirildi!')
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
      queryClient.invalidateQueries({ queryKey: ['stock'] })
      setDeletingMovement(null)
      setDeleteReason('')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'O\'chirishda xatolik')
    }
  })

  const onSubmit = (data: IncomeFormData) => {
    const validItems = data.items.filter(item => item.product_id > 0 && item.quantity > 0)
    if (validItems.length === 0) {
      toast.error('Kamida bitta tovar qo\'shing')
      return
    }
    stockIncome.mutate(data)
  }

  // Calculate total for income form (in USD)
  const watchItems = watch('items')
  const incomeTotalUsd = watchItems?.reduce((sum, item) => {
    return sum + (item.quantity || 0) * (item.unit_price_usd || 0)
  }, 0) || 0
  const incomeTotalUzs = incomeTotalUsd * usdRate

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 lg:gap-4">
        <h1 className="text-xl lg:text-pos-xl font-bold">Ombor</h1>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="flex items-center justify-center gap-2 px-3 lg:px-4 py-2 bg-primary/10 rounded-xl text-sm lg:text-base">
            <DollarSign className="w-4 h-4 lg:w-5 lg:h-5 text-primary" />
            <span className="font-semibold">1$ = {formatNumber(usdRate)} so'm</span>
          </div>
          <Button size="lg" variant="success" onClick={() => setShowIncomeDialog(true)} className="w-full sm:w-auto text-sm lg:text-base">
            <TrendingUp className="w-4 h-4 lg:w-5 lg:h-5 mr-2" />
            Kirim qilish (USD)
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
        {warehouses?.map((wh: Warehouse) => (
          <Card
            key={wh.id}
            className={cn('cursor-pointer transition-all', selectedWarehouse === wh.id && 'ring-2 ring-primary')}
            onClick={() => setSelectedWarehouse(selectedWarehouse === wh.id ? null : wh.id)}
          >
            <CardContent className="p-2.5 lg:p-4 flex flex-col lg:flex-row items-center gap-2 lg:gap-4">
              <div className="p-2 lg:p-3 bg-primary/10 rounded-xl">
                <WarehouseIcon className="w-5 h-5 lg:w-6 lg:h-6 text-primary" />
              </div>
              <div className="text-center lg:text-left">
                <p className="font-semibold text-sm lg:text-base">{wh.name}</p>
                <p className="text-xs lg:text-sm text-text-secondary truncate">{formatMoney(wh.total_value || 0)}</p>
              </div>
            </CardContent>
          </Card>
        ))}

        <Card
          className={cn('cursor-pointer transition-all border-warning', showLowOnly && 'ring-2 ring-warning')}
          onClick={() => setShowLowOnly(!showLowOnly)}
        >
          <CardContent className="p-2.5 lg:p-4 flex flex-col lg:flex-row items-center gap-2 lg:gap-4">
            <div className="p-2 lg:p-3 bg-warning/10 rounded-xl">
              <AlertTriangle className="w-5 h-5 lg:w-6 lg:h-6 text-warning" />
            </div>
            <div className="text-center lg:text-left">
              <p className="font-semibold text-sm lg:text-base">Kam qoldiq</p>
              <p className="text-xs lg:text-sm text-danger font-bold">{lowStock?.data?.length || 0} ta tovar</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 lg:gap-2 border-b border-border overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('stock')}
          className={cn(
            'px-4 lg:px-6 py-2.5 lg:py-3 font-medium border-b-2 transition-colors whitespace-nowrap text-sm lg:text-base',
            activeTab === 'stock' ? 'border-primary text-primary' : 'border-transparent hover:text-primary'
          )}
        >
          <Package className="w-4 h-4 lg:w-5 lg:h-5 inline mr-1.5 lg:mr-2" />
          Qoldiqlar
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            'px-4 lg:px-6 py-2.5 lg:py-3 font-medium border-b-2 transition-colors whitespace-nowrap text-sm lg:text-base',
            activeTab === 'history' ? 'border-primary text-primary' : 'border-transparent hover:text-primary'
          )}
        >
          <History className="w-4 h-4 lg:w-5 lg:h-5 inline mr-1.5 lg:mr-2" />
          Kirim tarixi
        </button>
      </div>

      {/* Stock Tab */}
      {activeTab === 'stock' && (
        <>
          {/* Filters */}
          <Card>
            <CardContent className="p-3 lg:p-4">
              <div className="flex flex-col sm:flex-row gap-2 lg:gap-4 items-stretch sm:items-center">
                <div className="flex-1">
                  <Input
                    icon={<Search className="w-4 h-4 lg:w-5 lg:h-5" />}
                    placeholder="Tovar qidirish..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="text-sm lg:text-base"
                  />
                </div>
                <select
                  className="min-h-[44px] lg:min-h-btn px-3 lg:px-4 py-2 lg:py-3 border-2 border-border rounded-xl text-sm lg:text-pos-base"
                  value={selectedCategory || ''}
                  onChange={(e) => setSelectedCategory(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Barcha kategoriyalar</option>
                  {categories?.map((cat: any) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Stock List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-gray-50 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">Tovar</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Artikul</th>
                      <th className="px-4 py-3 text-right text-sm font-medium">Qoldiq</th>
                      <th className="px-4 py-3 text-right text-sm font-medium">O'rtacha kelish (USD)</th>
                      <th className="px-4 py-3 text-right text-sm font-medium">O'rtacha kelish (UZS)</th>
                      <th className="px-4 py-3 text-right text-sm font-medium">Sotuv narxi</th>
                      <th className="px-4 py-3 text-right text-sm font-medium">Jami qiymat</th>
                      <th className="px-4 py-3 text-center text-sm font-medium">Holat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {stockData?.data?.map((stock: Stock) => {
                      // Mahsulotni topish va UOM konversiyalarini olish
                      const product = productsList.find((p: Product) => p.id === stock.product_id)
                      const uomConversions = product?.uom_conversions || []
                      
                      return (
                      <tr key={stock.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium">{stock.product_name}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary">
                          {stock.product_article || '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {/* Asosiy UOM dagi qoldiq */}
                          <div className="font-semibold">
                            {formatNumber(stock.quantity, stock.quantity < 1 && stock.quantity > 0 ? 3 : 1)} {stock.base_uom_symbol}
                          </div>
                          {/* Boshqa UOM lardagi qoldiq */}
                          {uomConversions.length > 0 && stock.quantity > 0 && (
                            <div className="text-xs text-gray-500 mt-0.5 space-y-0.5">
                              {uomConversions.map((conv: any) => (
                                <div key={conv.uom_id}>
                                  ≈ {formatNumber(stock.quantity / conv.conversion_factor, 1)} {conv.uom_symbol}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-sm">
                          ${formatNumber(stock.average_cost / usdRate, 2)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-warning">
                          {formatMoney(stock.average_cost)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-success">
                          {formatMoney((productsList.find((p: Product) => p.id === stock.product_id)?.sale_price) || 0)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {formatMoney(stock.total_value)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {stock.is_below_minimum ? (
                            <Badge variant="danger">Kam</Badge>
                          ) : stock.quantity === 0 ? (
                            <Badge variant="secondary">Tugagan</Badge>
                          ) : (
                            <Badge variant="success">OK</Badge>
                          )}
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>

              {stockData?.data?.length === 0 && (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 mx-auto text-text-secondary opacity-50 mb-4" />
                  <p className="text-text-secondary">Tovarlar topilmadi</p>
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <>
          {/* Filter Panel */}
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                {/* Movement Type Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Turi:</span>
                  <div className="flex rounded-lg border overflow-hidden">
                    <button
                      onClick={() => { setMovementFilter('all'); setPage(1) }}
                      className={cn(
                        "px-3 py-1.5 text-sm",
                        movementFilter === 'all' ? 'bg-primary text-white' : 'hover:bg-gray-100'
                      )}
                    >
                      Barchasi
                    </button>
                    <button
                      onClick={() => { setMovementFilter('income'); setPage(1) }}
                      className={cn(
                        "px-3 py-1.5 text-sm border-l",
                        movementFilter === 'income' ? 'bg-green-600 text-white' : 'hover:bg-gray-100'
                      )}
                    >
                      Kirim
                    </button>
                    <button
                      onClick={() => { setMovementFilter('outcome'); setPage(1) }}
                      className={cn(
                        "px-3 py-1.5 text-sm border-l",
                        movementFilter === 'outcome' ? 'bg-red-600 text-white' : 'hover:bg-gray-100'
                      )}
                    >
                      Sotildi
                    </button>
                  </div>
                </div>
                
                {/* Date Range */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Sana:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
                    className="h-9 px-3 text-sm border rounded-lg"
                  />
                  <span className="text-gray-500">—</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
                    className="h-9 px-3 text-sm border rounded-lg"
                  />
                </div>
                
                {/* Clear Filters */}
                {(movementFilter !== 'all' || startDate || endDate) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMovementFilter('all')
                      setStartDate('')
                      setEndDate('')
                      setPage(1)
                    }}
                  >
                    Tozalash
                  </Button>
                )}
                
                {/* Results count */}
                <div className="ml-auto text-sm text-gray-500">
                  Jami: {movementsData?.total || 0} ta
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-0">
              {loadingMovements ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : movementsData?.data && movementsData.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-border">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium">Sana</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Tovar</th>
                        <th className="px-4 py-3 text-right text-sm font-medium">Miqdor</th>
                        <th className="px-4 py-3 text-right text-sm font-medium">Narx (USD)</th>
                        <th className="px-4 py-3 text-right text-sm font-medium">Narx (UZS)</th>
                        <th className="px-4 py-3 text-right text-sm font-medium">Jami</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Hujjat №</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Yetkazuvchi</th>
                        <th className="px-4 py-3 text-center text-sm font-medium">Tur</th>
                        {isDirector && <th className="px-4 py-3 text-center text-sm font-medium">Amallar</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {movementsData.data.map((movement: any) => {
                      const canEdit = ['purchase', 'adjustment_plus', 'adjustment_minus'].includes(movement.movement_type)
                      return (
                      <tr key={movement.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4 text-text-secondary" />
                            {formatDateTashkent(movement.created_at)}
                          </div>
                          <div className="text-xs text-text-secondary">
                            {formatTimeTashkent(movement.created_at)}
                          </div>
                          {movement.updated_at && movement.updated_by_name && (
                            <div className="text-xs text-warning mt-1 flex items-center gap-1">
                              <Pencil className="w-3 h-3" />
                              {movement.updated_by_name}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{movement.product_name}</p>
                          <p className="text-xs text-text-secondary">{movement.product_article || ''}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          <span className={['purchase', 'transfer_in', 'adjustment_plus', 'return_from_customer'].includes(movement.movement_type) ? 'text-success' : 'text-danger'}>
                            {['purchase', 'transfer_in', 'adjustment_plus', 'return_from_customer'].includes(movement.movement_type) ? '+' : '-'}{formatNumber(movement.quantity)} {movement.uom_symbol}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm">
                          ${formatNumber(movement.unit_price_usd || (movement.unit_price / (movement.exchange_rate || usdRate)), 2)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-warning">
                          {formatMoney(movement.unit_price)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {formatMoney(movement.total_price || movement.quantity * movement.unit_price)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {movement.document_number || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {movement.supplier_name || '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={['purchase', 'transfer_in', 'adjustment_plus', 'return_from_customer'].includes(movement.movement_type) ? 'success' : 'danger'}>
                            {movement.movement_type === 'purchase' ? 'Kirim' : 
                             movement.movement_type === 'sale' ? 'Sotildi' :
                             movement.movement_type === 'transfer_in' ? 'Keldi' :
                             movement.movement_type === 'transfer_out' ? 'Jo\'natildi' :
                             movement.movement_type === 'adjustment_plus' ? 'Tuzatish+' :
                             movement.movement_type === 'adjustment_minus' ? 'Tuzatish-' :
                             movement.movement_type === 'write_off' ? 'Zarar' : movement.movement_type}
                          </Badge>
                        </td>
                        {isDirector && (
                          <td className="px-4 py-3 text-center">
                            {canEdit ? (
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="p-1 h-8 w-8"
                                  onClick={() => setEditingMovement({
                                    id: movement.id,
                                    product_name: movement.product_name,
                                    quantity: movement.quantity,
                                    unit_price: movement.unit_price,
                                    unit_price_usd: movement.unit_price_usd,
                                    document_number: movement.document_number || '',
                                    supplier_name: movement.supplier_name || '',
                                    notes: movement.notes || ''
                                  })}
                                >
                                  <Pencil className="w-4 h-4 text-primary" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="p-1 h-8 w-8"
                                  onClick={() => setDeletingMovement({ id: movement.id, name: movement.product_name })}
                                >
                                  <Trash2 className="w-4 h-4 text-danger" />
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-text-secondary">-</span>
                            )}
                          </td>
                        )}
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <History className="w-16 h-16 mx-auto text-text-secondary opacity-50 mb-4" />
                <p className="text-text-secondary">Kirim tarixi topilmadi</p>
              </div>
            )}
          </CardContent>
        </Card>
        </>
      )}

      {/* Pagination */}
      {((activeTab === 'stock' && stockData && stockData.total > 20) || 
        (activeTab === 'history' && movementsData && movementsData.total > 30)) && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Oldingi</Button>
          <span className="px-4">{page}</span>
          <Button variant="outline" onClick={() => setPage(page + 1)}>Keyingi</Button>
        </div>
      )}

      {/* Income Dialog */}
      <Dialog open={showIncomeDialog} onOpenChange={setShowIncomeDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Omborga kirim (USD)</DialogTitle>
            <DialogDescription>Joriy kurs: 1$ = {formatNumber(usdRate)} so'm</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Warehouse & Document */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="font-medium">Ombor</label>
                <select
                  {...register('warehouse_id', { valueAsNumber: true })}
                  className="w-full min-h-btn px-4 py-3 border-2 border-border rounded-pos"
                >
                  {warehouses?.map((wh: Warehouse) => (
                    <option key={wh.id} value={wh.id}>{wh.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="font-medium">Hujjat raqami</label>
                <Input {...register('document_number')} placeholder="Faktura №" />
              </div>
              <div className="space-y-2">
                <label className="font-medium">Yetkazuvchi</label>
                <Input {...register('supplier_name')} placeholder="Yetkazuvchi nomi" />
              </div>
            </div>

            {/* Items */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="font-medium">Tovarlar</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ product_id: 0, quantity: 1, uom_id: 1, unit_price_usd: 0 })}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Qo'shish
                </Button>
              </div>

              <div className="border border-border rounded-pos overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-sm font-medium">Tovar</th>
                      <th className="px-3 py-2 text-center text-sm font-medium w-24">Miqdor</th>
                      <th className="px-3 py-2 text-center text-sm font-medium w-24">O'lchov</th>
                      <th className="px-3 py-2 text-center text-sm font-medium w-28">Narx ($)</th>
                      <th className="px-3 py-2 text-right text-sm font-medium w-32">Jami ($)</th>
                      <th className="px-3 py-2 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {fields.map((field, index) => {
                      const item = watchItems?.[index]
                      const itemTotal = (item?.quantity || 0) * (item?.unit_price_usd || 0)
                      return (
                        <tr key={field.id}>
                          <td className="px-3 py-2">
                            <select
                              {...register(`items.${index}.product_id`, { valueAsNumber: true })}
                              className="w-full px-2 py-2 border border-border rounded text-sm"
                            >
                              <option value={0}>
                                {productsLoading ? 'Yuklanmoqda...' : 'Tovar tanlang'}
                              </option>
                              {productsList.map((p: Product) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                              className="text-center text-sm"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              {...register(`items.${index}.uom_id`, { valueAsNumber: true })}
                              className="w-full px-2 py-2 border border-border rounded text-sm"
                            >
                              {uoms.map((uom: any) => (
                                <option key={uom.id} value={uom.id}>{uom.symbol}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-text-secondary">$</span>
                              <Input
                                type="number"
                                step="0.01"
                                {...register(`items.${index}.unit_price_usd`, { valueAsNumber: true })}
                                className="text-center text-sm pl-6"
                                placeholder="0.00"
                              />
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-success">
                            ${formatNumber(itemTotal, 2)}
                          </td>
                          <td className="px-3 py-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => remove(index)}
                              disabled={fields.length === 1}
                            >
                              <Trash2 className="w-4 h-4 text-danger" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="font-medium">Izoh</label>
              <Input {...register('notes')} placeholder="Qo'shimcha ma'lumot" />
            </div>

            {/* Total */}
            <div className="bg-gradient-to-r from-primary/10 to-success/10 p-4 rounded-pos">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-text-secondary">Jami (USD):</p>
                  <p className="text-pos-xl font-bold text-primary">${formatNumber(incomeTotalUsd, 2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-text-secondary">So'mda:</p>
                  <p className="text-pos-lg font-bold text-success">{formatMoney(incomeTotalUzs)}</p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowIncomeDialog(false)}>Bekor qilish</Button>
              <Button type="submit" variant="success" disabled={stockIncome.isPending}>
                {stockIncome.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TrendingUp className="w-4 h-4 mr-2" />}
                Kirimni saqlash
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Movement Dialog (Director only) */}
      <Dialog open={!!editingMovement} onOpenChange={() => setEditingMovement(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              Harakatni tahrirlash
            </DialogTitle>
            <DialogDescription>
              {editingMovement?.product_name}
            </DialogDescription>
          </DialogHeader>

          {editingMovement && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="font-medium text-sm">Miqdor</label>
                <Input
                  type="number"
                  step="0.01"
                  value={editingMovement.quantity}
                  onChange={(e) => setEditingMovement({...editingMovement, quantity: parseFloat(e.target.value) || 0})}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="font-medium text-sm">Narx (USD)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingMovement.unit_price_usd || ''}
                    onChange={(e) => setEditingMovement({
                      ...editingMovement, 
                      unit_price_usd: parseFloat(e.target.value) || 0,
                      unit_price: (parseFloat(e.target.value) || 0) * usdRate
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-medium text-sm">Narx (UZS)</label>
                  <Input
                    type="number"
                    value={editingMovement.unit_price}
                    onChange={(e) => setEditingMovement({...editingMovement, unit_price: parseFloat(e.target.value) || 0})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-medium text-sm">Hujjat raqami</label>
                <Input
                  value={editingMovement.document_number}
                  onChange={(e) => setEditingMovement({...editingMovement, document_number: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="font-medium text-sm">Yetkazuvchi</label>
                <Input
                  value={editingMovement.supplier_name}
                  onChange={(e) => setEditingMovement({...editingMovement, supplier_name: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="font-medium text-sm">Izoh</label>
                <Input
                  value={editingMovement.notes}
                  onChange={(e) => setEditingMovement({...editingMovement, notes: e.target.value})}
                />
              </div>

              <div className="bg-warning/10 p-3 rounded-lg text-sm">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-warning mt-0.5" />
                  <p>Miqdorni o'zgartirsangiz, ombor qoldig'i avtomatik yangilanadi.</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMovement(null)}>Bekor qilish</Button>
            <Button
              variant="primary"
              onClick={() => editingMovement && editMovement.mutate({
                id: editingMovement.id,
                quantity: editingMovement.quantity,
                unit_price: editingMovement.unit_price,
                unit_price_usd: editingMovement.unit_price_usd || undefined,
                document_number: editingMovement.document_number,
                supplier_name: editingMovement.supplier_name,
                notes: editingMovement.notes
              })}
              disabled={editMovement.isPending}
            >
              {editMovement.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Pencil className="w-4 h-4 mr-2" />}
              Saqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Movement Dialog (Director only) */}
      <Dialog open={!!deletingMovement} onOpenChange={() => { setDeletingMovement(null); setDeleteReason(''); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-danger">
              <Trash2 className="w-5 h-5" />
              Harakatni o'chirish
            </DialogTitle>
            <DialogDescription>
              <span className="font-semibold">{deletingMovement?.name}</span> kirimini o'chirmoqchimisiz?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-danger/10 p-3 rounded-lg text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-danger mt-0.5" />
                <div>
                  <p className="font-medium text-danger">Diqqat!</p>
                  <p>Bu harakat ombor qoldig'ini teskari o'zgartiradi. Kirim o'chirilsa, tovar qoldig'i kamayadi.</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="font-medium text-sm">O'chirish sababi *</label>
              <Input
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Sabab kiriting (majburiy)"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeletingMovement(null); setDeleteReason(''); }}>Bekor qilish</Button>
            <Button
              variant="danger"
              onClick={() => deletingMovement && deleteMovement.mutate({ id: deletingMovement.id, reason: deleteReason })}
              disabled={deleteMovement.isPending || !deleteReason.trim()}
            >
              {deleteMovement.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              O'chirish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
