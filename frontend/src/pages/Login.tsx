import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, User, Lock, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { authService } from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'

const loginSchema = z.object({
  username: z.string().min(3, 'Login kamida 3 ta belgi bo\'lishi kerak'),
  password: z.string().min(1, 'Parol kiriting'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    try {
      const response = await authService.login(data)
      
      // Extract tokens from response.tokens
      setAuth(
        response.user, 
        response.tokens.access_token, 
        response.tokens.refresh_token
      )
      
      toast.success(`Xush kelibsiz, ${response.user.first_name}!`)
      navigate('/')
    } catch (error: any) {
      // Handle different error formats
      let message = 'Login yoki parol xato'
      
      try {
        if (error.response?.data?.detail) {
          const detail = error.response.data.detail
          // FastAPI validation error - array of objects
          if (Array.isArray(detail)) {
            message = detail.map((d: any) => {
              if (typeof d === 'string') return d
              if (d && typeof d === 'object' && d.msg) return String(d.msg)
              return 'Validatsiya xatosi'
            }).join(', ')
          } else if (typeof detail === 'string') {
            message = detail
          } else if (typeof detail === 'object' && detail.msg) {
            message = String(detail.msg)
          } else {
            message = JSON.stringify(detail)
          }
        } else if (error.response?.data?.message) {
          message = String(error.response.data.message)
        } else if (error.message) {
          message = String(error.message)
        }
      } catch {
        message = 'Xatolik yuz berdi'
      }
      
      // Ensure message is always a string
      toast.error(String(message))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center p-6 lg:p-8">
          <div className="mx-auto mb-6">
            <img 
              src="/logo.png" 
              alt="Inter Profnastil" 
              className="h-24 lg:h-28 w-auto object-contain mx-auto"
            />
          </div>
          <CardTitle className="text-xl lg:text-pos-xl">Tizimga kirish</CardTitle>
          <p className="text-text-secondary mt-2 text-sm lg:text-base">Login va parolingizni kiriting</p>
        </CardHeader>
        <CardContent className="p-6 lg:p-8 pt-0 lg:pt-0">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 lg:space-y-6">
            {/* Username */}
            <div className="space-y-2">
              <label className="text-sm lg:text-pos-base font-medium">Login</label>
              <Input
                {...register('username')}
                icon={<User className="w-5 h-5" />}
                placeholder="Login kiriting"
                autoComplete="username"
                className={`text-base ${errors.username ? 'border-danger' : ''}`}
              />
              {errors.username && (
                <p className="text-danger text-sm">{errors.username.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-sm lg:text-pos-base font-medium">Parol</label>
              <div className="relative">
                <Input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  icon={<Lock className="w-5 h-5" />}
                  placeholder="Parol kiriting"
                  autoComplete="current-password"
                  className={`text-base ${errors.password ? 'border-danger' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary p-1"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-danger text-sm">{errors.password.message}</p>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              size="lg"
              className="w-full text-base py-4"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Kirish...
                </>
              ) : (
                'Kirish'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
