import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(request: Request) {
    try {
        if (!supabaseUrl || !supabaseKey) {
            console.error('Missing Supabase credentials!');
            return NextResponse.json({ error: 'Configurazione server mancante' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: false }
        });

        const body = await request.json();
        const { email, lang, project, version, honeypot } = body;

        const emailValue = email ? email.trim() : '';

        // Spam prevention (bot trap)
        if (honeypot && !emailValue) {
            return NextResponse.json({ success: true, spam: true });
        }

        if (!emailValue || !emailValue.includes('@')) {
            return NextResponse.json({ error: 'Email non valida' }, { status: 400 });
        }

        const normalizedEmail = emailValue.toLowerCase();
        const nowIso = new Date().toISOString();
        const meta = { project: project || 'where2beach', version: version || 'waitlist_v2_hero' };

        // 1. Check if email already exists
        const { data: existing, error: selectError } = await supabase
            .from('waitlist_signups')
            .select('id, count, status')
            .eq('email_norm', normalizedEmail)
            .maybeSingle();

        if (selectError) {
            console.error('Supabase select error:', selectError);
            return NextResponse.json({ error: 'Errore durante la verifica (select)' }, { status: 500 });
        }

        if (existing) {
            console.log(`Email ${emailValue} è già registrata (count: ${existing.count})`);
            const nextCount = (typeof existing.count === 'number' ? existing.count : 0) + 1;

            const { error: updateError } = await supabase
                .from('waitlist_signups')
                .update({
                    count: nextCount,
                    last_seen_at: nowIso,
                    meta,
                    lang: lang || 'it'
                })
                .eq('email_norm', normalizedEmail);

            if (updateError) {
                console.error('Supabase update error:', updateError);
                return NextResponse.json({ error: 'Errore aggiornamento dati' }, { status: 500 });
            }

            return NextResponse.json({ error: 'Email già registrata in lista d\'attesa', already: true }, { status: 409 });
        }

        // 2. Insert new user
        console.log(`Nuova email: ${emailValue}, salvataggio nel database...`);
        const insertPayload = {
            email: emailValue,
            lang: lang || 'it',
            meta,
            status: 'pending',
            count: 1,
            first_seen_at: nowIso,
            last_seen_at: nowIso,
        };

        const { error: insertError } = await supabase
            .from('waitlist_signups')
            .insert(insertPayload);

        if (insertError) {
            console.error('Supabase insert error:', insertError);
            return NextResponse.json({ error: 'Errore di salvataggio (insert)' }, { status: 500 });
        }

        return NextResponse.json({ success: true, already: false });
    } catch (error) {
        console.error('Errore critico API waitlist:', error);
        return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
    }
}
