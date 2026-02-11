import { TicketStatus } from '@/types'
import { cn } from '@/lib/utils'
import { Check, Circle, Clock, Loader2, PackageCheck } from 'lucide-react'

interface TicketProgressProps {
  status: TicketStatus
}

const STEPS = [
  {
    id: 'open',
    label: 'Aberto',
    statuses: ['RECEIVED'],
    icon: Circle,
  },
  {
    id: 'analysis',
    label: 'Em Análise',
    statuses: ['WAITING_APPROVAL', 'WAITING_CUSTOMER'],
    icon: Clock,
  },
  {
    id: 'progress',
    label: 'Em Atendimento',
    statuses: ['IN_PROGRESS', 'APPROVED'],
    icon: Loader2,
  },
  {
    id: 'resolved',
    label: 'Resolvido',
    statuses: ['CLOSED'],
    icon: PackageCheck,
  },
]

export function TicketProgress({ status }: TicketProgressProps) {
  let activeIndex = 0
  if (status === 'RECEIVED') activeIndex = 0
  else if (status === 'WAITING_APPROVAL' || status === 'WAITING_CUSTOMER')
    activeIndex = 1
  else if (status === 'IN_PROGRESS' || status === 'APPROVED') activeIndex = 2
  else if (status === 'CLOSED') activeIndex = 3
  else activeIndex = 0

  return (
    <div className="w-full bg-white/50 backdrop-blur-sm border border-border/40 rounded-3xl p-6 shadow-subtle mb-6 transition-all hover:shadow-elevation duration-500">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-8 pl-1">
        Progresso Atual
      </h3>
      <div className="relative flex items-center justify-between px-2">
        {/* Connecting Line Background */}
        <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-1 bg-secondary rounded-full -z-10" />

        {/* Connecting Line Active */}
        <div
          className="absolute left-2 top-1/2 -translate-y-1/2 h-1 bg-primary rounded-full -z-10 transition-all duration-700 ease-in-out"
          style={{
            width: `calc(${(activeIndex / (STEPS.length - 1)) * 100}% - 16px)`,
          }}
        />

        {STEPS.map((step, index) => {
          const isCompleted = index < activeIndex
          const isActive = index === activeIndex

          const Icon = step.icon

          return (
            <div
              key={step.id}
              className="flex flex-col items-center gap-3 relative group"
            >
              <div
                className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all duration-500 z-10',
                  isActive
                    ? 'bg-primary border-primary/20 text-primary-foreground shadow-lg scale-110 ring-4 ring-primary/10'
                    : isCompleted
                      ? 'bg-primary border-background text-primary-foreground'
                      : 'bg-background border-secondary text-muted-foreground',
                )}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5 animate-fade-in" strokeWidth={3} />
                ) : (
                  <Icon
                    className={cn('h-5 w-5', isActive && 'animate-pulse')}
                    strokeWidth={2.5}
                  />
                )}
              </div>
              <span
                className={cn(
                  'text-xs font-medium absolute -bottom-8 whitespace-nowrap transition-colors duration-500',
                  isActive
                    ? 'text-primary font-bold translate-y-0 opacity-100'
                    : isCompleted
                      ? 'text-foreground/70'
                      : 'text-muted-foreground/60',
                )}
              >
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
      <div className="h-4" />
    </div>
  )
}
