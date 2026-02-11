import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Mail, MessageSquare, Smartphone, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'

export default function NotificationsDocs() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/admin/settings">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Documentação de Notificações
          </h1>
          <p className="text-muted-foreground">
            Guia de configuração para provedores de mensagens.
          </p>
        </div>
      </div>

      <Tabs defaultValue="email">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="email">Email (SMTP)</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp API</TabsTrigger>
          <TabsTrigger value="sms">SMS Gateway</TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" /> Configuração SMTP
              </CardTitle>
              <CardDescription>
                Para envio de e-mails transacionais.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger>Resend (Recomendado)</AccordionTrigger>
                  <AccordionContent className="prose text-sm text-muted-foreground">
                    1. Crie uma conta em{' '}
                    <a
                      href="https://resend.com"
                      target="_blank"
                      className="text-primary"
                    >
                      resend.com
                    </a>
                    .<br />
                    2. Gere uma API Key.
                    <br />
                    3. Verifique seu domínio.
                    <br />
                    4. No painel, utilize as credenciais SMTP fornecidas pelo
                    Resend (Host: smtp.resend.com, Port: 465).
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                  <AccordionTrigger>SMTP Genérico</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    Você pode utilizar qualquer provedor SMTP (Gmail, Outlook,
                    Amazon SES). Certifique-se de usar a porta 587 (TLS) ou 465
                    (SSL).
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" /> WhatsApp Business API
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                <AccordionItem value="cloud-api">
                  <AccordionTrigger>Meta Cloud API</AccordionTrigger>
                  <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                    <p>Integração oficial sem intermediários.</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Acesse developers.facebook.com e crie um App.</li>
                      <li>Adicione o produto WhatsApp.</li>
                      <li>Obtenha o Token Permanente em "System Users".</li>
                      <li>Configure o Webhook com a URL do seu backend.</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="evolution">
                  <AccordionTrigger>Evolution API</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    Solução open-source para conexão via QR Code. Instale a
                    Evolution API via Docker, crie uma instância e conecte o
                    aparelho. Utilize a API Key Global e o nome da instância nas
                    configurações.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sms" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" /> SMS Gateway
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Atualmente suportamos integração via Twilio ou SNS (AWS). Insira
                as credenciais de API nas configurações globais da organização.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
