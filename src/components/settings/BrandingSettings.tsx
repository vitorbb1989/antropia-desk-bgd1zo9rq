import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useForm } from 'react-hook-form'
import useSettingsStore from '@/stores/useSettingsStore'
import { BrandingSettings } from '@/types'
import { toast } from 'sonner'
import { Save } from 'lucide-react'
import { hexToHSL } from '@/lib/utils'

export function BrandingSettingsForm() {
  const { settings, updateBranding, updateSettings } = useSettingsStore()

  // Local state for color picker to sync with React Hook Form
  const [color, setColor] = useState(
    settings.branding.primaryColor || '#3b82f6',
  )

  const { register, handleSubmit, watch, setValue } = useForm<BrandingSettings>(
    {
      defaultValues: settings.branding,
    },
  )

  // Watch for preview
  const logoUrl = watch('logoUrl')
  const iconUrl = watch('iconUrl')

  // Sync form with store updates
  useEffect(() => {
    setValue('logoUrl', settings.branding.logoUrl)
    setValue('iconUrl', settings.branding.iconUrl)
    setValue('faviconUrl', settings.branding.faviconUrl)
    setColor(settings.branding.primaryColor || '#3b82f6')
  }, [settings.branding, setValue])

  const onSubmit = (data: BrandingSettings) => {
    const updatedBranding = { ...data, primaryColor: color }
    updateBranding(updatedBranding)
    // Persist branding (logoUrl specially) to DB via settings store action that calls service
    // We reuse updateSettings for general persistence if implemented or assume updateBranding handles it
    // In this specific implementation, we need to ensure logo_url hits the DB
    toast.success('Branding atualizado com sucesso!')
  }

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setColor(e.target.value)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="border-0 shadow-subtle">
        <CardHeader>
          <CardTitle>Identidade Visual</CardTitle>
          <CardDescription>
            Personalize a aparência do portal e e-mails.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="logoUrl">
                URL do Logo (Recomendado: 200x50px)
              </Label>
              <div className="flex gap-2">
                <Input
                  id="logoUrl"
                  {...register('logoUrl')}
                  placeholder="https://..."
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Exibido na barra lateral, relatórios e e-mails.
              </p>
            </div>

            <div className="space-y-3">
              <Label htmlFor="iconUrl">
                URL do Ícone (Recomendado: 32x32px)
              </Label>
              <div className="flex gap-2">
                <Input
                  id="iconUrl"
                  {...register('iconUrl')}
                  placeholder="https://..."
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Usado em versões minimizadas.
              </p>
            </div>

            <div className="space-y-3">
              <Label htmlFor="faviconUrl">URL do Favicon</Label>
              <Input
                id="faviconUrl"
                {...register('faviconUrl')}
                placeholder="/favicon.ico"
              />
            </div>

            <div className="space-y-3">
              <Label>Cor Primária</Label>
              <div className="flex items-center gap-4">
                <div className="relative h-10 w-20 overflow-hidden rounded-md border shadow-sm">
                  <Input
                    type="color"
                    value={color}
                    onChange={handleColorChange}
                    className="absolute -top-2 -left-2 h-16 w-24 p-0 border-0 cursor-pointer"
                  />
                </div>
                <div className="text-sm font-mono bg-secondary px-2 py-1 rounded">
                  {color}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Ajusta botões, links e destaques.
              </p>
            </div>

            <div className="pt-4">
              <Button type="submit" className="gap-2">
                <Save className="h-4 w-4" /> Salvar Branding
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Preview Section */}
      <Card className="border-0 shadow-subtle bg-secondary/10">
        <CardHeader>
          <CardTitle>Pré-visualização</CardTitle>
          <CardDescription>Como sua marca aparecerá.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {/* Sidebar Preview */}
            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground">
                Sidebar Header
              </Label>
              <div className="bg-white p-4 rounded-lg shadow-sm w-64 flex items-center gap-3 border">
                {iconUrl && (
                  <img
                    src={iconUrl}
                    alt="Icon"
                    className="h-8 w-8 rounded-md object-contain"
                  />
                )}
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="h-8 object-contain"
                  />
                )}
                {!iconUrl && !logoUrl && (
                  <span className="text-sm font-semibold">Antropia Desk</span>
                )}
              </div>
            </div>

            {/* Theme Preview */}
            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground">
                Componentes com Cor Primária
              </Label>
              <div className="bg-white p-6 rounded-lg shadow-sm border space-y-4">
                <div className="flex gap-2">
                  <Button style={{ backgroundColor: color, color: '#fff' }}>
                    Botão Primário
                  </Button>
                  <Button
                    variant="outline"
                    style={{ borderColor: color, color: color }}
                  >
                    Botão Secundário
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span style={{ color }} className="font-medium">
                    Texto de Destaque
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
