require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth");
const clienteRoutes = require("./routes/clientes");
const planoRoutes = require("./routes/planos");
const consultaRoutes = require("./routes/consultas");

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error("Configure JWT_SECRET no .env com pelo menos 32 caracteres.");
  process.exit(1);
}
if (!process.env.DB_USER || !process.env.DB_PASSWORD) {
  console.error("Configure DB_USER e DB_PASSWORD no .env.");
  process.exit(1);
}

const app = express();
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN ? process.env.FRONTEND_ORIGIN.split(",") : false,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "1mb" }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));

app.get("/api/health", (req, res) => res.json({ status: "ok", servico: "CaisMed API" }));
app.use("/api/auth", authRoutes);
app.use("/api/clientes", clienteRoutes);
app.use("/api/planos", planoRoutes);
app.use("/api/consultas", consultaRoutes);

app.use((req, res) => res.status(404).json({ erro: "Rota não encontrada." }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: "Erro interno. Tente novamente." });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`CaisMed API disponível em http://localhost:${port}/api/health`));