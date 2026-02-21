import { redirect } from 'next/navigation';

type InvitePageProps = {
    params: {
        code: string;
    };
};

function sanitizeInviteCode(code: string) {
    return code.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 64);
}

export default function InvitePage({ params }: InvitePageProps) {
    const code = sanitizeInviteCode(params.code || '');

    if (!code) {
        redirect('/#waitlist');
    }

    redirect(`/?ref=${encodeURIComponent(code)}#waitlist`);
}
