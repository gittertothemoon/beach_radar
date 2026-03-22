import { redirect } from 'next/navigation';

type InvitePageProps = {
    params: Promise<{
        code?: string;
    }>;
};

function sanitizeInviteCode(code: string) {
    return code.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 64);
}

export default async function InvitePage({ params }: InvitePageProps) {
    const resolvedParams = await params;
    const code = sanitizeInviteCode(resolvedParams.code || '');

    if (!code) {
        redirect('/landing/');
    }

    redirect(`/landing/?ref=${encodeURIComponent(code)}`);
}
