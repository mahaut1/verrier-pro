import { useAuth } from "../hooks/useAuth";

export default function Home() {
  const { user } = useAuth();

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/logout", {
        method: "POST",
        credentials: "include"
      });
      
      if (response.ok) {
        window.location.reload();
      }
    } catch (error) {
      console.error("Erreur de déconnexion:", error);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="container">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">VerrierPro</h1>
            <p className="text-gray-600">Tableau de bord artisan verrier</p>
          </div>
          <div className="flex items-center space-y-4">
            <span className="text-sm text-gray-600 mr-4">
              Bienvenue, {user?.firstName || user?.username}
            </span>
            <button onClick={handleLogout} className="btn btn-secondary">
              Se déconnecter
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px'}}>
          <div className="card">
            <div className="card-header">
              <h2 className="text-xl font-semibold">Mes Créations</h2>
            </div>
            <p className="text-gray-600 mb-4">
              Gérez vos pièces verrières en cours et terminées
            </p>
            <button className="btn btn-primary w-full" disabled>
              Bientôt disponible
            </button>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="text-xl font-semibold">Galeries Partenaires</h2>
            </div>
            <p className="text-gray-600 mb-4">
              Suivez vos pièces dans les galeries partenaires
            </p>
            <button className="btn btn-primary w-full" disabled>
              Bientôt disponible
            </button>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="text-xl font-semibold">Commandes</h2>
            </div>
            <p className="text-gray-600 mb-4">
              Gérez vos commandes et les demandes clients
            </p>
            <button className="btn btn-primary w-full" disabled>
              Bientôt disponible
            </button>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="text-xl font-semibold">Stock & Matériaux</h2>
            </div>
            <p className="text-gray-600 mb-4">
              Suivez votre inventaire de matières premières
            </p>
            <button className="btn btn-primary w-full" disabled>
              Bientôt disponible
            </button>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="text-xl font-semibold">Événements</h2>
            </div>
            <p className="text-gray-600 mb-4">
              Planifiez vos expositions et salons
            </p>
            <button className="btn btn-primary w-full" disabled>
              Bientôt disponible
            </button>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="text-xl font-semibold">Profil</h2>
            </div>
            <div className="space-y-4">
              <p><strong>Nom:</strong> {user?.username}</p>
              <p><strong>Email:</strong> {user?.email}</p>
              <p><strong>Rôle:</strong> {user?.role}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}