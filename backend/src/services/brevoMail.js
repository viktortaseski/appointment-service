// services/brevoMail.js

export async function sendBrevoEmail({
    to,
    subject,
    text,
    html,
}) {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "api-key": process.env.BREVO_API_KEY,
        },
        body: JSON.stringify({
            sender: {
                name: "Dentra",
                email: "vtaseski24@gmail.com", // verified sender
            },
            to: [{ email: to }],
            subject,
            textContent: text,
            htmlContent: html,
        }),
    });

    const data = await response.json();

    if (!response.ok) {
        console.error("Brevo API error:", data);
        throw new Error("Brevo email failed");
    }

    return data;
}
