import { useQuery } from '@tanstack/react-query'
import { 
  ShoppingCart, 
  DollarSign, 
  CreditCard, 
  TrendingUp,
  Package,
  Users,
  AlertTriangle,
  ArrowRight
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '@/components/ui'
import { salesService, warehouseService, customersService } from '@/services'
import { formatMoney, formatNumber } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'

export default function Dashboard() {
  const { user } = useAuthStore()

  // Fetch daily summary
  const { data: dailySummary, isLoading: loadingSummary } = useQuery({
    queryKey: ['daily-summary'],
    queryFn: () => salesService.getDailySummary(),
  })

  // Fetch low stock products
  const { data: lowStock } = useQuery({
    queryKey: ['low-stock'],
    queryFn: () => warehouseService.getLowStock(),
  })

  // Fetch debtors
  const { data: debtorsData } = useQuery({
    queryKey: ['debtors'],
    queryFn: () => customersService.getDebtors(),
  })

  const stats = [
    {
      title: "Bugungi sotuvlar",
      value: formatNumber(dailySummary?.total_sales || 0),
      icon: ShoppingCart,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: "Umumiy summa",
      value: formatMoney(dailySummary?.total_amount || 0, false),
      icon: DollarSign,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: "To'langan",
      value: formatMoney(dailySummary?.total_paid || 0, false),
      icon: CreditCard,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: "Qarzga",
      value: formatMoney(dailySummary?.total_debt || 0, false),
      icon: TrendingUp,
      color: dailySummary?.total_debt > 0 ? 'text-warning' : 'text-success',
      bgColor: dailySummary?.total_debt > 0 ? 'bg-warning/10' : 'bg-success/10',
    },
  ]

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-pos-xl font-bold">Xush kelibsiz, {user?.first_name}!</h1>
          <p className="text-text-secondary text-sm lg:text-pos-base">
            {new Date().toLocaleDateString('uz-UZ', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
        <Link to="/pos" className="w-full sm:w-auto">
          <Button size="lg" variant="success" className="w-full sm:w-auto">
            <ShoppingCart className="w-5 h-5 lg:w-6 lg:h-6 mr-2" />
            Kassa ochish
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-3 lg:p-6">
              <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-4">
                <div className={`p-2.5 lg:p-4 rounded-xl ${stat.bgColor} w-fit`}>
                  <stat.icon className={`w-5 h-5 lg:w-8 lg:h-8 ${stat.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-text-secondary text-xs lg:text-sm truncate">{stat.title}</p>
                  <p className="text-base lg:text-pos-lg font-bold truncate">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Low Stock Alert */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-4 lg:p-6">
            <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
              <AlertTriangle className="w-5 h-5 lg:w-6 lg:h-6 text-warning" />
              Kam qoldiqlar
            </CardTitle>
            <Link to="/warehouse">
              <Button variant="ghost" size="sm" className="text-sm">
                Barchasi <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-4 lg:p-6 pt-0 lg:pt-0">
            {lowStock && lowStock.length > 0 ? (
              <div className="space-y-2 lg:space-y-3">
                {lowStock.slice(0, 5).map((item: any) => (
                  <div key={item.product_id} className="flex items-center justify-between p-2.5 lg:p-3 bg-warning/5 rounded-xl">
                    <div className="flex items-center gap-2 lg:gap-3 min-w-0 flex-1">
                      <Package className="w-4 h-4 lg:w-5 lg:h-5 text-warning flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="font-medium text-sm lg:text-base block truncate">{item.product_name}</span>
                        <p className="text-xs text-text-secondary">
                          Min: {item.min_stock} {item.base_uom_symbol}
                        </p>
                      </div>
                    </div>
                    <Badge variant="warning" className="ml-2 flex-shrink-0 text-xs lg:text-sm">
                      {item.current_stock} {item.base_uom_symbol}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-secondary text-center py-6 lg:py-8 text-sm lg:text-base">
                Kam qoldiqli tovarlar yo'q
              </p>
            )}
          </CardContent>
        </Card>

        {/* Debtors */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-4 lg:p-6">
            <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
              <Users className="w-5 h-5 lg:w-6 lg:h-6 text-danger" />
              Qarzdorlar
            </CardTitle>
            <Link to="/customers">
              <Button variant="ghost" size="sm" className="text-sm">
                Barchasi <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-4 lg:p-6 pt-0 lg:pt-0">
            {debtorsData?.data && debtorsData.data.length > 0 ? (
              <div className="space-y-2 lg:space-y-3">
                {debtorsData.data.slice(0, 5).map((customer: any) => (
                  <div key={customer.id} className="flex items-center justify-between p-2.5 lg:p-3 bg-danger/5 rounded-xl">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm lg:text-base truncate">{customer.name}</p>
                      <p className="text-xs lg:text-sm text-text-secondary">{customer.phone}</p>
                    </div>
                    <Badge variant="danger" className="ml-2 flex-shrink-0 text-xs lg:text-sm">
                      {formatMoney(customer.current_debt)}
                    </Badge>
                  </div>
                ))}
                {debtorsData.total_debt > 0 && (
                  <div className="pt-3 border-t border-border">
                    <div className="flex justify-between text-sm lg:text-pos-base font-bold">
                      <span>Jami qarz:</span>
                      <span className="text-danger">{formatMoney(debtorsData.total_debt)}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-text-secondary text-center py-6 lg:py-8 text-sm lg:text-base">
                Qarzdor mijozlar yo'q
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="p-4 lg:p-6">
          <CardTitle className="text-base lg:text-lg">Tezkor harakatlar</CardTitle>
        </CardHeader>
        <CardContent className="p-4 lg:p-6 pt-0 lg:pt-0">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
            <Link to="/pos">
              <Button variant="success" size="lg" className="w-full text-sm lg:text-base py-3 lg:py-4">
                <ShoppingCart className="w-5 h-5 lg:w-6 lg:h-6 mr-1.5 lg:mr-2" />
                <span className="hidden sm:inline">Yangi </span>sotuv
              </Button>
            </Link>
            <Link to="/products">
              <Button variant="outline" size="lg" className="w-full text-sm lg:text-base py-3 lg:py-4">
                <Package className="w-5 h-5 lg:w-6 lg:h-6 mr-1.5 lg:mr-2" />
                <span className="hidden sm:inline">Tovar </span>qo'shish
              </Button>
            </Link>
            <Link to="/warehouse">
              <Button variant="outline" size="lg" className="w-full text-sm lg:text-base py-3 lg:py-4">
                <TrendingUp className="w-5 h-5 lg:w-6 lg:h-6 mr-1.5 lg:mr-2" />
                <span className="hidden sm:inline">Kirim </span>qilish
              </Button>
            </Link>
            <Link to="/customers">
              <Button variant="outline" size="lg" className="w-full text-sm lg:text-base py-3 lg:py-4">
                <Users className="w-5 h-5 lg:w-6 lg:h-6 mr-1.5 lg:mr-2" />
                <span className="hidden sm:inline">Mijoz </span>qo'shish
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
