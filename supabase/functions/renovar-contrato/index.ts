// Edge function: negocia renovação de contrato com IA (Lovable AI Gateway)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Payload {
  jogador_id: string;
  salario_proposto: number;
  anos_proposto: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Não autenticado" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY ausente" }, 500);

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    });

    const body = (await req.json()) as Payload;
    const { jogador_id, salario_proposto, anos_proposto } = body;
    if (!jogador_id || !salario_proposto || !anos_proposto) {
      return json({ error: "Parâmetros inválidos" }, 400);
    }
    if (anos_proposto < 1 || anos_proposto > 5) {
      return json({ error: "Duração deve ser entre 1 e 5 anos" }, 400);
    }

    // Carrega jogador
    const { data: jogador, error: jErr } = await supabase
      .from("players")
      .select("id, name, age, habilidade, position, salario_atual, valor_base_calculado, contrato_ate")
      .eq("id", jogador_id)
      .maybeSingle();
    if (jErr || !jogador) return json({ error: "Jogador não encontrado" }, 404);

    const salarioMinimoEsperado = Number(jogador.valor_base_calculado || 0) * 0.10;
    const idade = jogador.age ?? 25;
    const habilidade = jogador.habilidade ?? 70;

    const systemPrompt = `Você é um agente de jogadores de futebol experiente e duro nas negociações.
Avalie a proposta de renovação de contrato e responda SOMENTE chamando a função "decidir_renovacao".

Regras de avaliação:
- Salário esperado mínimo é ~10% do valor base anual do jogador.
- Jogadores jovens (≤22) com habilidade alta pedem mais (até +30%).
- Jogadores veteranos (≥31) aceitam menos (-20%).
- Contratos curtos (1 ano) são aceitáveis para veteranos; jovens preferem 3-5 anos.
- Se a proposta for muito abaixo do esperado (>15% abaixo), recuse.
- Caso contrário, aceite.
- Justifique sempre em 1-2 frases curtas, em português, em primeira pessoa do agente.`;

    const userPrompt = `Jogador: ${jogador.name}
Posição: ${jogador.position}
Idade: ${idade}
Habilidade: ${habilidade}
Valor base anual: R$ ${Number(jogador.valor_base_calculado).toFixed(0)}
Salário atual: R$ ${Number(jogador.salario_atual).toFixed(0)}
Salário mínimo esperado (10%): R$ ${salarioMinimoEsperado.toFixed(0)}

Proposta do clube:
- Salário anual: R$ ${salario_proposto}
- Duração: ${anos_proposto} ano(s)

Decida.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
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
              description: "Decide se aceita ou recusa a proposta de renovação.",
              parameters: {
                type: "object",
                properties: {
                  aceita: { type: "boolean" },
                  justificativa: { type: "string" },
                  contraproposta_salario: {
                    type: "number",
                    description: "Se recusar, sugira um salário razoável que aceitaria.",
                  },
                  contraproposta_anos: {
                    type: "number",
                    description: "Se recusar, sugira uma duração que aceitaria.",
                  },
                },
                required: ["aceita", "justificativa"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "decidir_renovacao" } },
      }),
    });

    if (aiResp.status === 429) return json({ error: "Limite de requisições atingido. Tente novamente em alguns instantes." }, 429);
    if (aiResp.status === 402) return json({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }, 402);
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error:", aiResp.status, t);
      return json({ error: "Erro na IA" }, 500);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return json({ error: "IA não retornou decisão" }, 500);

    const decision = JSON.parse(toolCall.function.arguments);

    // Se aceita, aplica via RPC
    if (decision.aceita) {
      const { error: rpcErr } = await supabase.rpc("renovar_contrato_jogador", {
        _jogador_id: jogador_id,
        _novo_salario: salario_proposto,
        _novos_anos: anos_proposto,
      });
      if (rpcErr) {
        console.error("RPC error:", rpcErr);
        return json({ error: rpcErr.message }, 500);
      }
    }

    return json({
      aceita: decision.aceita,
      justificativa: decision.justificativa,
      contraproposta: decision.aceita
        ? null
        : {
            salario: decision.contraproposta_salario ?? null,
            anos: decision.contraproposta_anos ?? null,
          },
    });
  } catch (e) {
    console.error("renovar-contrato error:", e);
    return json({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
