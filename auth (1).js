const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const { autenticar } = require("../middleware/auth");

const somenteDigitos = (v) => String(v || "").replace(/\D/g, "");
function emitirToken(usuario, perfil, referenciaId) {
  return jwt.sign(
    { sub: String(usuario.id), perfil, referenciaId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "2h" }
  );
}

// Paciente: CPF + senha
router.post("/login", async (req, res) => {
  try {
    const cpf = somenteDigitos(req.body.cpf);
    const senha = String(req.body.senha || "");
    if (cpf.length !== 11 || !senha) return res.status(400).json({ erro: "Informe CPF e senha válidos." });

    const [rows] = await pool.execute(
      `SELECT u.id AS usuario_id, u.nome, u.senha_hash, u.perfil, u.ativo,
              p.id AS paciente_id, p.cpf, p.plano_id
       FROM pacientes p JOIN usuarios u ON u.id = p.usuario_id
       WHERE p.cpf = ? LIMIT 1`, [cpf]
    );
    const u = rows[0];
    if (!u || !u.ativo || u.perfil !== "PACIENTE" || !u.senha_hash ||
        !(await bcrypt.compare(senha, u.senha_hash))) {
      return res.status(401).json({ erro: "CPF ou senha incorretos." });
    }
    await pool.execute("UPDATE usuarios SET ultimo_login_em = NOW() WHERE id = ?", [u.usuario_id]);
    return res.json({
      token: emitirToken({ id: u.usuario_id }, "PACIENTE", u.paciente_id),
      usuario: { id: u.paciente_id, usuarioId: u.usuario_id, nome: u.nome, cpf: u.cpf, planoId: u.plano_id, perfil: "PACIENTE" }
    });
  } catch (e) { console.error(e); return res.status(500).json({ erro: "Não foi possível realizar o login." }); }
});

// Profissional: matrícula + senha
router.post("/profissional/login", async (req, res) => {
  try {
    const matricula = String(req.body.matricula || req.body.registro || "").trim();
    const senha = String(req.body.senha || "");
    if (!matricula || !senha) return res.status(400).json({ erro: "Informe matrícula e senha." });

    const [rows] = await pool.execute(
      `SELECT u.id AS usuario_id, u.nome, u.senha_hash, u.perfil, u.ativo, p.id AS profissional_id, p.matricula
       FROM profissionais p JOIN usuarios u ON u.id = p.usuario_id
       WHERE p.matricula = ? LIMIT 1`, [matricula]
    );
    const u = rows[0];
    if (!u || !u.ativo || u.perfil !== "PROFISSIONAL" || !u.senha_hash ||
        !(await bcrypt.compare(senha, u.senha_hash))) {
      return res.status(401).json({ erro: "Matrícula ou senha incorretas." });
    }
    await pool.execute("UPDATE usuarios SET ultimo_login_em = NOW() WHERE id = ?", [u.usuario_id]);
    return res.json({
      token: emitirToken({ id: u.usuario_id }, "PROFISSIONAL", u.profissional_id),
      usuario: { id: u.profissional_id, usuarioId: u.usuario_id, nome: u.nome, matricula: u.matricula, perfil: "PROFISSIONAL" }
    });
  } catch (e) { console.error(e); return res.status(500).json({ erro: "Não foi possível realizar o login." }); }
});

// Primeiro acesso: fluxo simplificado para MVP. Em produção, exigir código de ativação enviado por canal verificado.
router.post("/primeiro-acesso", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const cpf = somenteDigitos(req.body.cpf);
    const senha = String(req.body.senha || "");
    if (cpf.length !== 11 || senha.length < 8) {
      return res.status(400).json({ erro: "Informe CPF válido e senha com pelo menos 8 caracteres." });
    }
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      "SELECT id, nome, email, usuario_id, primeiro_acesso_concluido FROM pacientes WHERE cpf = ? AND ativo = 1 FOR UPDATE",
      [cpf]
    );
    const p = rows[0];
    if (!p) { await conn.rollback(); return res.status(404).json({ erro: "Cadastro não encontrado. Procure a recepção." }); }
    if (p.usuario_id || p.primeiro_acesso_concluido) {
      await conn.rollback(); return res.status(409).json({ erro: "Primeiro acesso já realizado. Faça login ou recupere a senha." });
    }
    const hash = await bcrypt.hash(senha, 12);
    const [result] = await conn.execute(
      "INSERT INTO usuarios (nome, email, senha_hash, perfil, ativo) VALUES (?, ?, ?, 'PACIENTE', 1)",
      [p.nome, p.email || null, hash]
    );
    await conn.execute(
      "UPDATE pacientes SET usuario_id = ?, primeiro_acesso_concluido = 1 WHERE id = ?",
      [result.insertId, p.id]
    );
    await conn.commit();
    return res.status(201).json({ mensagem: "Senha criada. Agora você pode entrar." });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    return res.status(500).json({ erro: "Não foi possível concluir o primeiro acesso." });
  } finally { conn.release(); }
});

router.get("/me", autenticar, async (req, res) => {
  try {
    if (req.usuario.perfil === "PACIENTE") {
      const [rows] = await pool.execute(
        `SELECT p.id, p.nome, p.cpf, p.telefone, p.email, p.cidade, p.plano_id, u.perfil
         FROM pacientes p JOIN usuarios u ON u.id = p.usuario_id WHERE p.id = ?`,
        [req.usuario.referenciaId]
      );
      if (!rows[0]) return res.status(404).json({ erro: "Usuário não encontrado." });
      return res.json({ usuario: rows[0] });
    }
    const [rows] = await pool.execute(
      `SELECT p.id, u.nome, p.matricula, u.perfil FROM profissionais p
       JOIN usuarios u ON u.id = p.usuario_id WHERE p.id = ?`,
      [req.usuario.referenciaId]
    );
    if (!rows[0]) return res.status(404).json({ erro: "Usuário não encontrado." });
    return res.json({ usuario: rows[0] });
  } catch (e) { console.error(e); return res.status(500).json({ erro: "Erro ao consultar sessão." }); }
});

module.exports = router;