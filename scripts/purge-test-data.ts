import { createClient } from "@supabase/supabase-js";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("[Purge Script] ERRO: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas em .env.local.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function purgeTestData() {
  console.log("==================================================================");
  console.log("🔥 INICIANDO PROTOCOLO DE EXPURGO DE DADOS DE TESTE (TEARDOWN) 🔥");
  console.log("==================================================================");

  let totalPurged = 0;

  // 1. Expurgo na tabela 'tickets' (registros com título contendo 'E2E' ou criados por usuários E2E)
  try {
    const { data: testTickets, error: findError } = await supabase
      .from("tickets")
      .select("id, title")
      .or("title.ilike.%E2E%,title.ilike.%Test%");

    if (findError) {
      console.warn("[Purge] Aviso ao buscar tickets de teste:", findError.message);
    } else if (testTickets && testTickets.length > 0) {
      const ticketIds = testTickets.map((t) => t.id);
      const { error: deleteError, count } = await supabase
        .from("tickets")
        .delete({ count: "exact" })
        .in("id", ticketIds);

      if (deleteError) {
        console.error("[Purge] Erro ao deletar tickets:", deleteError.message);
      } else {
        const purgedCount = count ?? testTickets.length;
        totalPurged += purgedCount;
        console.log(`✔ [tickets] ${purgedCount} chamado(s) de teste removido(s) com sucesso.`);
      }
    } else {
      console.log("✔ [tickets] Nenhum chamado de teste pendente para expurgo.");
    }
  } catch (err) {
    console.error("[Purge] Exceção na tabela tickets:", err);
  }

  // 2. Expurgo nas tabelas 'qa_results' e 'qa_projects'
  try {
    const { data: testProjects } = await supabase
      .from("qa_projects")
      .select("id")
      .or("name.ilike.%E2E%,name.ilike.%Test%");

    if (testProjects && testProjects.length > 0) {
      const projectIds = testProjects.map((p) => p.id);

      // Deleta resultados atrelados
      const { count: resultsCount } = await supabase
        .from("qa_results")
        .delete({ count: "exact" })
        .in("project_id", projectIds);

      // Deleta projetos
      const { count: projectsCount } = await supabase
        .from("qa_projects")
        .delete({ count: "exact" })
        .in("id", projectIds);

      console.log(`✔ [qa_results] ${resultsCount ?? 0} resultado(s) de QA removido(s).`);
      console.log(`✔ [qa_projects] ${projectsCount ?? 0} projeto(s) de QA removido(s).`);
      totalPurged += (resultsCount ?? 0) + (projectsCount ?? 0);
    } else {
      console.log("✔ [qa_results / qa_projects] Nenhum projeto/resultado de QA de teste encontrado.");
    }
  } catch (err) {
    console.error("[Purge] Exceção nas tabelas de Security QA:", err);
  }

  // 3. Expurgo na tabela 'sprints'
  try {
    const { data: testSprints } = await supabase
      .from("sprints")
      .select("id")
      .or("name.ilike.%E2E%,name.ilike.%Test%");

    if (testSprints && testSprints.length > 0) {
      const sprintIds = testSprints.map((s) => s.id);
      const { count: sprintCount } = await supabase
        .from("sprints")
        .delete({ count: "exact" })
        .in("id", sprintIds);

      totalPurged += sprintCount ?? testSprints.length;
      console.log(`✔ [sprints] ${sprintCount ?? testSprints.length} sprint(s) de teste removida(s).`);
    } else {
      console.log("✔ [sprints] Nenhuma sprint de teste pendente para expurgo.");
    }
  } catch (err) {
    console.error("[Purge] Exceção na tabela sprints:", err);
  }

  // 4. Expurgo na tabela 'notification_settings' de teste (se houver descrições E2E)
  try {
    const { data: testSettings } = await supabase
      .from("notification_settings")
      .select("id")
      .or("description.ilike.%E2E%,description.ilike.%Test%");

    if (testSettings && testSettings.length > 0) {
      const settingIds = testSettings.map((s) => s.id);
      const { count: settingCount } = await supabase
        .from("notification_settings")
        .delete({ count: "exact" })
        .in("id", settingIds);

      totalPurged += settingCount ?? testSettings.length;
      console.log(`✔ [notification_settings] ${settingCount ?? testSettings.length} preferência(s) de notificação de teste removida(s).`);
    } else {
      console.log("✔ [notification_settings] Nenhuma preferência de notificação de teste pendente para expurgo.");
    }
  } catch (err) {
    console.error("[Purge] Exceção na tabela notification_settings:", err);
  }

  // 5. Expurgo de Usuários de Teste E2E no Supabase Auth e Profile
  try {
    const testEmails = ["solicitante.e2e@cyberitsm.local", "secops.admin.e2e@cyberitsm.local"];
    for (const email of testEmails) {
      const { data: userProfile } = await supabase
        .from("users_profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (userProfile?.id) {
        await supabase.from("users_profiles").delete().eq("id", userProfile.id);
        await supabase.auth.admin.deleteUser(userProfile.id);
        console.log(`✔ [users_profiles / auth.users] Usuário de teste ${email} removido.`);
        totalPurged++;
      }
    }
  } catch (err) {
    console.error("[Purge] Exceção ao remover usuários de teste:", err);
  }

  console.log("==================================================================");
  console.log(`✅ PROTOCOLO DE EXPURGO CONCLUÍDO COM SUCESSO! Total de itens limpos: ${totalPurged}`);
  console.log("==================================================================");
}

if (require.main === module) {
  purgeTestData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[Purge Script] Erro fatal durante a execução:", err);
      process.exit(1);
    });
}
