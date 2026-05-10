import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // 1. Lida com chamadas de preflight (CORS)
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // 2. Variáveis de ambiente (Verifique se estão no painel do Supabase!)
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cliente com Service Role para garantir que o RPC funcione
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 3. Lê o corpo da requisição
    const { jogador_id, salario_proposto, anos_proposto } = await req.json();

    // 4. Busca dados do jogador
    const { data: jogador, error: jErr } = await supabase
      .from("players")
      .select("name, age, habilidade, salario_atual, valor_base_calculado")
      .eq("id", jogador_id)
      .maybeSingle();

    if (jErr || !jogador) throw new Error("Jogador não encontrado");

    // 5. Chamada para a IA
    const prompt = `Você é um agente. Jogador: ${jogador.name}, ${jogador.age} anos, OVR ${jogador.habilidade}. 
    Salário Atual: €${jogador.salario_atual}. 
    A proposta é: €${salario_proposto} por ${anos_proposto} anos. 
    Decida se aceita ou recuse.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        tools: [
          {
            type: "function",
            function: {
              name: "decidir",
              parameters: {
                type: "object",
                properties: {
                  aceita: { type: "boolean" },
                  justificativa: { type: "string" },
                  contra_salario: { type: "number" },
                  contra_anos: { type: "number" },
                },
                required: ["aceita", "justificativa"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "decidir" } },
      }),
    });

    const aiData = await aiResp.json();
    const decision = JSON.parse(aiData.choices[0].message.tool_calls[0].function.arguments);

    // 6. Se aceito, executa a renovação no banco
    if (decision.aceita) {
      const { error: rpcErr } = await supabase.rpc("renovar_contrato_jogador", {
        _jogador_id: jogador_id,
        _novo_salario: salario_proposto,
        _novos_anos: anos_proposto,
      });
      if (rpcErr) throw rpcErr;
    }

    return new Response(
      JSON.stringify({
        aceita: decision.aceita,
        justificativa: decision.justificativa,
        contraproposta: decision.aceita ? null : { salario: decision.contra_salario, anos: decision.contra_anos },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
