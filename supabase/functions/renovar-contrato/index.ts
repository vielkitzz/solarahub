// supabase/functions/renovar-contrato/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!; // Usar Service Role para garantir a execução do RPC
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY ausente" }, 500);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { jogador_id, salario_proposto, anos_proposto } = await req.json();

    const { data: jogador, error: jErr } = await supabase
      .from("players")
      .select("id, name, age, habilidade, position, salario_atual, valor_base_calculado")
      .eq("id", jogador_id)
      .maybeSingle();

    if (jErr || !jogador) return json({ error: "Jogador não encontrado" }, 404);

    const salarioMinimoEsperado = Number(jogador.valor_base_calculado || 0) * 0.1;

    const systemPrompt = `Você é um agente de jogadores de futebol experiente.
Avalie a proposta de renovação de contrato.
Diretrizes:
- Use o "Salário atual" como principal referência.
- O "Salário mínimo esperado" (10% do valor base) é uma meta ideal, não obrigatória.
- Jogadores veteranos (31+) ou reservas podem aceitar manter ou reduzir o salário.
- Jovens talentos exigem aumento sobre o salário atual.
- Justifique em 1-2 frases curtas em português.`;

    const userPrompt = `Jogador: ${jogador.name} | Idade: ${jogador.age} | Habilidade: ${jogador.habilidade}
Salário atual: € ${Number(jogador.salario_atual).toFixed(0)}
Salário mínimo esperado (10% mercado): € ${salarioMinimoEsperado.toFixed(0)}
Proposta: € ${salario_proposto} por ${anos_proposto} ano(s).`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "decidir_renovacao",
              parameters: {
                type: "object",
                properties: {
                  aceita: { type: "boolean" },
                  justificativa: { type: "string" },
                  contraproposta_salario: { type: "number" },
                  contraproposta_anos: { type: "number" },
                },
                required: ["aceita", "justificativa"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "decidir_renovacao" } },
      }),
    });

    const aiData = await aiResp.json();
    const args = aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;

    if (!args) throw new Error("A IA não retornou uma resposta válida.");
    const decision = JSON.parse(args);

    if (decision.aceita) {
      await supabase.rpc("renovar_contrato_jogador", {
        _jogador_id: jogador_id,
        _novo_salario: salario_proposto,
        _novos_anos: anos_proposto,
      });
    }

    return json({
      aceita: decision.aceita,
      justificativa: decision.justificativa,
      contraproposta: decision.aceita
        ? null
        : {
            salario: decision.contraproposta_salario || null,
            anos: decision.contraproposta_anos || null,
          },
    });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
