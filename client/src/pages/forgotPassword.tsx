import { useState } from "react";
import { useAuth } from "../hooks/useAuth";

export default function ForgotPassword() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true); // message générique
    } catch (e: any) {
      setError(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Mot de passe oublié</h1>
      {sent ? (
        <p className="p-3 bg-green-50 border border-green-200 rounded">
          Si un compte existe pour <b>{email}</b>, un lien de réinitialisation a été envoyé.
          Pensez à vérifier votre dossier “courrier indésirable”.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="text-sm">Email</span>
            <input
              className="mt-1 w-full border rounded p-2"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </label>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            className="w-full py-2 rounded bg-black text-white disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Envoi..." : "Envoyer le lien"}
          </button>
        </form>
      )}
    </div>
  );
}
