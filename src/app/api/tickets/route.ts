import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const headersList = request.headers;
    const apiKeyHeader = headersList.get('x-api-key');
    const configApiKey = process.env.CYBER_ITSM_API_KEY || 'cyber-itsm-token-webhook-2026';

    // 1. Validate Secret Auth Token
    if (!apiKeyHeader || apiKeyHeader !== configApiKey) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid API Key' },
        { status: 401 }
      );
    }

    // 2. Parse payload
    const body = await request.json();
    const {
      title,
      description,
      status = 'todo',
      priority = 'medium',
      framework,
      framework_category,
      framework_subcategory,
      assignee_id,
    } = body;

    if (!title) {
      return NextResponse.json(
        { error: 'Bad Request: Título (title) é obrigatório.' },
        { status: 400 }
      );
    }

    // 3. Connect to Supabase
    // We use the service role key to bypass RLS policies on ticket creation via integrations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 4. Ingest Ticket
    const { data, error } = await supabase
      .from('tickets')
      .insert({
        title,
        description: description || 'Alerta de cibersegurança gerado via integração externa.',
        status,
        priority,
        framework: framework || null,
        framework_category: framework_category || null,
        framework_subcategory: framework_subcategory || null,
        assignee_id: assignee_id || null,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Chamado de segurança criado com sucesso via Webhook.',
      ticket: {
        id: data.id,
        key: data.key,
        title: data.title,
        status: data.status,
      },
    });

  } catch (err: any) {
    console.error('Webhook ingestion error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error', details: err.message },
      { status: 500 }
    );
  }
}
