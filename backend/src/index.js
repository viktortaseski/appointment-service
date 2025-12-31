require('dotenv').config();

const express = require('express');
const cors = require('cors');

const clinicResolver = require('./clinic-resolver');
const authMiddleware = require('./auth-middleware');
const authRouter = require('./routes/auth');
const clinicSettingsRouter = require('./routes/clinic-settings');
const clinicsRouter = require('./routes/clinics');
const doctorsRouter = require('./routes/doctors');
const appointmentsRouter = require('./routes/appointments');
const availabilityRouter = require('./routes/availability');
const uploadsRouter = require('./routes/uploads');
import { sendBrevoEmail } from "./services/brevoMail.js";

app.get("/email-test", async (req, res) => {
  try {
    const result = await sendBrevoEmail({
      to: "your_real_email@gmail.com",
      subject: "Brevo HTTP API test",
      text: "If you received this, Brevo HTTP API works 🎉",
      html: "<b>If you received this, Brevo HTTP API works 🎉</b>",
    });

    res.json({ ok: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});


const app = express();
const port = process.env.PORT || 4000;

const allowedOrigins = (process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'));
    },
  })
);

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    service: 'Dental Clinic Appointment Service',
    environment: process.env.NODE_ENV || 'development',
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', clinicResolver, authRouter);
app.use('/clinic', clinicResolver, authMiddleware, clinicSettingsRouter);
app.use('/clinics', clinicsRouter);
app.use('/doctors', clinicResolver, doctorsRouter);
app.use('/appointments', clinicResolver, appointmentsRouter);
app.use('/availability', clinicResolver, availabilityRouter);
app.use('/uploads', clinicResolver, authMiddleware, uploadsRouter);

app.use((err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error.' });
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on port ${port}`);
});
