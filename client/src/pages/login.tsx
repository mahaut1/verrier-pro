import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { useToast } from "../hooks/useToast";
import { useAuth } from "../hooks/useAuth";

export default function Login() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { login, refetchAuth } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({ username: "", password: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(formData.username, formData.password); // ↙ utilise le hook
      await refetchAuth();

      toast({ title: "Connexion réussie", description: "Bienvenue sur VerrierPro" });
      navigate("/", { replace: true });
    } catch (err: unknown) {
      const message =
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message?: string }).message)
          : "Identifiants invalides";
      toast({ title: "Erreur de connexion", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-3xl font-bold text-gray-900">VerrierPro</CardTitle>
          <p className="text-center text-gray-600">Connectez-vous à votre espace artisan</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username">Email ou nom d'utilisateur</Label>
              <Input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>
               <Button variant="link" className="p-0 h-auto" asChild>
                 <Link to="/forgot-password">Mot de passe oublié ?</Link>
                </Button>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Connexion..." : "Se connecter"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Pas encore de compte ?{" "}
              <button onClick={() => navigate("/register")} className="font-medium text-blue-600 hover:text-blue-500">
                S'inscrire
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
