import { useState } from 'react';
import { useAuth } from '../../lib/useAuth';
import { Button } from '../../components/ui/button';
import { LogOut, User, Home, Package, Palette, Building, ShoppingCart, Calendar, Menu, X } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';

export default function Header() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const navigation = [
    { name: 'Tableau de bord', href: '/', icon: Home },
    { name: 'Stock', href: '/stocks', icon: Package },
    { name: 'Pièces', href: '/pieces', icon: Palette },
    { name: 'Galeries', href: '/galleries', icon: Building },
    { name: 'Commandes', href: '/orders', icon: ShoppingCart },
    { name: 'Événements', href: '/events', icon: Calendar },
  ];
  
  const closeMobileMenu = () => setIsMobileMenuOpen(false);
  
  return (
    <>
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Menu burger mobile + Logo */}
            <div className="flex items-center space-x-4">
              {/* Bouton menu mobile - visible uniquement sur mobile */}
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setIsMobileMenuOpen(true)}
              >
                <Menu className="h-6 w-6" />
              </Button>
              
              <Link href="/">
                <h1 className="text-2xl font-bold text-blue-600 cursor-pointer hover:text-blue-700 transition-colors">
                  VerrierPro
                </h1>
              </Link>
              
              {/* Navigation desktop - cachée sur mobile */}
              <nav className="hidden lg:flex space-x-1 ml-8">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.href || 
                    (item.href !== '/' && location.startsWith(item.href));
                  
                  return (
                    <Link key={item.name} href={item.href}>
                      <Button
                        variant={isActive ? 'default' : 'ghost'}
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <Icon className="h-4 w-4" />
                        {item.name}
                      </Button>
                    </Link>
                  );
                })}
              </nav>
            </div>
            
            {/* Informations utilisateur et déconnexion */}
            <div className="flex items-center gap-4">
              {user && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-full">
                    <User className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-gray-700">
                      {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username}
                    </span>
                  </div>
                  
                  <Button
                    onClick={logout}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Déconnexion</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Menu mobile overlay - visible uniquement sur mobile */}
      {isMobileMenuOpen && (
        <div className="lg:hidden">
          <div className="fixed inset-0 z-50 flex">
            {/* Overlay */}
            <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={closeMobileMenu} />
            
            {/* Menu panel */}
            <div className="relative flex flex-col flex-1 w-full max-w-xs bg-white shadow-xl">
              {/* Bouton fermer */}
              <div className="absolute top-0 right-0 -mr-12 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-1 flex items-center justify-center h-10 w-10 rounded-full text-white hover:bg-white/10"
                  onClick={closeMobileMenu}
                >
                  <X className="h-6 w-6" />
                </Button>
              </div>
              
              {/* Contenu du menu */}
              <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
                {/* Header du menu */}
                <div className="flex-shrink-0 px-4 pb-4">
                  <h1 className="text-xl font-bold text-blue-600">VerrierPro</h1>
                  {user && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                      <User className="h-4 w-4" />
                      <span>{user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username}</span>
                    </div>
                  )}
                </div>
                
                {/* Navigation mobile */}
                <nav className="px-2 space-y-1">
                  {navigation.map((item) => {
                    const Icon = item.icon;
                    const isActive = location === item.href || 
                      (item.href !== '/' && location.startsWith(item.href));
                    
                    return (
                      <Link key={item.name} href={item.href}>
                        <div
                          className={cn(
                            isActive
                              ? "bg-blue-50 border-r-2 border-blue-600 text-blue-700"
                              : "text-gray-700 hover:bg-gray-50",
                            "group flex items-center px-3 py-2 text-sm font-medium cursor-pointer transition-colors"
                          )}
                          onClick={closeMobileMenu}
                        >
                          <Icon
                            className={cn(
                              isActive ? "text-blue-600" : "text-gray-400",
                              "mr-3 h-5 w-5"
                            )}
                          />
                          {item.name}
                        </div>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}