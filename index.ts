// Edge Function: envia convite por e-mail para um corretor criar a própria senha.
// Só o administrador (Mário) consegue chamar. Usa a service role somente aqui no servidor.
// Deploy: supabase functions deploy convidar-corretor --project-ref ghbikzuttsvqvzxsqkbu
import { createClient } from "npm:@supabase/supabase-js@2";

const ADMINS = ["mario@mudeimobiliaria.com.br"];
// Destino fixo: o convite nunca pode levar o corretor para outro endereço.
const REDIRECT_TO = "https://marubensmude.github.io/autorizacao-interna/definir-senha.html";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Método não permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // 1) Quem chamou precisa estar logado como administrador
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ erro: "Faça login novamente." }, 401);
  const quem = createClient(url, anon, { auth: { persistSession: false } });
  const { data: dadosUsuario } = await quem.auth.getUser(token);
  const email_admin = String(dadosUsuario?.user?.email || "").toLowerCase();
  if (!ADMINS.includes(email_admin)) return json({ erro: "Acesso restrito ao administrador." }, 403);

  // 2) Dados do convite
  const body = await req.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  const nome = String(body?.nome || "").trim().slice(0, 120);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ erro: "E-mail inválido." }, 400);
  if (!nome) return json({ erro: "Informe o nome do corretor." }, 400);

  // 3) Convite (API de administração, só no servidor)
  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: REDIRECT_TO,
    data: { nome },
  });
  if (error) return json({ erro: error.message }, 400);
  return json({ ok: true, id: data.user?.id });
});
