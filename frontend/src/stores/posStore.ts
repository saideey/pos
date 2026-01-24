import { create } from 'zustand'
import type { CartItem, Customer, PaymentMethod } from '@/types'

interface POSState {
  // Cart
  items: CartItem[]
  customer: Customer | null
  warehouseId: number
  
  // Totals
  subtotal: number
  discountAmount: number
  discountPercent: number
  finalTotal: number
  
  // Payment
  payments: PaymentMethod[]
  paidAmount: number
  debtAmount: number
  changeAmount: number
  
  // UI State
  isCustomTotalEnabled: boolean
  customTotal: number | null
  
  // Edit mode
  editingSaleId: number | null
  editingSaleNumber: string | null
  originalSubtotal: number // Original subtotal for reference
  
  // Actions
  addItem: (item: Omit<CartItem, 'id' | 'discount_percent' | 'discount_amount' | 'total_price'>) => void
  updateItemQuantity: (itemId: string, quantity: number) => void
  updateItemPrice: (itemId: string, price: number) => void
  removeItem: (itemId: string) => void
  clearCart: () => void
  
  setCustomer: (customer: Customer | null) => void
  setWarehouse: (warehouseId: number) => void
  
  // Proportional discount
  setCustomTotal: (total: number | null) => void
  applyProportionalDiscount: (newTotal: number) => void
  
  // Payments
  addPayment: (payment: PaymentMethod) => void
  removePayment: (index: number) => void
  clearPayments: () => void
  
  // Edit mode
  loadSaleForEdit: (saleData: {
    id: number
    sale_number: string
    customer: Customer | null
    warehouse_id: number
    items: Array<{
      product_id: number
      product_name: string
      quantity: number
      uom_id: number
      uom_symbol: string
      unit_price: number
      original_price: number
    }>
    subtotal: number
    discount_amount: number
    final_total: number
    paid_amount: number
  }) => void
  clearEditMode: () => void
  
  // Reset
  resetPOS: () => void
}

const generateItemId = () => `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

const calculateTotals = (items: CartItem[]) => {
  const subtotal = items.reduce((sum, item) => sum + item.total_price, 0)
  return { subtotal }
}

export const usePOSStore = create<POSState>((set, get) => ({
  // Initial state
  items: [],
  customer: null,
  warehouseId: 1, // Default warehouse
  
  subtotal: 0,
  discountAmount: 0,
  discountPercent: 0,
  finalTotal: 0,
  
  payments: [],
  paidAmount: 0,
  debtAmount: 0,
  changeAmount: 0,
  
  isCustomTotalEnabled: false,
  customTotal: null,
  
  // Edit mode
  editingSaleId: null,
  editingSaleNumber: null,
  originalSubtotal: 0,

  // Add item to cart
  addItem: (item) => {
    const state = get()
    const existingItem = state.items.find(
      (i) => i.product_id === item.product_id && i.uom_id === item.uom_id
    )

    let newItems: CartItem[]

    if (existingItem) {
      // Update quantity if item exists
      newItems = state.items.map((i) =>
        i.id === existingItem.id
          ? {
              ...i,
              quantity: i.quantity + item.quantity,
              total_price: (i.quantity + item.quantity) * i.unit_price,
            }
          : i
      )
    } else {
      // Add new item
      const newItem: CartItem = {
        ...item,
        id: generateItemId(),
        discount_percent: 0,
        discount_amount: 0,
        total_price: item.quantity * item.unit_price,
      }
      newItems = [...state.items, newItem]
    }

    const { subtotal } = calculateTotals(newItems)
    
    set({
      items: newItems,
      subtotal,
      finalTotal: state.customTotal || subtotal,
      discountAmount: state.customTotal ? subtotal - state.customTotal : 0,
      discountPercent: state.customTotal && subtotal > 0 
        ? ((subtotal - state.customTotal) / subtotal) * 100 
        : 0,
    })
  },

  // Update item quantity
  updateItemQuantity: (itemId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(itemId)
      return
    }

    const state = get()
    const newItems = state.items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            quantity,
            total_price: quantity * item.unit_price,
          }
        : item
    )

    const { subtotal } = calculateTotals(newItems)
    
    set({
      items: newItems,
      subtotal,
      finalTotal: state.customTotal || subtotal,
      discountAmount: state.customTotal ? subtotal - state.customTotal : 0,
      discountPercent: state.customTotal && subtotal > 0 
        ? ((subtotal - state.customTotal) / subtotal) * 100 
        : 0,
    })
  },

  // Update item price
  updateItemPrice: (itemId, price) => {
    const state = get()
    const newItems = state.items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            unit_price: price,
            total_price: item.quantity * price,
          }
        : item
    )

    const { subtotal } = calculateTotals(newItems)
    
    set({
      items: newItems,
      subtotal,
      finalTotal: subtotal,
      customTotal: null,
      discountAmount: 0,
      discountPercent: 0,
    })
  },

  // Remove item
  removeItem: (itemId) => {
    const state = get()
    const newItems = state.items.filter((item) => item.id !== itemId)
    const { subtotal } = calculateTotals(newItems)
    
    set({
      items: newItems,
      subtotal,
      finalTotal: state.customTotal && state.customTotal < subtotal ? state.customTotal : subtotal,
      discountAmount: state.customTotal && state.customTotal < subtotal ? subtotal - state.customTotal : 0,
      discountPercent: state.customTotal && subtotal > 0 && state.customTotal < subtotal
        ? ((subtotal - state.customTotal) / subtotal) * 100 
        : 0,
    })
  },

  // Clear cart
  clearCart: () => {
    set({
      items: [],
      subtotal: 0,
      discountAmount: 0,
      discountPercent: 0,
      finalTotal: 0,
      customTotal: null,
      isCustomTotalEnabled: false,
    })
  },

  // Set customer
  setCustomer: (customer) => {
    set({ customer })
  },

  // Set warehouse
  setWarehouse: (warehouseId) => {
    set({ warehouseId })
  },

  // Set custom total - triggers proportional discount
  setCustomTotal: (total) => {
    const state = get()
    
    if (total === null || total >= state.subtotal) {
      set({
        customTotal: null,
        isCustomTotalEnabled: false,
        finalTotal: state.subtotal,
        discountAmount: 0,
        discountPercent: 0,
      })
      return
    }

    const discountAmount = state.subtotal - total
    const discountPercent = (discountAmount / state.subtotal) * 100

    // Apply proportional discount to each item
    const newItems = state.items.map((item) => {
      const itemShare = item.total_price / state.subtotal
      const itemDiscount = discountAmount * itemShare
      const newTotal = item.total_price - itemDiscount
      const newUnitPrice = newTotal / item.quantity

      return {
        ...item,
        discount_percent: discountPercent,
        discount_amount: itemDiscount,
        unit_price: Math.round(newUnitPrice * 100) / 100,
        total_price: Math.round(newTotal * 100) / 100,
      }
    })

    set({
      items: newItems,
      customTotal: total,
      isCustomTotalEnabled: true,
      finalTotal: total,
      discountAmount: Math.round(discountAmount * 100) / 100,
      discountPercent: Math.round(discountPercent * 100) / 100,
    })
  },

  // Apply proportional discount (alternative name)
  applyProportionalDiscount: (newTotal) => {
    get().setCustomTotal(newTotal)
  },

  // Add payment
  addPayment: (payment) => {
    const state = get()
    const newPayments = [...state.payments, payment]
    const paidAmount = newPayments.reduce((sum, p) => sum + p.amount, 0)
    const changeAmount = Math.max(0, paidAmount - state.finalTotal)
    const debtAmount = Math.max(0, state.finalTotal - paidAmount)

    set({
      payments: newPayments,
      paidAmount,
      changeAmount,
      debtAmount,
    })
  },

  // Remove payment
  removePayment: (index) => {
    const state = get()
    const newPayments = state.payments.filter((_, i) => i !== index)
    const paidAmount = newPayments.reduce((sum, p) => sum + p.amount, 0)
    const changeAmount = Math.max(0, paidAmount - state.finalTotal)
    const debtAmount = Math.max(0, state.finalTotal - paidAmount)

    set({
      payments: newPayments,
      paidAmount,
      changeAmount,
      debtAmount,
    })
  },

  // Clear payments
  clearPayments: () => {
    set({
      payments: [],
      paidAmount: 0,
      changeAmount: 0,
      debtAmount: 0,
    })
  },

  // Load sale for editing
  loadSaleForEdit: (saleData) => {
    const items: CartItem[] = saleData.items.map(item => ({
      id: generateItemId(),
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      uom_id: item.uom_id,
      uom_symbol: item.uom_symbol,
      unit_price: item.unit_price,
      original_price: item.original_price,
      discount_percent: 0,
      discount_amount: 0,
      total_price: item.quantity * item.unit_price,
    }))

    const subtotal = items.reduce((sum, item) => sum + item.total_price, 0)
    const hasDiscount = saleData.discount_amount > 0
    
    set({
      items,
      customer: saleData.customer,
      warehouseId: saleData.warehouse_id,
      subtotal,
      originalSubtotal: saleData.subtotal, // Store original for reference
      discountAmount: saleData.discount_amount,
      discountPercent: saleData.subtotal > 0 ? (saleData.discount_amount / saleData.subtotal) * 100 : 0,
      finalTotal: saleData.final_total,
      customTotal: hasDiscount ? saleData.final_total : null,
      isCustomTotalEnabled: hasDiscount,
      payments: [],
      paidAmount: 0,
      debtAmount: 0,
      changeAmount: 0,
      editingSaleId: saleData.id,
      editingSaleNumber: saleData.sale_number,
    })
  },

  // Clear edit mode
  clearEditMode: () => {
    set({
      editingSaleId: null,
      editingSaleNumber: null,
      originalSubtotal: 0,
    })
  },

  // Reset entire POS state
  resetPOS: () => {
    set({
      items: [],
      customer: null,
      subtotal: 0,
      discountAmount: 0,
      discountPercent: 0,
      finalTotal: 0,
      payments: [],
      paidAmount: 0,
      debtAmount: 0,
      changeAmount: 0,
      isCustomTotalEnabled: false,
      customTotal: null,
      editingSaleId: null,
      editingSaleNumber: null,
      originalSubtotal: 0,
    })
  },
}))
