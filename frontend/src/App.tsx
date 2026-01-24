import { Routes, Route, Navigate } from 'react-router-dom'
import { MainLayout } from '@/components/layout'
import { useAuthStore } from '@/stores/authStore'

// Pages
import LoginPage from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import POSPage from '@/pages/POS'
import SalesPage from '@/pages/Sales'
import ProductsPage from '@/pages/Products'
import CustomersPage from '@/pages/Customers'
import WarehousePage from '@/pages/Warehouse'
import ReportsPage from '@/pages/Reports'
import SettingsPage from '@/pages/Settings'
import UsersPage from '@/pages/Users'

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected routes */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/pos" element={<POSPage />} />
        <Route path="/sales" element={<SalesPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/warehouse" element={<WarehousePage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/users" element={<UsersPage />} />
      </Route>

      {/* Catch all - redirect to dashboard */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
