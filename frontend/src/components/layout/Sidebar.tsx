import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Warehouse,
  FileText,
  Settings,
  LogOut,
  HelpCircle,
  X,
  Instagram,
  Send,
  UsersRound,
  Key,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import api from '@/services/api'

interface NavItem {
  name: string
  href: string
  icon: React.ElementType
  permission?: string
}

const navItems: NavItem[] = [
  { name: 'Bosh sahifa', href: '/', icon: LayoutDashboard },
  { name: 'Kassa', href: '/pos', icon: ShoppingCart },
  { name: 'Tovarlar', href: '/products', icon: Package },
  { name: 'Mijozlar', href: '/customers', icon: Users },
  { name: 'Ombor', href: '/warehouse', icon: Warehouse },
  { name: 'Hisobotlar', href: '/reports', icon: FileText, permission: 'REPORT_SALES' },
  { name: 'Foydalanuvchilar', href: '/users', icon: UsersRound, permission: 'USER_VIEW' },
  { name: 'Sozlamalar', href: '/settings', icon: Settings, permission: 'SETTINGS_VIEW' },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation()
  const { user, logout, hasPermission } = useAuthStore()
  const [showHelp, setShowHelp] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' })
  const [showPasswords, setShowPasswords] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  const handleLogout = () => {
    logout()
    window.location.href = '/login'
  }

  const handleChangePassword = async () => {
    if (!passwordData.current || !passwordData.new || !passwordData.confirm) {
      alert('Barcha maydonlarni to\'ldiring')
      return
    }
    if (passwordData.new !== passwordData.confirm) {
      alert('Yangi parollar mos kelmayapti')
      return
    }
    if (passwordData.new.length < 6) {
      alert('Parol kamida 6 ta belgidan iborat bo\'lishi kerak')
      return
    }

    setChangingPassword(true)
    try {
      const response = await api.post('/users/change-password', {
        current_password: passwordData.current,
        new_password: passwordData.new
      })
      
      if (response.data) {
        alert('Parol muvaffaqiyatli o\'zgartirildi!')
        setShowChangePassword(false)
        setPasswordData({ current: '', new: '', confirm: '' })
      }
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Xatolik yuz berdi')
    } finally {
      setChangingPassword(false)
    }
  }

  const filteredNavItems = navItems.filter(
    (item) => !item.permission || hasPermission(item.permission)
  )

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          'fixed left-0 top-0 h-screen w-72 bg-surface border-r border-border flex flex-col z-50',
          'transition-transform duration-300 ease-in-out',
          'lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="p-5 lg:p-6 border-b border-border flex items-center justify-between">
          <img 
            src="/logo.png" 
            alt="Inter Profnastil" 
            className="h-16 lg:h-20 xl:h-24 w-auto object-contain"
          />
          {/* Close button for mobile */}
          <button 
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 lg:p-4 space-y-1 lg:space-y-2 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.href || 
              (item.href !== '/' && location.pathname.startsWith(item.href))
            
            return (
              <NavLink
                key={item.href}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 lg:gap-4 px-3 lg:px-4 py-3 lg:py-4 rounded-xl font-medium transition-all',
                  'text-base hover:bg-gray-100 active:scale-[0.98]',
                  isActive && 'bg-primary text-white hover:bg-primary-dark'
                )}
              >
                <item.icon className="h-5 w-5 lg:h-6 lg:w-6 min-h-5 min-w-5 lg:min-h-6 lg:min-w-6 flex-shrink-0" />
                <span className="truncate">{item.name}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* Help Button */}
        <div className="px-3 lg:px-4 py-2 border-t border-border">
          <button 
            onClick={() => setShowHelp(true)}
            className="flex items-center gap-3 lg:gap-4 w-full px-3 lg:px-4 py-3 rounded-xl font-medium hover:bg-gray-100 transition-colors text-text-secondary"
          >
            <HelpCircle className="h-5 w-5 lg:h-6 lg:w-6 flex-shrink-0" />
            <span>Yordam</span>
          </button>
        </div>

        {/* User Info & Logout */}
        <div className="p-3 lg:p-4 border-t border-border">
          <div className="mb-3 px-3 lg:px-4">
            <p className="font-semibold text-text-primary truncate">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-sm text-text-secondary truncate">
              {user?.role_name}
            </p>
          </div>
          <button
            onClick={() => setShowChangePassword(true)}
            className="flex items-center gap-3 w-full px-3 lg:px-4 py-2.5 lg:py-3 rounded-xl font-medium hover:bg-yellow-50 text-yellow-600 transition-colors mb-2"
          >
            <Key className="h-5 w-5 flex-shrink-0" />
            <span>Parol o'zgartirish</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 lg:px-4 py-2.5 lg:py-3 rounded-xl font-medium hover:bg-danger/10 text-danger transition-colors"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            <span>Chiqish</span>
          </button>
        </div>
      </aside>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-5 lg:p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl lg:text-2xl font-bold">XLAB</h2>
                  <p className="text-blue-100 text-sm">IT Solutions & Development</p>
                </div>
                <button 
                  onClick={() => setShowHelp(false)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 lg:p-6 space-y-4">
              <p className="text-gray-600 text-center text-sm lg:text-base">
                Dastur bo'yicha yordam yoki qo'shimcha xizmatlar uchun biz bilan bog'laning
              </p>

              {/* Contact Links */}
              <div className="space-y-3">
                <a
                  href="https://www.instagram.com/xlabuz/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 lg:gap-4 p-3 lg:p-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-xl hover:opacity-90 transition-opacity active:scale-[0.98]"
                >
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Instagram className="w-5 h-5 lg:w-6 lg:h-6" />
                  </div>
                  <div>
                    <p className="font-semibold">Instagram</p>
                    <p className="text-sm text-white/80">@xlabuz</p>
                  </div>
                </a>

                <a
                  href="https://t.me/xlab_uz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 lg:gap-4 p-3 lg:p-4 bg-gradient-to-r from-blue-400 to-blue-600 text-white rounded-xl hover:opacity-90 transition-opacity active:scale-[0.98]"
                >
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Send className="w-5 h-5 lg:w-6 lg:h-6" />
                  </div>
                  <div>
                    <p className="font-semibold">Telegram</p>
                    <p className="text-sm text-white/80">@xlab_uz</p>
                  </div>
                </a>
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-gray-100 text-center">
                <p className="text-xs text-gray-400">
                  © 2026 XLAB. Barcha huquqlar himoyalangan.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-yellow-500 to-orange-500 p-5 lg:p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg lg:text-xl font-bold">Parol o'zgartirish</h2>
                  <p className="text-yellow-100 text-sm">Xavfsizlik uchun parolingizni yangilang</p>
                </div>
                <button 
                  onClick={() => {
                    setShowChangePassword(false)
                    setPasswordData({ current: '', new: '', confirm: '' })
                  }}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Form */}
            <div className="p-5 lg:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Joriy parol</label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={passwordData.current}
                  onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                  placeholder="Hozirgi parolingiz"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Yangi parol</label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={passwordData.new}
                  onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                  placeholder="Kamida 6 ta belgi"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Yangi parolni tasdiqlang</label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={passwordData.confirm}
                  onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                  placeholder="Yangi parolni qayta kiriting"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 text-base"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPasswords}
                  onChange={(e) => setShowPasswords(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-600">Parollarni ko'rsatish</span>
              </label>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowChangePassword(false)
                    setPasswordData({ current: '', new: '', confirm: '' })
                  }}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 font-medium transition-colors active:scale-[0.98]"
                >
                  Bekor qilish
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={changingPassword}
                  className="flex-1 px-4 py-3 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600 font-medium transition-colors disabled:opacity-50 active:scale-[0.98]"
                >
                  {changingPassword ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
