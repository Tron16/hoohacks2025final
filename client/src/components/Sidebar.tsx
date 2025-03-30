import React from 'react';
import { useLocation } from 'wouter';
import { 
  Phone, 
  History, 
  LogOut,
  Settings,
  Home,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ className }) => {
  const [location, setLocation] = useLocation();
  
  const navItems = [
    { 
      name: "Home", 
      icon: <Home className="h-5 w-5" />, 
      path: "/dashboard"
    },
    { 
      name: "Call", 
      icon: <Phone className="h-5 w-5" />, 
      path: "/call"
    },
    { 
      name: "Call History", 
      icon: <History className="h-5 w-5" />, 
      path: "/call-history"
    },
    { 
      name: "Settings", 
      icon: <Settings className="h-5 w-5" />, 
      path: "/settings"
    },
  ];
  
  return (
    <div className={cn(
      "flex flex-col h-full bg-white bg-opacity-10 backdrop-blur-sm border-r border-white border-opacity-20",
      className
    )}>
      {/* Logo and Brand */}
      <div className="p-4 border-b border-white border-opacity-20 flex items-center justify-center">
        <h1 className="text-xl font-bold text-white">Unmute</h1>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 pt-5">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.name}>
              <button
                onClick={() => setLocation(item.path)}
                className={cn(
                  "flex items-center w-full px-4 py-3 rounded-lg transition-colors",
                  location === item.path
                    ? "bg-purple-600 text-white"
                    : "text-white hover:bg-white hover:bg-opacity-10"
                )}
              >
                <span className="mr-3">{item.icon}</span>
                <span>{item.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      
      {/* Logout at bottom */}
      <div className="p-4 border-t border-white border-opacity-20">
        <button
          onClick={() => setLocation("/")}
          className="flex items-center w-full px-4 py-3 rounded-lg text-white hover:bg-white hover:bg-opacity-10 transition-colors"
        >
          <LogOut className="h-5 w-5 mr-3" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;