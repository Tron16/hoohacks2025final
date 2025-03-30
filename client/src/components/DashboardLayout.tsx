import React from 'react';
import { useLocation } from 'wouter';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Phone, History, Settings, Home, Menu, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { UserResponse } from '@/types/api';

interface DashboardLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export default function DashboardLayout({ children, className }: DashboardLayoutProps) {
  const [location, navigate] = useLocation();
  const isMobile = useIsMobile();
  
  // Get current user
  const { data: userData } = useQuery<UserResponse>({
    queryKey: ['/api/user'],
    retry: 1,
    refetchOnWindowFocus: false
  });
  
  // Navigation items
  const navItems = [
    { 
      name: 'Dashboard', 
      path: '/dashboard', 
      icon: <Home className="h-5 w-5" /> 
    },
    { 
      name: 'Call',
      path: '/call',
      icon: <Phone className="h-5 w-5" />
    },
    { 
      name: 'Call History',
      path: '/call-history',
      icon: <History className="h-5 w-5" />
    },
    { 
      name: 'Settings',
      path: '/settings',
      icon: <Settings className="h-5 w-5" />
    }
  ];
  
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };
  
  // Sidebar for desktop
  const renderSidebar = () => (
    <div className="flex flex-col w-64 h-full p-4 bg-white bg-opacity-10 backdrop-blur-sm border-r border-white border-opacity-20">
      <div className="flex items-center justify-center mb-8">
        <span className="text-2xl font-bold">unmute</span>
      </div>
      
      <nav className="flex-1">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.path}>
              <Button
                variant={location === item.path ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start",
                  location === item.path 
                    ? "bg-gradient-to-r from-purple-600 to-purple-400" 
                    : "hover:bg-white hover:bg-opacity-10"
                )}
                onClick={() => navigate(item.path)}
              >
                {item.icon}
                <span className="ml-2">{item.name}</span>
              </Button>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="pt-4 border-t border-white border-opacity-20">
        <div className="flex items-center px-4 py-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white font-semibold">
            {userData?.user?.firstName?.charAt(0) || 'U'}
          </div>
          <div className="ml-2">
            <div className="font-medium">{userData?.user?.firstName || 'User'}</div>
            <div className="text-xs text-white text-opacity-60">{userData?.user?.email || ''}</div>
          </div>
        </div>
        <Button 
          variant="ghost" 
          className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500 hover:bg-opacity-10"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );
  
  // Mobile navigation
  const renderMobileNav = () => (
    <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-black bg-opacity-30 backdrop-blur-sm border-b border-white border-opacity-20">
      <div className="text-xl font-bold">unmute</div>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="bg-gradient-to-br from-purple-900 to-gray-900 border-r border-white border-opacity-20">
          <div className="py-4">
            <div className="text-2xl font-bold mb-8">unmute</div>
            <nav>
              <ul className="space-y-2">
                {navItems.map((item) => (
                  <li key={item.path}>
                    <Button
                      variant={location === item.path ? "default" : "ghost"}
                      className={cn(
                        "w-full justify-start",
                        location === item.path 
                          ? "bg-gradient-to-r from-purple-600 to-purple-400" 
                          : "hover:bg-white hover:bg-opacity-10"
                      )}
                      onClick={() => navigate(item.path)}
                    >
                      {item.icon}
                      <span className="ml-2">{item.name}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            </nav>
            
            <div className="absolute bottom-8 left-0 right-0 px-4">
              <div className="pt-4 border-t border-white border-opacity-20">
                <div className="flex items-center px-2 py-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white font-semibold">
                    {userData?.user?.firstName?.charAt(0) || 'U'}
                  </div>
                  <div className="ml-2">
                    <div className="font-medium">{userData?.user?.firstName || 'User'}</div>
                    <div className="text-xs text-white text-opacity-60">{userData?.user?.email || ''}</div>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500 hover:bg-opacity-10"
                  onClick={handleLogout}
                >
                  <LogOut className="h-5 w-5 mr-2" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
  
  // Animated background effect
  const backgroundVariants = {
    initial: {
      background: "linear-gradient(120deg, rgba(107, 33, 168, 0.2) 0%, rgba(76, 29, 149, 0.2) 50%, rgba(124, 58, 237, 0.2) 100%)",
    },
    animate: {
      background: "linear-gradient(120deg, rgba(124, 58, 237, 0.2) 0%, rgba(107, 33, 168, 0.2) 50%, rgba(76, 29, 149, 0.2) 100%)",
      transition: {
        duration: 10,
        repeat: Infinity,
        repeatType: "reverse" as const
      }
    }
  };
  
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-900 to-purple-900">
      {/* Background effect */}
      <motion.div
        className="fixed inset-0 z-0 opacity-50"
        variants={backgroundVariants}
        initial="initial"
        animate="animate"
      />
      
      {/* Left sidebar (desktop only) */}
      {!isMobile && (
        <div className="hidden md:block">
          {renderSidebar()}
        </div>
      )}
      
      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Mobile navigation */}
        {isMobile && renderMobileNav()}
        
        {/* Content area */}
        <main className={cn("flex-1 p-4 md:p-8 overflow-auto relative z-10", className)}>
          {children}
        </main>
      </div>
    </div>
  );
}