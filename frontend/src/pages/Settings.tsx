import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings as SettingsIcon, DollarSign, Save, RefreshCw, Loader2, Send, Plus, Trash2, CheckCircle, XCircle, Clock, MessageSquare, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, Input, Card, CardContent, Badge } from '@/components/ui'
import api from '@/services/api'
import { formatNumber, formatDateTimeTashkent } from '@/lib/utils'

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const [usdRate, setUsdRate] = useState('')
  const [newDirectorId, setNewDirectorId] = useState('')
  const [testingId, setTestingId] = useState<string | null>(null)
  
  // Company phone settings
  const [companyPhone1, setCompanyPhone1] = useState('')
  const [companyPhone2, setCompanyPhone2] = useState('')
  
  // Telegram group settings state
  const [groupChatId, setGroupChatId] = useState('')
  const [reportTime, setReportTime] = useState('19:00')
  const [reportEnabled, setReportEnabled] = useState(false)
  const [sendingReport, setSendingReport] = useState(false)

  // Fetch exchange rate
  const { data: exchangeRateData, isLoading } = useQuery({
    queryKey: ['exchange-rate'],
    queryFn: async () => {
      const response = await api.get('/settings/exchange-rate')
      return response.data
    }
  })
  
  // Set USD rate when data loads
  useEffect(() => {
    if (exchangeRateData?.usd_rate) {
      setUsdRate(exchangeRateData.usd_rate.toString())
    }
  }, [exchangeRateData])

  // Fetch company phones
  const { data: companyPhonesData } = useQuery({
    queryKey: ['company-phones'],
    queryFn: async () => {
      const response = await api.get('/settings/company-phones')
      return response.data
    }
  })
  
  // Set company phones when data loads
  useEffect(() => {
    if (companyPhonesData?.data) {
      setCompanyPhone1(companyPhonesData.data.phone1 || '')
      setCompanyPhone2(companyPhonesData.data.phone2 || '')
    }
  }, [companyPhonesData])

  // Fetch director telegram IDs
  const { data: telegramData, isLoading: telegramLoading } = useQuery({
    queryKey: ['telegram-directors'],
    queryFn: async () => {
      const response = await api.get('/settings/telegram/directors')
      return response.data
    }
  })

  // Fetch telegram group settings
  const { data: groupSettingsData, isLoading: groupSettingsLoading, refetch: refetchGroupSettings } = useQuery({
    queryKey: ['telegram-group-settings'],
    queryFn: async () => {
      const response = await api.get('/settings/telegram/group-settings')
      return response.data
    },
    staleTime: 0, // Always fetch fresh data
    cacheTime: 0  // Don't cache
  })
  
  // Set group settings when data loads
  useEffect(() => {
    if (groupSettingsData?.data) {
      setGroupChatId(groupSettingsData.data.group_chat_id || '')
      setReportTime(groupSettingsData.data.report_time || '19:00')
      setReportEnabled(groupSettingsData.data.is_enabled || false)
    }
  }, [groupSettingsData])

  // Update telegram group settings mutation
  const updateGroupSettings = useMutation({
    mutationFn: async (data: { group_chat_id: string; report_time: string; is_enabled: boolean }) => {
      const response = await api.put('/settings/telegram/group-settings', data)
      return response.data
    },
    onSuccess: () => {
      toast.success('Guruh sozlamalari saqlandi!')
      // Refetch to ensure latest data
      refetchGroupSettings()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Xatolik yuz berdi')
    }
  })

  // Send daily report now mutation
  const sendDailyReport = useMutation({
    mutationFn: async () => {
      const response = await api.post('/settings/telegram/send-daily-report')
      return response.data
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Kunlik hisobot yuborildi!')
      } else {
        toast.error(data.message || 'Hisobot yuborilmadi')
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Xatolik yuz berdi')
    },
    onSettled: () => {
      setSendingReport(false)
    }
  })

  // Update company phones mutation
  const updateCompanyPhones = useMutation({
    mutationFn: async () => {
      const response = await api.put(`/settings/company-phones?phone1=${encodeURIComponent(companyPhone1)}&phone2=${encodeURIComponent(companyPhone2)}`)
      return response.data
    },
    onSuccess: () => {
      toast.success('Telefon raqamlari saqlandi!')
      queryClient.invalidateQueries({ queryKey: ['company-phones'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Xatolik yuz berdi')
    }
  })

  // Update director telegram IDs mutation
  const updateDirectorIds = useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await api.put('/settings/telegram/directors', { telegram_ids: ids })
      return response.data
    },
    onSuccess: () => {
      toast.success('Direktor Telegram ID lari yangilandi!')
      queryClient.invalidateQueries({ queryKey: ['telegram-directors'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Xatolik yuz berdi')
    }
  })

  // Test telegram notification mutation
  const testTelegramNotification = useMutation({
    mutationFn: async (telegramId: string) => {
      const response = await api.post(`/settings/telegram/test?telegram_id=${telegramId}`)
      return response.data
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Test xabar yuborildi!')
      } else {
        toast.error(data.message || 'Xabar yuborilmadi')
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Xatolik yuz berdi')
    },
    onSettled: () => {
      setTestingId(null)
    }
  })

  const handleAddDirectorId = () => {
    if (!newDirectorId.trim()) {
      toast.error('Telegram ID kiriting')
      return
    }
    const currentIds = telegramData?.data?.telegram_ids || []
    if (currentIds.includes(newDirectorId.trim())) {
      toast.error('Bu ID allaqachon qo\'shilgan')
      return
    }
    updateDirectorIds.mutate([...currentIds, newDirectorId.trim()])
    setNewDirectorId('')
  }

  const handleRemoveDirectorId = (idToRemove: string) => {
    const currentIds = telegramData?.data?.telegram_ids || []
    updateDirectorIds.mutate(currentIds.filter((id: string) => id !== idToRemove))
  }

  const handleTestTelegram = (telegramId: string) => {
    setTestingId(telegramId)
    testTelegramNotification.mutate(telegramId)
  }

  // Update exchange rate mutation
  const updateExchangeRate = useMutation({
    mutationFn: async (rate: number) => {
      const response = await api.put('/settings/exchange-rate', { usd_rate: rate })
      return response.data
    },
    onSuccess: () => {
      toast.success('Dollar kursi yangilandi!')
      queryClient.invalidateQueries({ queryKey: ['exchange-rate'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Xatolik yuz berdi')
    }
  })

  const handleSaveExchangeRate = () => {
    const rate = parseFloat(usdRate)
    if (isNaN(rate) || rate <= 0) {
      toast.error('Noto\'g\'ri kurs qiymati')
      return
    }
    updateExchangeRate.mutate(rate)
  }

  // Quick rate buttons
  const quickRates = [12500, 12600, 12700, 12800, 12900, 13000]

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 lg:gap-3">
        <SettingsIcon className="w-6 h-6 lg:w-8 lg:h-8 text-primary" />
        <h1 className="text-xl lg:text-pos-xl font-bold">Sozlamalar</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Exchange Rate Card */}
        <Card>
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center gap-2 lg:gap-3 mb-4 lg:mb-6">
              <div className="p-2 lg:p-3 bg-success/10 rounded-xl">
                <DollarSign className="w-6 h-6 lg:w-8 lg:h-8 text-success" />
              </div>
              <div>
                <h2 className="text-base lg:text-pos-lg font-bold">Dollar kursi</h2>
                <p className="text-xs lg:text-sm text-text-secondary">1 USD = ? so'm</p>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-3 lg:space-y-4">
                {/* Current Rate Display */}
                <div className="bg-gray-50 p-3 lg:p-4 rounded-xl">
                  <p className="text-xs lg:text-sm text-text-secondary mb-1">Joriy kurs:</p>
                  <p className="text-lg lg:text-pos-xl font-bold text-success">
                    1 $ = {formatNumber(exchangeRateData?.usd_rate || 12800)} so'm
                  </p>
                  {exchangeRateData?.updated_at && (
                    <p className="text-[10px] lg:text-xs text-text-secondary mt-1">
                      Oxirgi yangilanish: {formatDateTimeTashkent(exchangeRateData.updated_at)}
                    </p>
                  )}
                </div>

                {/* Input */}
                <div className="space-y-2">
                  <label className="font-medium text-sm lg:text-base">Yangi kurs</label>
                  <Input
                    type="number"
                    value={usdRate}
                    onChange={(e) => setUsdRate(e.target.value)}
                    placeholder="Masalan: 12800"
                    className="text-base lg:text-pos-lg font-bold"
                  />
                </div>

                {/* Quick Rate Buttons */}
                <div className="grid grid-cols-3 gap-1.5 lg:gap-2">
                  {quickRates.map((rate) => (
                    <Button
                      key={rate}
                      variant={usdRate === rate.toString() ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => setUsdRate(rate.toString())}
                      className="text-xs lg:text-sm"
                    >
                      {formatNumber(rate)}
                    </Button>
                  ))}
                </div>

                {/* Save Button */}
                <Button 
                  variant="success" 
                  className="w-full"
                  onClick={handleSaveExchangeRate}
                  disabled={updateExchangeRate.isPending}
                >
                  {updateExchangeRate.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 lg:w-5 lg:h-5 mr-2 animate-spin" />
                      Saqlanmoqda...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 lg:w-5 lg:h-5 mr-2" />
                      Saqlash
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Company Info Card */}
        <Card>
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center gap-2 lg:gap-3 mb-4 lg:mb-6">
              <div className="p-2 lg:p-3 bg-primary/10 rounded-xl">
                <SettingsIcon className="w-6 h-6 lg:w-8 lg:h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-base lg:text-pos-lg font-bold">Kompaniya telefon raqamlari</h2>
                <p className="text-xs lg:text-sm text-text-secondary">Chekda ko'rsatiladigan raqamlar</p>
              </div>
            </div>

            <div className="space-y-3 lg:space-y-4">
              <div className="space-y-2">
                <label className="font-medium text-sm lg:text-base">Telefon 1 (asosiy)</label>
                <Input
                  value={companyPhone1}
                  onChange={(e) => setCompanyPhone1(e.target.value)}
                  placeholder="+998 90 123 45 67"
                />
              </div>

              <div className="space-y-2">
                <label className="font-medium text-sm lg:text-base">Telefon 2 (qo'shimcha)</label>
                <Input
                  value={companyPhone2}
                  onChange={(e) => setCompanyPhone2(e.target.value)}
                  placeholder="+998 90 765 43 21"
                />
              </div>

              <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-800">
                <p>Bu telefon raqamlari chek chiqarilganda pastki qismida ko'rsatiladi.</p>
              </div>

              <Button 
                variant="primary" 
                className="w-full"
                onClick={() => updateCompanyPhones.mutate()}
                disabled={updateCompanyPhones.isPending}
              >
                {updateCompanyPhones.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 lg:w-5 lg:h-5 mr-2 animate-spin" />
                    Saqlanmoqda...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 lg:w-5 lg:h-5 mr-2" />
                    Saqlash
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Telegram Bot Settings Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-500/10 rounded-pos">
                <Send className="w-8 h-8 text-blue-500" />
              </div>
              <div>
                <h2 className="text-pos-lg font-bold">Telegram Bot</h2>
                <p className="text-sm text-text-secondary">VIP mijozlarga habar yuborish</p>
              </div>
            </div>

            {telegramLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Info */}
                <div className="bg-blue-50 p-4 rounded-pos text-sm">
                  <p className="font-medium text-blue-800 mb-2">📱 Telegram Bot qanday ishlaydi?</p>
                  <ul className="text-blue-700 space-y-1 text-xs">
                    <li>• VIP mijoz harid qilganda → Mijozga + Direktorlarga xabar</li>
                    <li>• VIP mijoz qarz to'laganda → Mijozga + Direktorlarga xabar</li>
                    <li>• Har bir xabar bilan Excel fayl ham yuboriladi</li>
                  </ul>
                </div>

                {/* Director IDs List */}
                <div className="space-y-2">
                  <label className="font-medium">Direktor Telegram ID lari</label>
                  <p className="text-xs text-text-secondary mb-2">
                    Har bir harid/to'lov haqida xabar yuboriladi
                  </p>
                  
                  {(telegramData?.data?.telegram_ids || []).length === 0 ? (
                    <p className="text-sm text-text-secondary bg-gray-50 p-3 rounded-pos">
                      Hali hech qanday ID qo'shilmagan
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {telegramData?.data?.telegram_ids.map((id: string) => (
                        <div key={id} className="flex items-center gap-2 bg-gray-50 p-3 rounded-pos">
                          <span className="flex-1 font-mono text-sm">{id}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestTelegram(id)}
                            disabled={testingId === id}
                          >
                            {testingId === id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleRemoveDirectorId(id)}
                            disabled={updateDirectorIds.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add New ID */}
                <div className="flex gap-2">
                  <Input
                    value={newDirectorId}
                    onChange={(e) => setNewDirectorId(e.target.value)}
                    placeholder="Telegram ID kiriting (masalan: 123456789)"
                    className="flex-1"
                  />
                  <Button
                    variant="primary"
                    onClick={handleAddDirectorId}
                    disabled={updateDirectorIds.isPending}
                  >
                    {updateDirectorIds.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Plus className="w-5 h-5" />
                    )}
                  </Button>
                </div>

                {/* Help */}
                <div className="bg-gray-50 p-3 rounded-pos text-xs text-text-secondary">
                  <p className="font-medium mb-1">Telegram ID qanday topiladi?</p>
                  <p>1. @userinfobot ga yozing</p>
                  <p>2. /start bosing</p>
                  <p>3. ID ni ko'chirib qo'shing</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Telegram Group Daily Report Card */}
        <Card>
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center gap-2 lg:gap-3 mb-4 lg:mb-6">
              <div className="p-2 lg:p-3 bg-green-100 rounded-xl">
                <MessageSquare className="w-6 h-6 lg:w-8 lg:h-8 text-green-600" />
              </div>
              <div>
                <h2 className="text-base lg:text-pos-lg font-bold">Kunlik hisobot</h2>
                <p className="text-xs lg:text-sm text-text-secondary">Telegram guruhga avtomatik yuborish</p>
              </div>
            </div>

            {groupSettingsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Group Chat ID */}
                <div className="space-y-2">
                  <label className="font-medium text-sm">Guruh Chat ID</label>
                  <Input
                    type="text"
                    value={groupChatId}
                    onChange={(e) => setGroupChatId(e.target.value)}
                    placeholder="-1001234567890"
                    className="font-mono"
                  />
                  <p className="text-xs text-text-secondary">
                    Botni guruhga qo'shing va @RawDataBot orqali chat ID ni oling
                  </p>
                </div>

                {/* Report Time */}
                <div className="space-y-2">
                  <label className="font-medium text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Hisobot vaqti (24-soat formati)
                  </label>
                  <div className="flex gap-2 items-center">
                    <select
                      value={reportTime.split(':')[0] || '19'}
                      onChange={(e) => {
                        const minute = reportTime.split(':')[1] || '00'
                        setReportTime(`${e.target.value}:${minute}`)
                      }}
                      className="w-20 px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {Array.from({length: 24}, (_, i) => i).map(h => (
                        <option key={h} value={h.toString().padStart(2, '0')}>
                          {h.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                    <span className="text-xl font-bold">:</span>
                    <select
                      value={reportTime.split(':')[1] || '00'}
                      onChange={(e) => {
                        const hour = reportTime.split(':')[0] || '19'
                        setReportTime(`${hour}:${e.target.value}`)
                      }}
                      className="w-20 px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {['00', '15', '30', '45'].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-text-secondary">
                    Har kuni shu vaqtda kunlik hisobot yuboriladi (masalan: 19:00, 21:00)
                  </p>
                </div>

                {/* Enable/Disable */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">Avtomatik yuborish</p>
                    <p className="text-xs text-text-secondary">Har kuni belgilangan vaqtda</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={reportEnabled}
                    onChange={(e) => setReportEnabled(e.target.checked)}
                    className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                  />
                </div>

                {/* Save Button */}
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => {
                    if (!groupChatId.trim()) {
                      toast.error('Guruh Chat ID kiriting')
                      return
                    }
                    updateGroupSettings.mutate({
                      group_chat_id: groupChatId.trim(),
                      report_time: reportTime,
                      is_enabled: reportEnabled
                    })
                  }}
                  disabled={updateGroupSettings.isLoading}
                >
                  {updateGroupSettings.isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <Save className="w-5 h-5 mr-2" />
                  )}
                  Saqlash
                </Button>

                {/* Divider */}
                <div className="border-t border-border pt-4">
                  <p className="text-sm font-medium mb-3">Test</p>
                  
                  {/* Send Now Button */}
                  <Button
                    variant="secondary"
                    className="w-full bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                    onClick={() => {
                      if (!groupChatId.trim()) {
                        toast.error('Avval guruh Chat ID ni kiriting va saqlang')
                        return
                      }
                      setSendingReport(true)
                      sendDailyReport.mutate()
                    }}
                    disabled={sendingReport || !groupChatId.trim()}
                  >
                    {sendingReport ? (
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    ) : (
                      <Send className="w-5 h-5 mr-2" />
                    )}
                    Hozir yuborish
                  </Button>
                  <p className="text-xs text-text-secondary mt-2 text-center">
                    Kunlik hisobotni hozir guruhga yuborish
                  </p>
                </div>

                {/* Help */}
                <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700">
                  <p className="font-medium mb-1">📊 Kunlik hisobotda:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Bugungi sotuvlar soni va summasi</li>
                    <li>Naqd, plastik, o'tkazma bo'yicha</li>
                    <li>Har bir kassirning savdolari</li>
                    <li>Bugungi qarzdorlar ro'yxati</li>
                    <li>Kam qolgan tovarlar</li>
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Info Card */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-pos-lg font-bold mb-4">Tizim ma'lumotlari</h2>
            
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-text-secondary">Versiya</span>
                <Badge variant="primary">1.0.0</Badge>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-text-secondary">API</span>
                <Badge variant="success">Faol</Badge>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-text-secondary">Ma'lumotlar bazasi</span>
                <Badge variant="success">PostgreSQL</Badge>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-text-secondary">Ombor</span>
                <Badge variant="secondary">Asosiy ombor</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sales Settings Card */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-pos-lg font-bold mb-4">Sotuv sozlamalari</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Maksimal chegirma</p>
                  <p className="text-sm text-text-secondary">Sotuvchi bera oladigan maksimal chegirma</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    defaultValue="20"
                    className="w-20 text-center"
                  />
                  <span className="font-medium">%</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Qarzga sotish</p>
                  <p className="text-sm text-text-secondary">Mijozlarga qarzga sotish imkoniyati</p>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Chek chop etish</p>
                  <p className="text-sm text-text-secondary">Har bir sotuvdan keyin avtomatik chop etish</p>
                </div>
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                />
              </div>

              <Button variant="primary" className="w-full">
                <Save className="w-5 h-5 mr-2" />
                Saqlash
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
