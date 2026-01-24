import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  Users as UsersIcon,
  Plus,
  Search,
  Edit,
  Trash2,
  Key,
  Loader2,
  Shield,
  UserCheck,
  UserX,
  Eye,
  EyeOff,
  X,
  Phone,
  Mail,
  Calendar,
  Clock
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, Input, Card, CardContent, Badge } from '@/components/ui'
import usersService, { User, Role, CreateUserData, UpdateUserData } from '@/services/usersService'
import { formatDateTimeTashkent } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'

export default function UsersPage() {
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuthStore()
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState<number | ''>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  // Fetch users
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users', search, filterRole, filterStatus],
    queryFn: () => usersService.getUsers({
      search: search || undefined,
      role_id: filterRole || undefined,
      is_active: filterStatus === '' ? undefined : filterStatus === 'active'
    })
  })

  // Fetch roles
  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: usersService.getRoles
  })

  const users: User[] = usersData?.data || []
  const roles: Role[] = rolesData?.data || []

  // Create user form
  const createForm = useForm<CreateUserData>({
    defaultValues: {
      username: '',
      password: '',
      first_name: '',
      last_name: '',
      phone: '',
      email: '',
      role_id: 0
    }
  })

  // Edit user form
  const editForm = useForm<UpdateUserData>()

  // Reset password form
  const resetPasswordForm = useForm<{ new_password: string; confirm_password: string }>()

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: usersService.createUser,
    onSuccess: () => {
      toast.success('Foydalanuvchi yaratildi!')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setShowCreateModal(false)
      createForm.reset()
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail
      if (Array.isArray(detail)) {
        // Pydantic validation error
        const messages = detail.map((err: any) => err.msg || err.message).join(', ')
        toast.error(messages || 'Validatsiya xatosi')
      } else if (typeof detail === 'string') {
        toast.error(detail)
      } else {
        toast.error('Xatolik yuz berdi')
      }
    }
  })

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateUserData }) => 
      usersService.updateUser(id, data),
    onSuccess: () => {
      toast.success('Foydalanuvchi yangilandi!')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setShowEditModal(false)
      setSelectedUser(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Xatolik yuz berdi')
    }
  })

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: usersService.deleteUser,
    onSuccess: () => {
      toast.success('Foydalanuvchi o\'chirildi!')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setShowDeleteConfirm(false)
      setSelectedUser(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Xatolik yuz berdi')
    }
  })

  // Toggle user status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: usersService.toggleUserStatus,
    onSuccess: () => {
      toast.success('Status o\'zgartirildi!')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Xatolik yuz berdi')
    }
  })

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId, password }: { userId: number; password: string }) =>
      usersService.resetUserPassword(userId, password),
    onSuccess: () => {
      toast.success('Parol yangilandi!')
      setShowResetPasswordModal(false)
      setSelectedUser(null)
      resetPasswordForm.reset()
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail
      if (Array.isArray(detail)) {
        const messages = detail.map((err: any) => err.msg || err.message).join(', ')
        toast.error(messages || 'Validatsiya xatosi')
      } else if (typeof detail === 'string') {
        toast.error(detail)
      } else {
        toast.error('Xatolik yuz berdi')
      }
    }
  })

  // Handlers
  const handleCreate = (data: CreateUserData) => {
    if (!data.role_id) {
      toast.error('Rolni tanlang')
      return
    }
    createUserMutation.mutate(data)
  }

  const handleEdit = (user: User) => {
    setSelectedUser(user)
    editForm.reset({
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      email: user.email || '',
      role_id: user.role_id,
      is_active: user.is_active
    })
    setShowEditModal(true)
  }

  const handleUpdate = (data: UpdateUserData) => {
    if (selectedUser) {
      updateUserMutation.mutate({ id: selectedUser.id, data })
    }
  }

  const handleDelete = (user: User) => {
    if (user.id === currentUser?.id) {
      toast.error('O\'zingizni o\'chira olmaysiz!')
      return
    }
    setSelectedUser(user)
    setShowDeleteConfirm(true)
  }

  const handleResetPassword = (user: User) => {
    setSelectedUser(user)
    resetPasswordForm.reset()
    setShowResetPasswordModal(true)
  }

  const submitResetPassword = (data: { new_password: string; confirm_password: string }) => {
    if (data.new_password !== data.confirm_password) {
      toast.error('Parollar mos kelmayapti')
      return
    }
    if (data.new_password.length < 6) {
      toast.error('Parol kamida 6 ta belgidan iborat bo\'lishi kerak')
      return
    }
    if (selectedUser) {
      resetPasswordMutation.mutate({ userId: selectedUser.id, password: data.new_password })
    }
  }

  const getRoleBadgeColor = (roleType: string) => {
    switch (roleType) {
      case 'admin': return 'bg-red-100 text-red-800'
      case 'manager': return 'bg-blue-100 text-blue-800'
      case 'cashier': return 'bg-green-100 text-green-800'
      case 'warehouse': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getRoleDisplayName = (roleName: string) => {
    const roleMap: Record<string, string> = {
      'Admin': 'Administrator',
      'ADMIN': 'Administrator',
      'admin': 'Administrator',
      'Manager': 'Menejer',
      'MANAGER': 'Menejer',
      'manager': 'Menejer',
      'Cashier': 'Kassir',
      'CASHIER': 'Kassir',
      'cashier': 'Kassir',
      'Warehouse': 'Omborchi',
      'WAREHOUSE': 'Omborchi',
      'warehouse': 'Omborchi',
    }
    return roleMap[roleName] || roleName
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 lg:gap-4">
        <div className="flex items-center gap-2 lg:gap-3">
          <UsersIcon className="w-6 h-6 lg:w-8 lg:h-8 text-primary" />
          <div>
            <h1 className="text-xl lg:text-2xl font-bold">Foydalanuvchilar</h1>
            <p className="text-xs lg:text-sm text-gray-500">Jami: {users.length} ta</p>
          </div>
        </div>
        <Button variant="primary" onClick={() => setShowCreateModal(true)} className="w-full sm:w-auto">
          <Plus className="w-5 h-5 mr-2" />
          Yangi foydalanuvchi
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 lg:p-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
            <div className="relative col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 lg:w-5 lg:h-5 text-gray-400" />
              <Input
                placeholder="Qidirish..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 lg:pl-10 text-sm lg:text-base"
              />
            </div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value ? Number(e.target.value) : '')}
              className="px-3 lg:px-4 py-2.5 lg:py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 text-sm lg:text-base"
            >
              <option value="">Barcha rollar</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>{getRoleDisplayName(role.name)}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 lg:px-4 py-2.5 lg:py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 text-sm lg:text-base"
            >
              <option value="">Barcha status</option>
              <option value="active">Faol</option>
              <option value="inactive">Nofaol</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <UsersIcon className="w-12 h-12 lg:w-16 lg:h-16 mx-auto mb-4 opacity-50" />
              <p className="text-sm lg:text-base">Foydalanuvchilar topilmadi</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-4 font-semibold">Foydalanuvchi</th>
                    <th className="text-left px-6 py-4 font-semibold">Username</th>
                    <th className="text-left px-6 py-4 font-semibold">Telefon</th>
                    <th className="text-left px-6 py-4 font-semibold">Role</th>
                    <th className="text-center px-6 py-4 font-semibold">Status</th>
                    <th className="text-left px-6 py-4 font-semibold">Oxirgi kirish</th>
                    <th className="text-center px-6 py-4 font-semibold">Amallar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <span className="font-semibold text-primary">
                              {user.first_name[0]}{user.last_name[0]}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{user.first_name} {user.last_name}</p>
                            {user.email && (
                              <p className="text-sm text-gray-500">{user.email}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <code className="bg-gray-100 px-2 py-1 rounded text-sm">{user.username}</code>
                      </td>
                      <td className="px-6 py-4">{user.phone}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeColor(user.role_name?.toLowerCase() || '')}`}>
                          <Shield className="w-3 h-3 inline mr-1" />
                          {getRoleDisplayName(user.role_name || '')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => toggleStatusMutation.mutate(user.id)}
                          disabled={user.id === currentUser?.id}
                          className={`p-2 rounded-lg transition-colors ${
                            user.is_active 
                              ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                              : 'bg-red-100 text-red-600 hover:bg-red-200'
                          } ${user.id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {user.is_active ? <UserCheck className="w-5 h-5" /> : <UserX className="w-5 h-5" />}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {user.last_login 
                          ? formatDateTimeTashkent(user.last_login)
                          : 'Hech qachon'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(user)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Tahrirlash"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleResetPassword(user)}
                            className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                            title="Parol o'zgartirish"
                          >
                            <Key className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            disabled={user.id === currentUser?.id}
                            className={`p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors ${
                              user.id === currentUser?.id ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            title="O'chirish"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">Yangi foydalanuvchi</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={createForm.handleSubmit(handleCreate)} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Ism *</label>
                  <Input {...createForm.register('first_name', { required: true })} placeholder="Ism" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Familiya *</label>
                  <Input {...createForm.register('last_name', { required: true })} placeholder="Familiya" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Username *</label>
                <Input {...createForm.register('username', { required: true, minLength: 3 })} placeholder="username (kamida 3 ta belgi)" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Parol *</label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    {...createForm.register('password', { required: true, minLength: 6 })}
                    placeholder="Kamida 6 ta belgi"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Telefon *</label>
                <Input {...createForm.register('phone', { required: true })} placeholder="+998901234567" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <Input {...createForm.register('email')} type="email" placeholder="email@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role *</label>
                <select
                  {...createForm.register('role_id', { required: true, valueAsNumber: true })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20"
                >
                  <option value={0}>Rolni tanlang</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>{getRoleDisplayName(role.name)}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCreateModal(false)}>
                  Bekor qilish
                </Button>
                <Button type="submit" variant="primary" className="flex-1" disabled={createUserMutation.isPending}>
                  {createUserMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Yaratish'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">Foydalanuvchini tahrirlash</h2>
              <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={editForm.handleSubmit(handleUpdate)} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Ism</label>
                  <Input {...editForm.register('first_name')} placeholder="Ism" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Familiya</label>
                  <Input {...editForm.register('last_name')} placeholder="Familiya" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Telefon</label>
                <Input {...editForm.register('phone')} placeholder="+998901234567" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <Input {...editForm.register('email')} type="email" placeholder="email@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select
                  {...editForm.register('role_id', { valueAsNumber: true })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20"
                  disabled={selectedUser.id === currentUser?.id}
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>{getRoleDisplayName(role.name)}</option>
                  ))}
                </select>
                {selectedUser.id === currentUser?.id && (
                  <p className="text-xs text-gray-500 mt-1">O'z rolingizni o'zgartira olmaysiz</p>
                )}
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowEditModal(false)}>
                  Bekor qilish
                </Button>
                <Button type="submit" variant="primary" className="flex-1" disabled={updateUserMutation.isPending}>
                  {updateUserMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Saqlash'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">Parolni o'zgartirish</h2>
              <button onClick={() => setShowResetPasswordModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={resetPasswordForm.handleSubmit(submitResetPassword)} className="p-6 space-y-4">
              <div className="bg-yellow-50 p-4 rounded-xl">
                <p className="text-sm text-yellow-800">
                  <strong>{selectedUser.first_name} {selectedUser.last_name}</strong> uchun yangi parol o'rnatiladi
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Yangi parol</label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    {...resetPasswordForm.register('new_password', { required: true, minLength: 6 })}
                    placeholder="Kamida 6 ta belgi"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Parolni tasdiqlang</label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  {...resetPasswordForm.register('confirm_password', { required: true })}
                  placeholder="Parolni qayta kiriting"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowResetPasswordModal(false)}>
                  Bekor qilish
                </Button>
                <Button type="submit" variant="warning" className="flex-1" disabled={resetPasswordMutation.isPending}>
                  {resetPasswordMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'O\'zgartirish'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold mb-2">O'chirishni tasdiqlang</h3>
              <p className="text-gray-600 mb-6">
                <strong>{selectedUser.first_name} {selectedUser.last_name}</strong> foydalanuvchisini o'chirmoqchimisiz?
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>
                  Bekor qilish
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  onClick={() => deleteUserMutation.mutate(selectedUser.id)}
                  disabled={deleteUserMutation.isPending}
                >
                  {deleteUserMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'O\'chirish'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
