import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

import StatsGrid from "../components/Dashboard/StatGrid";
import RecentActivity from "../components/Dashboard/RecentActivity";
import QuickActions from "../components/Dashboard/QuickAction";

export default function Dashboard() {
  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-blue-600 sm:text-3xl sm:truncate">
              Tableau de bord
            </h2>
            <p className="text-sm text-blue-600 mt-1">
              Aperçu de votre activité d'atelier
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <Link to="/pieces">
              <Button>
                <Plus className="-ml-1 mr-2 h-5 w-5" />
                Nouvelle pièce
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-8">
          <StatsGrid />
        </div>

        <div className="mt-8">
          <RecentActivity />
        </div>

        <div className="mt-8">
          <QuickActions />
        </div>
      </div>
    </div>
  );
}
