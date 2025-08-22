'use client'

import { useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { DashboardSidebar } from '@/components/dashboard/dashboard-sidebar'
import { OverviewTab } from '@/components/dashboard/tabs/overview-tab'
import { ChatAnalysisTab } from '@/components/dashboard/tabs/chat-analysis-tab'
import { OceanographicTab } from '@/components/dashboard/tabs/oceanographic-tab'
import { FisheriesTab } from '@/components/dashboard/tabs/fisheries-tab'
import { ReportsTab } from '@/components/dashboard/tabs/reports-tab'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default function DashboardPage() {
  const { user, loading, isAuthenticated } = useAuthStore()
  const [activeTab, setActiveTab] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Acceso No Autorizado</h1>
          <p className="text-muted-foreground">Por favor inicia sesión para acceder al dashboard</p>
        </div>
      </div>
    )
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab />
      case 'chat-analysis':
        return <ChatAnalysisTab />
      case 'oceanographic':
        return <OceanographicTab />
      case 'fisheries':
        return <FisheriesTab />
      case 'reports':
        return <ReportsTab />
      default:
        return <OverviewTab />
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <DashboardHeader
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        user={user}
      />
      
      <div className="flex flex-1">
        <DashboardSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
        
        <main className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto p-6">
            {renderActiveTab()}
          </div>
        </main>
      </div>
    </div>
  )
}