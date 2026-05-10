import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableKey) throw new Error("LOVABLE_API_KEY is missing");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { jogador_id, salario_proposto, anos_proposto } = await req.json();

    // Busca dados do jogador para o prompt
    const { data: player, error: pErr } = await supabase
      .from("players")
      .select("name, age, habilidade, salario_atual, valor_base_calculado")
      .eq("id", jogador_id)
      .single();

    if (pErr || !player) throw new Error("Jogador não encontrado");

    const prompt = `Você é um agente de futebol. Jogador: ${player.name}, ${player.age} anos, habilidade ${player.habilidade}. Salário atual: €${player.salario_atual}. Proposta: €${salario_proposto} por ${anos_proposto} anos. Decida se aceita, recusa ou faz contraproposta. Responda APENAS JSON: {"aceita":boolean, "justificativa":"string", "contra_salario":number|null, "contra_anos":number|null}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    const aiData = await aiRes.json();
    const decision = JSON.parse(aiData.choices[0].message.content);

    if (decision.aceita) {
      // Chama o RPC para atualizar o banco
      const { error: rpcErr } = await supabase.rpc("renovar_contrato_jogador", {
        _jogador_id: jogador_id,
        _novo_salario: salario_proposto,
        _novos_anos: anos_proposto,
      });
      if (rpcErr) throw rpcErr;
    }

    return new Response(JSON.stringify(decision), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
