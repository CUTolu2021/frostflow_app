const express = require('express');
const cors = require('cors');
const { env } = require('./config/env');
const { authRoutes } = require('./routes/authRoutes');
const { inventoryRoutes } = require('./routes/inventoryRoutes');
const { bootstrapRoutes } = require('./routes/bootstrapRoutes');
const { healthRoutes } = require('./routes/healthRoutes');
const { adminRoutes } = require('./routes/adminRoutes');
const { appRoutes } = require('./routes/appRoutes');
const { errorHandler, notFound } = require('./middlewares/errorMiddleware');

const app = express();
app.set('trust proxy', 1);

app.use(
  cors({
    origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(',').map((s) => s.trim()),
    credentials: true,
  }),
);

app.use(express.json());

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/bootstrap', bootstrapRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/app', appRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = { app };
