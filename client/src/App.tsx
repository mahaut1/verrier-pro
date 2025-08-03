import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { useState } from "react";
import { Toaster } from "sonner";
import { useAuth } from "./hooks/useAuth";
import Login from "./pages/login";
import Register from "./pages/register";
import Home from "./pages/Home";

function AuthenticatedApp() {
    const {  isLoading, isAuthenticated } = useAuth();
    const [currentPage, setCurrentPage] = useState<'login' | 'register'>('login');
    
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Chargement...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <>
                {currentPage === 'login' ? (
                    <Login onSwitchToRegister={() => setCurrentPage('register')} />
                ) : (
                    <Register onSwitchToLogin={() => setCurrentPage('login')} />
                )}
            </>
        );
    }

    return <Home />;
}

export default function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthenticatedApp />
            <Toaster />
        </QueryClientProvider>
    );
}