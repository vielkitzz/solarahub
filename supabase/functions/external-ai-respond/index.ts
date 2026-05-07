import { corsHeaders } from "@supabase/supabase-js/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { proposal_id } = await req.json();
    if (!proposal_id) {
      return new Response(JSON.stringify({ error: "proposal_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Carrega contexto: a contraproposta enviada pelo usuário
    const { data: prop } = await supabase
      .from("external_proposals")
      .select("*")
      .eq("id", proposal_id)
      .maybeSingle();
    if (!prop) {
      return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: corsHeaders });
    }

    const [{ data: player }, { data: club }] = await Promise.all([
      supabase.from("players").select("*").eq("id", prop.player_id).maybeSingle(),
      supabase.from("external_clubs").select("*").eq("id", prop.external_club_id).maybeSingle(),
    ]);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), { status: 500, headers: corsHeaders });
    }

    const prompt = `Você é o diretor esportivo do clube ${club?.name} (${club?.country}, prestígio ${club?.prestige}/10, tier ${club?.budget_tier}).
O clube vendedor fez uma contraproposta pelo jogador ${player?.name} (overall ${player?.habilidade}, valor base ${player?.valor_base_calculado}).
Contraproposta recebida: valor ${prop.valor_ofertado}, salário ${prop.salario_ofertado}.
Decida: aceitar, recusar ou contra-propor (com novos valores próximos do razoável). Responda APENAS JSON: {"action":"accept|reject|counter","valor":number?,"salario":number?,"mensagem":"breve"}.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return new Response(JSON.stringify({ error: "ai failed", detail: txt }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    let parsed: any = {};
    try {
      parsed = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");
    } catch {
      parsed = { action: "reject", mensagem: "resposta inválida da IA" };
    }

    if (parsed.action === "accept") {
      await supabase
        .from("external_proposals")
        .update({ status: "pendente", origem: "ai_counter", mensagem: parsed.mensagem })
        .eq("id", proposal_id);
      // marca como aceita pela IA: cria nova proposta "espelho" no estado pendente para o user aceitar formalmente?
      // Mais simples: deixar pendente para usuário aceitar e o aceite final dispara a transferência.
    } else if (parsed.action === "reject") {
      await supabase.from("external_proposals").update({ status: "recusada", mensagem: parsed.mensagem }).eq("id", proposal_id);
    } else if (parsed.action === "counter") {
      await supabase.from("external_proposals").update({ status: "contraproposta" }).eq("id", proposal_id);
      await supabase.from("external_proposals").insert({
        external_club_id: prop.external_club_id,
        player_id: prop.player_id,
        valor_ofertado: Number(parsed.valor || prop.valor_ofertado),
        salario_ofertado: Number(parsed.salario || prop.salario_ofertado),
        luvas: prop.luvas,
        status: "pendente",
        temporada_validade: prop.temporada_validade,
        parent_id: prop.id,
        origem: "ai_counter",
        mensagem: parsed.mensagem,
      });
    }

    return new Response(JSON.stringify({ ok: true, decision: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
