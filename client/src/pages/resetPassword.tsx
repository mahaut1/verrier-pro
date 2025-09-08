import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";

export default function ResetPassword() {
  const { resetPassword } = useAuth();
  const [token, setToken] = useState("");
  const [pwd1, setPwd1] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token") || "";
    setToken(t);
  }, []);

const submit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);

  if (pwd1 !== pwd2) return setError("Les mots de passe ne correspondent pas");
  if (pwd1.length < 6) return setError("Mot de passe trop court (minimum 6 caractères)");

  setLoading(true);
  try {
    await resetPassword(token.trim().toLowerCase(), pwd1); 
    setOk(true);
  } catch (e: any) {
    setError(e.message || "Erreur");
  } finally {
    setLoading(false);
  }
};


  if (!token) {
    return <p className="max-w-md mx-auto p-4 text-red-600">Lien invalide.</p>;
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Réinitialiser le mot de passe</h1>
      {ok ? (
        <p className="p-3 bg-green-50 border border-green-200 rounded">
          Mot de passe mis à jour. Vous pouvez maintenant vous connecter.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="text-sm">Nouveau mot de passe</span>
            <input
              className="mt-1 w-full border rounded p-2"
              type="password"
              value={pwd1}
              onChange={(e) => setPwd1(e.target.value)}
              minLength={6}
              required
              disabled={loading}
            />
          </label>
          <label className="block">
            <span className="text-sm">Confirmez le mot de passe</span>
            <input
              className="mt-1 w-full border rounded p-2"
              type="password"
              value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
              minLength={6}
              required
              disabled={loading}
            />
          </label>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button className="w-full py-2 rounded bg-black text-white disabled:opacity-50" disabled={loading}>
            {loading ? "Mise à jour..." : "Mettre à jour le mot de passe"}
          </button>
        </form>
      )}
    </div>
  );
}
