const SENDER_NAME = 'Dentra Support';
const SENDER_EMAIL = 'dentra@10422919.brevosend.com';

function sendBrevoEmail({ to, subject, text }) {
    const payload = {
        sender: {
            name: SENDER_NAME,
            email: SENDER_EMAIL,
        },
        to: [{ email: to }],
        subject,
        textContent: text,
    };

    return fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-key': process.env.BREVO_API_KEY,
        },
        body: JSON.stringify(payload),
    })
        .then(async (response) => {
            const data = await response.json();

            if (!response.ok) {
                // eslint-disable-next-line no-console
                console.error('Brevo API error:', data);
                throw new Error('Brevo email failed');
            }

            return data;
        });
}

module.exports = { sendBrevoEmail };
