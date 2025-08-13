import { Outlet } from "react-router-dom";
import Header from "./Header";

export default function AppLayout() {
  return (
    <>
      <div className="sticky top-0 z-40">
        <Header />
      </div>

      {/* Contenu des pages */}
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </>
  );
}
