import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Loader2, RotateCcw, Eye, Printer, Type, Maximize2, Phone, MessageSquare, Calculator } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button, Input, Card, CardContent } from '@/components/ui'
import api from '@/services/api'

// Default receipt config
const DEFAULT_CONFIG = {
  // Company info
  companyName: 'INTER PROFNASTIL',
  phone1: '+998 99 964 12 22',
  phone2: '+998 90 557 80 30',
  thanksMessage: '★ RAHMAT! ★',

  // Widths
  bodyWidth: 78,        // mm
  bodyPadding: 0.5,     // mm
  pageMarginSide: 0.5,  // mm

  // Logo
  logoHeight: 30,       // px
  showLogo: true,

  // Header fonts
  companyNameSize: 16,  // px
  companyNameWeight: 900,
  dateSize: 13,

  // Customer section
  customerFontSize: 12,

  // Table
  tableFontSize: 12,
  productNameSize: 12,
  productPriceSize: 11,
  qtySize: 12,
  sumSize: 12,
  tfootSize: 12,
  colProductWidth: 48,  // %
  colQtyWidth: 24,      // %
  colSumWidth: 28,      // %

  // Grand total
  grandTotalLabelSize: 13,
  grandTotalAmountSize: 20,
  grandTotalWeight: 900,
  grandTotalBorder: 2,  // px

  // Calc info table (calculator details on receipt)
  showCalcInfo: true,
  calcInfoSize: 10,
  calcInfoHeaderSize: 10,
  tableBodyWeight: 900,

  // Footer
  thanksSize: 14,
  thanksWeight: 900,
  contactSize: 13,
  contactWeight: 900,

  // Tear space
  tearSpaceHeight: 20,  // mm
}

type ReceiptConfig = typeof DEFAULT_CONFIG

// Section component for grouping settings
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-bold text-gray-700 border-b pb-2">
        {icon}
        {title}
      </div>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  )
}

// Single config row
function ConfigRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-xs font-medium text-gray-600 flex-shrink-0 min-w-0">{label}</label>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

// Number input with px/mm suffix
function NumInput({
  value,
  onChange,
  suffix = 'px',
  min = 0,
  max = 999,
  step = 1,
  width = 'w-20'
}: {
  value: number
  onChange: (v: number) => void
  suffix?: string
  min?: number
  max?: number
  step?: number
  width?: string
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className={`${width} h-8 px-2 text-xs border border-gray-300 rounded text-center focus:ring-1 focus:ring-blue-500 focus:border-blue-500`}
      />
      <span className="text-xs text-gray-400 w-6">{suffix}</span>
    </div>
  )
}

// Text input
function TextInput({
  value,
  onChange,
  placeholder = ''
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-8 px-2 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
    />
  )
}

export default function ReceiptSettings() {
  const queryClient = useQueryClient()
  const [config, setConfig] = useState<ReceiptConfig>(DEFAULT_CONFIG)

  // Load saved config
  const { data: savedConfig, isLoading } = useQuery({
    queryKey: ['receipt-config'],
    queryFn: async () => {
      const response = await api.get('/settings/receipt-config')
      return response.data?.data
    }
  })

  // Apply saved config on load
  useEffect(() => {
    if (savedConfig && Object.keys(savedConfig).length > 0) {
      setConfig(prev => ({ ...prev, ...savedConfig }))
    }
  }, [savedConfig])

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.put('/settings/receipt-config', { config })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt-config'] })
      toast.success('Chek sozlamalari saqlandi!')
    },
    onError: () => {
      toast.error('Xatolik yuz berdi')
    }
  })

  // Update config helper
  const set = useCallback((key: keyof ReceiptConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }, [])

  // Reset to defaults
  const handleReset = () => {
    setConfig(DEFAULT_CONFIG)
    toast.success("Standart sozlamalarga qaytarildi")
  }

  // Generate receipt preview HTML
  const previewHTML = `
    <div style="
      font-family: 'Courier New', monospace;
      font-size: ${config.tableFontSize}px;
      width: ${config.bodyWidth}mm;
      padding: 0 ${config.bodyPadding}mm;
      color: #000;
      background: #fff;
    ">
      <!-- Header -->
      <div style="text-align:center; padding-bottom:1px;">
        ${config.showLogo ? `<div style="height:${config.logoHeight}px; background:#f0f0f0; margin:0 auto 2px; display:flex; align-items:center; justify-content:center; max-width:40mm; border-radius:4px;">
          <span style="font-size:9px; color:#999;">LOGO</span>
        </div>` : ''}
        <div style="font-size:${config.companyNameSize}px; font-weight:${config.companyNameWeight}; margin:1px 0; letter-spacing:0.5px;">
          ${config.companyName}
        </div>
        <div style="font-size:${config.dateSize}px; font-weight:bold;">
          24.02.2026 14:30
        </div>
      </div>

      <!-- Divider -->
      <div style="border-top:1px dashed #000; margin:2px 0;"></div>

      <!-- Customer -->
      <div style="padding:2px 0; border-top:1px dashed #000; border-bottom:1px dashed #000; font-size:${config.customerFontSize}px; margin:2px 0;">
        <p style="margin:1px 0; font-weight:bold;">Mijoz: Aliyev Vali</p>
        <p style="margin:1px 0; font-weight:bold;">Tel: +998 90 123 45 67</p>
      </div>

      <!-- Table - Hisob-kitob format -->
      <table style="width:100%; border-collapse:collapse; margin:3px 0; table-layout:fixed;">
        <thead>
          <tr>
            <th style="border:1px solid #000; padding:2px; font-size:${config.calcInfoHeaderSize}px; font-weight:900; text-align:left; width:28%;">Tovar</th>
            <th style="border:1px solid #000; padding:2px; font-size:${config.calcInfoHeaderSize}px; font-weight:900; text-align:center; width:34%;">Soni</th>
            <th style="border:1px solid #000; padding:2px; font-size:${config.calcInfoHeaderSize}px; font-weight:900; text-align:right; width:18%;">Narxi</th>
            <th style="border:1px solid #000; padding:2px; font-size:${config.calcInfoHeaderSize}px; font-weight:900; text-align:right; width:20%;">Summa</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border:1px solid #000; padding:2px; font-size:${config.calcInfoSize}px; font-weight:${config.tableBodyWeight}; word-break:break-word;">1. Profnastil C-8</td>
            <td style="border:1px solid #000; padding:2px; font-size:${config.calcInfoSize}px; font-weight:${config.tableBodyWeight}; text-align:center; word-break:break-word;">
              ${config.showCalcInfo ? '12 dona × 2.5 m = 30 m' : '30 metr'}
            </td>
            <td style="border:1px solid #000; padding:2px; font-size:${config.calcInfoSize}px; font-weight:${config.tableBodyWeight}; text-align:right;">85 000</td>
            <td style="border:1px solid #000; padding:2px; font-size:${config.calcInfoSize}px; font-weight:${config.tableBodyWeight}; text-align:right;">2 550 000</td>
          </tr>
          <tr>
            <td style="border:1px solid #000; padding:2px; font-size:${config.calcInfoSize}px; font-weight:${config.tableBodyWeight}; word-break:break-word;">2. Temir truba</td>
            <td style="border:1px solid #000; padding:2px; font-size:${config.calcInfoSize}px; font-weight:${config.tableBodyWeight}; text-align:center; word-break:break-word;">
              ${config.showCalcInfo ? '3 dona × 2 m = 6 m' : '6 metr'}
            </td>
            <td style="border:1px solid #000; padding:2px; font-size:${config.calcInfoSize}px; font-weight:${config.tableBodyWeight}; text-align:right;">45 000</td>
            <td style="border:1px solid #000; padding:2px; font-size:${config.calcInfoSize}px; font-weight:${config.tableBodyWeight}; text-align:right;">270 000</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="border:1px solid #000; padding:2px; text-align:right; font-weight:900; font-size:${config.tfootSize}px;">Jami (2):</td>
            <td style="border:1px solid #000; padding:2px; text-align:right; font-weight:900; font-size:${config.tfootSize}px;">2 820 000</td>
          </tr>
        </tfoot>
      </table>

      <!-- Grand Total -->
      <div style="border:${config.grandTotalBorder}px solid #000; padding:4px; margin:3px 0; text-align:center;">
        <div style="font-size:${config.grandTotalLabelSize}px; font-weight:${config.grandTotalWeight};">JAMI:</div>
        <div style="font-size:${config.grandTotalAmountSize}px; font-weight:${config.grandTotalWeight}; letter-spacing:0.5px;">1 290 000</div>
      </div>

      <!-- Footer -->
      <div style="text-align:center; padding-top:3px; border-top:1px dashed #000;">
        <p style="font-size:${config.thanksSize}px; font-weight:${config.thanksWeight}; margin-bottom:2px;">${config.thanksMessage}</p>
        <p style="font-size:${config.contactSize}px; font-weight:${config.contactWeight}; margin:1px 0;">${config.phone1}</p>
        ${config.phone2 ? `<p style="font-size:${config.contactSize}px; font-weight:${config.contactWeight}; margin:1px 0;">${config.phone2}</p>` : ''}
      </div>

      <!-- Tear space indicator -->
      <div style="height:${config.tearSpaceHeight}mm; min-height:${config.tearSpaceHeight}mm; border-top:1px dashed #ccc; margin-top:3px; display:flex; align-items:center; justify-content:center;">
        <span style="font-size:8px; color:#ccc;">✂ qirqish joyi (${config.tearSpaceHeight}mm)</span>
      </div>
    </div>
  `

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <Card>
      <CardContent className="p-4 lg:p-6">
        {/* Title */}
        <div className="flex items-center justify-between mb-4 lg:mb-6">
          <div className="flex items-center gap-2 lg:gap-3">
            <div className="p-2 lg:p-3 bg-orange-100 rounded-xl">
              <Printer className="w-6 h-6 lg:w-8 lg:h-8 text-orange-600" />
            </div>
            <div>
              <h2 className="text-base lg:text-lg font-bold">Chek dizayni</h2>
              <p className="text-xs text-text-secondary">Chekni o'zingizga moslab sozlang</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="w-4 h-4 mr-1" />
              Standart
            </Button>
            <Button
              variant="success"
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              Saqlash
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: Controls */}
          <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-2">

            {/* Company Info */}
            <Section title="Kompaniya ma'lumotlari" icon={<MessageSquare className="w-4 h-4" />}>
              <ConfigRow label="Kompaniya nomi">
                <TextInput value={config.companyName} onChange={(v) => set('companyName', v)} />
              </ConfigRow>
              <ConfigRow label="Telefon 1">
                <TextInput value={config.phone1} onChange={(v) => set('phone1', v)} placeholder="+998..." />
              </ConfigRow>
              <ConfigRow label="Telefon 2">
                <TextInput value={config.phone2} onChange={(v) => set('phone2', v)} placeholder="+998..." />
              </ConfigRow>
              <ConfigRow label="Rahmat yozuvi">
                <TextInput value={config.thanksMessage} onChange={(v) => set('thanksMessage', v)} />
              </ConfigRow>
            </Section>

            {/* Page Layout */}
            <Section title="Sahifa o'lchamlari" icon={<Maximize2 className="w-4 h-4" />}>
              <ConfigRow label="Chek kengligi">
                <NumInput value={config.bodyWidth} onChange={(v) => set('bodyWidth', v)} suffix="mm" min={60} max={80} step={0.5} />
              </ConfigRow>
              <ConfigRow label="Yon bo'shliq">
                <NumInput value={config.bodyPadding} onChange={(v) => set('bodyPadding', v)} suffix="mm" min={0} max={5} step={0.5} />
              </ConfigRow>
              <ConfigRow label="Print yon chet">
                <NumInput value={config.pageMarginSide} onChange={(v) => set('pageMarginSide', v)} suffix="mm" min={0} max={5} step={0.5} />
              </ConfigRow>
              <ConfigRow label="Qirqish joyi">
                <NumInput value={config.tearSpaceHeight} onChange={(v) => set('tearSpaceHeight', v)} suffix="mm" min={0} max={40} step={1} />
              </ConfigRow>
            </Section>

            {/* Logo */}
            <Section title="Logo" icon={<Eye className="w-4 h-4" />}>
              <ConfigRow label="Logoni ko'rsatish">
                <input
                  type="checkbox"
                  checked={config.showLogo}
                  onChange={(e) => set('showLogo', e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </ConfigRow>
              <ConfigRow label="Logo balandligi">
                <NumInput value={config.logoHeight} onChange={(v) => set('logoHeight', v)} suffix="px" min={10} max={80} />
              </ConfigRow>
            </Section>

            {/* Header Fonts */}
            <Section title="Sarlavha (nomi, sana)" icon={<Type className="w-4 h-4" />}>
              <ConfigRow label="Kompaniya nomi">
                <NumInput value={config.companyNameSize} onChange={(v) => set('companyNameSize', v)} min={10} max={24} />
              </ConfigRow>
              <ConfigRow label="Nomi qalinligi">
                <select
                  value={config.companyNameWeight}
                  onChange={(e) => set('companyNameWeight', Number(e.target.value))}
                  className="h-8 px-2 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                >
                  <option value={400}>Normal (400)</option>
                  <option value={700}>Qalin (700)</option>
                  <option value={900}>Juda qalin (900)</option>
                </select>
              </ConfigRow>
              <ConfigRow label="Sana o'lchami">
                <NumInput value={config.dateSize} onChange={(v) => set('dateSize', v)} min={8} max={18} />
              </ConfigRow>
            </Section>

            {/* Customer */}
            <Section title="Mijoz bo'limi" icon={<Phone className="w-4 h-4" />}>
              <ConfigRow label="Shrift o'lchami">
                <NumInput value={config.customerFontSize} onChange={(v) => set('customerFontSize', v)} min={8} max={18} />
              </ConfigRow>
            </Section>

            {/* Table */}
            <Section title="Tovarlar jadvali" icon={<Type className="w-4 h-4" />}>
              <ConfigRow label="Jadval shrifti">
                <NumInput value={config.tableFontSize} onChange={(v) => set('tableFontSize', v)} min={8} max={18} />
              </ConfigRow>
              <ConfigRow label="Tovar nomi">
                <NumInput value={config.productNameSize} onChange={(v) => set('productNameSize', v)} min={8} max={18} />
              </ConfigRow>
              <ConfigRow label="Narxi">
                <NumInput value={config.productPriceSize} onChange={(v) => set('productPriceSize', v)} min={7} max={16} />
              </ConfigRow>
              <ConfigRow label="Miqdor">
                <NumInput value={config.qtySize} onChange={(v) => set('qtySize', v)} min={8} max={18} />
              </ConfigRow>
              <ConfigRow label="Summa">
                <NumInput value={config.sumSize} onChange={(v) => set('sumSize', v)} min={8} max={18} />
              </ConfigRow>
              <ConfigRow label="Jami qatori">
                <NumInput value={config.tfootSize} onChange={(v) => set('tfootSize', v)} min={8} max={18} />
              </ConfigRow>
              <div className="pt-1 border-t">
                <p className="text-[10px] text-gray-400 mb-1">Ustun kengliklari (jami 100%):</p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-500">Tovar</label>
                    <NumInput value={config.colProductWidth} onChange={(v) => set('colProductWidth', v)} suffix="%" min={30} max={70} />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-500">Soni</label>
                    <NumInput value={config.colQtyWidth} onChange={(v) => set('colQtyWidth', v)} suffix="%" min={10} max={40} />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-500">Summa</label>
                    <NumInput value={config.colSumWidth} onChange={(v) => set('colSumWidth', v)} suffix="%" min={15} max={45} />
                  </div>
                </div>
              </div>
            </Section>

            {/* Calc Info */}
            <Section title="Kalkulyator jadvali" icon={<Calculator className="w-4 h-4" />}>
              <ConfigRow label="Hisob ko'rsatish">
                <input
                  type="checkbox"
                  checked={config.showCalcInfo}
                  onChange={(e) => set('showCalcInfo', e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </ConfigRow>
              <ConfigRow label="Sarlavha o'lchami">
                <NumInput value={config.calcInfoHeaderSize} onChange={(v) => set('calcInfoHeaderSize', v)} min={7} max={18} />
              </ConfigRow>
              <ConfigRow label="Jadval shrifti">
                <NumInput value={config.calcInfoSize} onChange={(v) => set('calcInfoSize', v)} min={7} max={18} />
              </ConfigRow>
              <ConfigRow label="Jadval qalinligi">
                <NumInput value={config.tableBodyWeight} onChange={(v) => set('tableBodyWeight', v)} suffix="" min={100} max={9999} step={1} />
              </ConfigRow>
              <ConfigRow label="Jami qator o'lchami">
                <NumInput value={config.tfootSize} onChange={(v) => set('tfootSize', v)} min={8} max={18} />
              </ConfigRow>
              <p className="text-[10px] text-gray-400">
                Jadval: Tovar | Soni (12 dona × 2.5 m = 30 m) | Narxi | Summa
              </p>
            </Section>

            {/* Grand Total */}
            <Section title="JAMI summa" icon={<Type className="w-4 h-4" />}>
              <ConfigRow label="Label o'lchami">
                <NumInput value={config.grandTotalLabelSize} onChange={(v) => set('grandTotalLabelSize', v)} min={10} max={20} />
              </ConfigRow>
              <ConfigRow label="Summa o'lchami">
                <NumInput value={config.grandTotalAmountSize} onChange={(v) => set('grandTotalAmountSize', v)} min={14} max={30} />
              </ConfigRow>
              <ConfigRow label="Qalinligi">
                <select
                  value={config.grandTotalWeight}
                  onChange={(e) => set('grandTotalWeight', Number(e.target.value))}
                  className="h-8 px-2 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                >
                  <option value={700}>Qalin (700)</option>
                  <option value={900}>Juda qalin (900)</option>
                </select>
              </ConfigRow>
              <ConfigRow label="Ramka qalinligi">
                <NumInput value={config.grandTotalBorder} onChange={(v) => set('grandTotalBorder', v)} min={1} max={4} />
              </ConfigRow>
            </Section>

            {/* Footer */}
            <Section title="Pastki qism (Rahmat)" icon={<MessageSquare className="w-4 h-4" />}>
              <ConfigRow label="Rahmat shrifti">
                <NumInput value={config.thanksSize} onChange={(v) => set('thanksSize', v)} min={10} max={20} />
              </ConfigRow>
              <ConfigRow label="Rahmat qalinligi">
                <select
                  value={config.thanksWeight}
                  onChange={(e) => set('thanksWeight', Number(e.target.value))}
                  className="h-8 px-2 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                >
                  <option value={400}>Normal (400)</option>
                  <option value={700}>Qalin (700)</option>
                  <option value={900}>Juda qalin (900)</option>
                </select>
              </ConfigRow>
              <ConfigRow label="Telefon shrifti">
                <NumInput value={config.contactSize} onChange={(v) => set('contactSize', v)} min={8} max={18} />
              </ConfigRow>
              <ConfigRow label="Telefon qalinligi">
                <select
                  value={config.contactWeight}
                  onChange={(e) => set('contactWeight', Number(e.target.value))}
                  className="h-8 px-2 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                >
                  <option value={400}>Normal (400)</option>
                  <option value={700}>Qalin (700)</option>
                  <option value={900}>Juda qalin (900)</option>
                </select>
              </ConfigRow>
            </Section>

          </div>

          {/* RIGHT: Live Preview */}
          <div className="lg:sticky lg:top-4">
            <div className="bg-gray-100 rounded-xl p-4 flex flex-col items-center">
              <div className="flex items-center gap-2 mb-3 text-sm font-bold text-gray-600">
                <Eye className="w-4 h-4" />
                Jonli ko'rinish
              </div>
              <div
                className="bg-white shadow-lg rounded-sm border border-gray-200 overflow-hidden"
                style={{ maxWidth: '100%' }}
              >
                <div dangerouslySetInnerHTML={{ __html: previewHTML }} />
              </div>
              <p className="text-[10px] text-gray-400 mt-2 text-center">
                Bu faqat ko'rinish. Haqiqiy chek printerdan chiqganda biroz farq qilishi mumkin.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}